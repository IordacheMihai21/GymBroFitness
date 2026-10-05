import { useEffect, useRef } from 'react';

import type { LiveActionId, LiveNotificationModel } from '@/domain/workouts/liveNotification';
import { ensureNotificationPermission } from '@/services/restTimerNotifications';

import {
  addWorkoutLiveActionListener,
  hideWorkoutLive,
  showWorkoutLive,
} from '../../../modules/workout-live';

/**
 * Mirrors the live workout into the ongoing Android notification (next set,
 * rest countdown, Log set / +30 s / Skip rest) and routes its buttons back
 * into the session. Hidden whenever `model` is null.
 */
export function useWorkoutLiveNotification(
  model: LiveNotificationModel | null,
  accentColor: string,
  onAction: (action: LiveActionId, model: LiveNotificationModel) => void,
) {
  const latest = useRef({ model, onAction });
  useEffect(() => {
    latest.current = { model, onAction };
  });

  useEffect(
    () =>
      addWorkoutLiveActionListener((action) => {
        const current = latest.current.model;
        if (current) latest.current.onAction(action as LiveActionId, current);
      }),
    [],
  );

  const asked = useRef(false);
  const signature = model ? JSON.stringify(model) : null;
  useEffect(() => {
    if (!model) {
      hideWorkoutLive();
      return;
    }
    const content = {
      title: model.title,
      text: model.text,
      subText: model.subText,
      restEndsAt: model.restEndsAt,
      startedAt: model.startedAt,
      progress: model.progress,
      progressMax: model.progressMax,
      color: accentColor,
      actions: model.actions,
    };
    if (showWorkoutLive(content) || asked.current) return;
    // First time only: ask for notification permission, then try again.
    asked.current = true;
    void ensureNotificationPermission().then((granted) => {
      if (granted) showWorkoutLive(content);
    });
    // `signature` captures every field of `model`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, accentColor]);

  useEffect(() => () => hideWorkoutLive(), []);
}
