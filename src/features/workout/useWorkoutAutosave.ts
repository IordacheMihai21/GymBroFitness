import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  discardInProgressWorkoutSession,
  saveInProgressWorkoutSession,
  saveWorkoutSession,
} from '@/domain/workouts/historyStore';
import { createWorkoutPersistenceController } from '@/domain/workouts/sessionPersistenceController';
import { hasSessionActivity } from '@/domain/workouts/session';
import type { WorkoutSession } from '@/types';

import { isResumableSession, type AutosaveState } from './workout.helpers';

/**
 * Owns the live session's draft-autosave lifecycle — the debounced save on
 * every change plus the best-effort save when the app backgrounds — so
 * `useWorkoutSession` doesn't have to carry this alongside the set-editing
 * and finish/discard logic that actually needs direct access to `session`.
 * `persistence` and `cancelPendingAutosave` are returned because the finish
 * and discard flows in the parent hook also need to write through the same
 * controller and cancel the same pending debounce.
 */
export function useWorkoutAutosave(
  session: WorkoutSession,
  finished: boolean,
  isHydratingDraft: boolean,
) {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Android pauses JS timers in the background, so a set logged from the
  // lock-screen notification must be saved without waiting for the debounce.
  const appStateRef = useRef(AppState.currentState);
  const persistence = useMemo(
    () =>
      createWorkoutPersistenceController({
        saveDraft: saveInProgressWorkoutSession,
        finish: saveWorkoutSession,
        discard: discardInProgressWorkoutSession,
      }),
    [],
  );

  const cancelPendingAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  useEffect(() => {
    // Opening the workout screen is not starting a workout: wait for the first
    // logged set, check-in or pause before a draft exists at all.
    if (
      isHydratingDraft ||
      finished ||
      !isResumableSession(session) ||
      !hasSessionActivity(session)
    ) {
      return;
    }
    cancelPendingAutosave();

    const save = () => {
      setAutosaveState('saving');
      persistence
        .saveDraft(session)
        .then((saved) => {
          setLastAutosavedAt(new Date().toISOString());
          setAutosaveState(saved.id === session.id ? 'saved' : 'idle');
        })
        .catch(() => {
          setAutosaveState('error');
        });
    };
    if (appStateRef.current !== 'active') {
      save();
      return;
    }
    autosaveTimerRef.current = setTimeout(save, 500);

    return cancelPendingAutosave;
  }, [cancelPendingAutosave, finished, isHydratingDraft, persistence, session]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (
        nextState === 'active' ||
        isHydratingDraft ||
        finished ||
        !isResumableSession(session) ||
        !hasSessionActivity(session)
      ) {
        return;
      }

      cancelPendingAutosave();
      persistence
        .saveDraft(session)
        .then(() => {
          setLastAutosavedAt(new Date().toISOString());
          setAutosaveState('saved');
        })
        .catch(() => setAutosaveState('error'));
    });

    return () => subscription.remove();
  }, [cancelPendingAutosave, finished, isHydratingDraft, persistence, session]);

  return {
    autosaveState,
    setAutosaveState,
    lastAutosavedAt,
    setLastAutosavedAt,
    persistence,
    cancelPendingAutosave,
  };
}
