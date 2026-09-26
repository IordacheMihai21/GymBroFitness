import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from './client';

/**
 * Thin wrappers over supabase-js's auth methods — every caller goes through
 * these instead of `getSupabaseClient()` directly, so "sync isn't
 * configured" is one clear error message instead of a null-check scattered
 * through every screen that touches auth.
 */
function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Sync is not configured for this build.');
  return client;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ session: Session | null }> {
  const { data, error } = await requireClient().auth.signUp({ email, password });
  if (error) throw error;
  return { session: data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/** Returns an unsubscribe function; a no-op when sync isn't configured. */
export function subscribeToAuthChanges(onChange: (session: Session | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => onChange(session));
  return () => subscription.unsubscribe();
}
