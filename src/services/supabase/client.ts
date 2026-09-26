import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';

/**
 * Expo's SecureStore rejects values over ~2048 bytes, and a Supabase session
 * (access + refresh token) can exceed that. Standard fix (from Supabase's own
 * Expo guide): generate a random AES-256 key, keep only that small key in
 * SecureStore (hardware-backed keystore/keychain), and store the actual
 * session ciphertext in AsyncStorage — so the session is never persisted in
 * plaintext, without hitting SecureStore's size limit.
 */
type CipherEnvelope = {
  version: 1;
  keyId: string;
  ciphertext: string;
};

export class LargeSecureStore {
  private secureKeyName(key: string, keyId: string): string {
    return `${key}/aes-key/${keyId}`;
  }

  private async encrypt(key: string, value: string): Promise<CipherEnvelope> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const keyId = aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(16)));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(
      this.secureKeyName(key, keyId),
      aesjs.utils.hex.fromBytes(encryptionKey),
    );
    return {
      version: 1,
      keyId,
      ciphertext: aesjs.utils.hex.fromBytes(encryptedBytes),
    };
  }

  private async decrypt(key: string, ciphertext: string, keyId?: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(
      keyId ? this.secureKeyName(key, keyId) : key,
    );
    if (!encryptionKeyHex) return null;
    try {
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(encryptionKeyHex),
        new aesjs.Counter(1),
      );
      const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(ciphertext));
      return aesjs.utils.utf8.fromBytes(decryptedBytes);
    } catch {
      return null;
    }
  }

  private parseEnvelope(value: string): CipherEnvelope | null {
    try {
      const parsed = JSON.parse(value) as Partial<CipherEnvelope>;
      return parsed.version === 1 &&
        typeof parsed.keyId === 'string' &&
        typeof parsed.ciphertext === 'string'
        ? (parsed as CipherEnvelope)
        : null;
    } catch {
      return null;
    }
  }

  private async deleteEnvelopeKey(key: string, storedValue: string | null): Promise<void> {
    const envelope = storedValue ? this.parseEnvelope(storedValue) : null;
    if (envelope) await SecureStore.deleteItemAsync(this.secureKeyName(key, envelope.keyId));
  }

  async getItem(key: string): Promise<string | null> {
    const storedValue = await AsyncStorage.getItem(key);
    if (!storedValue) return null;
    const envelope = this.parseEnvelope(storedValue);
    // Raw ciphertext is the legacy format and uses the unversioned key name.
    return envelope
      ? this.decrypt(key, envelope.ciphertext, envelope.keyId)
      : this.decrypt(key, storedValue);
  }

  async setItem(key: string, value: string): Promise<void> {
    const previousValue = await AsyncStorage.getItem(key);
    const envelope = await this.encrypt(key, value);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (error) {
      await SecureStore.deleteItemAsync(this.secureKeyName(key, envelope.keyId));
      throw error;
    }

    // Cleanup happens only after the new ciphertext is durable. A crash before
    // this point leaves an unused key, not an unreadable session.
    await this.deleteEnvelopeKey(key, previousValue);
    await SecureStore.deleteItemAsync(key);
  }

  async removeItem(key: string): Promise<void> {
    const storedValue = await AsyncStorage.getItem(key);
    await AsyncStorage.removeItem(key);
    await this.deleteEnvelopeKey(key, storedValue);
    await SecureStore.deleteItemAsync(key);
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let instance: SupabaseClient | null | undefined;

/**
 * Lazy, like `db/client.ts`'s `getDb()`: importing this file must not require
 * real env vars or native modules to exist (Jest, or any screen that doesn't
 * touch sync yet). Returns null when unconfigured — the app's own
 * `.env.example` promises it "runs fully in demo mode without these," so
 * every caller must treat null as "sync is off," never throw.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (instance !== undefined) return instance;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    instance = null;
    return instance;
  }

  instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return instance;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
