import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getCurrentSession, subscribeToAuthChanges } from '@/services/supabase/auth';

export type SupabaseSessionState = {
  session: Session | null;
  loading: boolean;
};

/** Current auth session plus live updates (sign-in, sign-out, token refresh). Returns `session: null` immediately, never loading, when sync isn't configured. */
export function useSupabaseSession(): SupabaseSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentSession()
      .then((current) => {
        if (mounted) setSession(current);
      })
      .catch(() => {
        // A damaged or expired persisted session must not leave Settings in
        // an infinite loading state. The auth form remains available to retry.
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    const unsubscribe = subscribeToAuthChanges((next) => {
      if (mounted) setSession(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { session, loading };
}
