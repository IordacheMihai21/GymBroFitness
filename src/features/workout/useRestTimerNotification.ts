import { useEffect, useState } from 'react';

import {
  clearRestTimerNotification,
  scheduleRestTimerNotification,
  type RestTimerNotificationStatus,
} from '@/services/restTimerNotifications';
import type { WorkoutSession } from '@/types';

/**
 * Keeps the OS-level rest-timer notification in sync with the session's
 * `restTimer` field — scheduling one when a rest starts, clearing it when
 * rest ends. Split out of `useWorkoutSession` since it only needs the one
 * field, not the whole session.
 */
export function useRestTimerNotification(
  restTimer: WorkoutSession['restTimer'],
  isHydratingDraft: boolean,
) {
  const [restNotificationStatus, setRestNotificationStatus] = useState<
    RestTimerNotificationStatus | 'idle'
  >('idle');

  useEffect(() => {
    if (isHydratingDraft) return;
    let active = true;

    if (!restTimer) {
      void clearRestTimerNotification().then(() => {
        if (active) setRestNotificationStatus('idle');
      });
      return () => {
        active = false;
      };
    }

    void scheduleRestTimerNotification(restTimer).then((status) => {
      if (active) setRestNotificationStatus(status);
    });

    return () => {
      active = false;
    };
  }, [isHydratingDraft, restTimer]);

  return { restNotificationStatus };
}
