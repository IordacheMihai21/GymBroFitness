import AsyncStorage from '@react-native-async-storage/async-storage';

import { LargeSecureStore } from '../client';

describe('supabase client', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('reports unconfigured and returns null when env vars are missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../client');

    expect(mod.isSupabaseConfigured()).toBe(false);
    expect(mod.getSupabaseClient()).toBeNull();
  });

  it('reports configured and returns a real client when env vars are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../client');

    expect(mod.isSupabaseConfigured()).toBe(true);
    expect(mod.getSupabaseClient()).not.toBeNull();
  });

  it('memoizes the client instance across calls instead of recreating it', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../client');

    expect(mod.getSupabaseClient()).toBe(mod.getSupabaseClient());
  });
});

describe('LargeSecureStore', () => {
  it('round-trips a large session without storing it in plaintext', async () => {
    const store = new LargeSecureStore();
    const value = JSON.stringify({ access_token: 'secret-token', padding: 'x'.repeat(4000) });

    await store.setItem('secure-session-roundtrip', value);

    const persisted = await AsyncStorage.getItem('secure-session-roundtrip');
    expect(persisted).not.toContain('secret-token');
    await expect(store.getItem('secure-session-roundtrip')).resolves.toBe(value);
  });

  it('keeps the previous session readable when the ciphertext write fails', async () => {
    const store = new LargeSecureStore();
    const key = 'secure-session-interrupted-write';
    await store.setItem(key, 'previous-session');
    const originalSetItem = AsyncStorage.setItem;
    AsyncStorage.setItem = jest.fn().mockRejectedValueOnce(new Error('disk full'));

    await expect(store.setItem(key, 'new-session')).rejects.toThrow('disk full');
    AsyncStorage.setItem = originalSetItem;

    await expect(store.getItem(key)).resolves.toBe('previous-session');
  });
});
