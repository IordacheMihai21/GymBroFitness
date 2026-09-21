import type { PerformedSet, TrackingType, WorkoutSession } from '@/types';

import { startRestTimer } from './restTimer';
import { normalizeSetForTracking, validateSetForTracking } from './setTracking';
import { navigateAfterSetCompletion, type SetCompletionNavigation } from './supersetNavigation';

export type SetCompletionResult =
  | {
      ok: true;
      session: WorkoutSession;
      completed: boolean;
      navigation: SetCompletionNavigation;
    }
  | { ok: false; reason: 'paused' | 'missing_set'; message: string }
  | { ok: false; reason: 'invalid_set'; message: string; setId: string };

export function patchWorkoutSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  patch: Partial<PerformedSet>,
): WorkoutSession {
  if (session.status === 'paused') return session;
  const exercise = session.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set) return session;

  const exercises = [...session.exercises];
  const sets = [...exercise.sets];
  sets[setIndex] = { ...set, ...patch };
  exercises[exerciseIndex] = { ...exercise, sets };
  return { ...session, exercises };
}

export function toggleWorkoutSetCompletion(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  trackingType: TrackingType,
  now = new Date(),
): SetCompletionResult {
  if (session.status === 'paused') {
    return { ok: false, reason: 'paused', message: 'Resume the workout before logging sets.' };
  }
  const exercise = session.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set) {
    return { ok: false, reason: 'missing_set', message: 'This set is no longer available.' };
  }

  const completed = !set.completed;
  const normalized = normalizeSetForTracking(set, trackingType);
  if (completed) {
    const validation = validateSetForTracking(normalized, trackingType);
    if (!validation.valid) {
      return { ok: false, reason: 'invalid_set', message: validation.message, setId: set.id };
    }
  }

  const next = patchWorkoutSet(session, exerciseIndex, setIndex, {
    ...normalized,
    completed,
    completedAt: completed ? now.toISOString() : null,
  });
  const navigation = completed
    ? navigateAfterSetCompletion(next.exercises, exerciseIndex)
    : { nextExerciseIndex: null, skipRest: false };

  return {
    ok: true,
    completed,
    navigation,
    session: {
      ...next,
      restTimer:
        completed && !navigation.skipRest
          ? startRestTimer(exercise.prescription.restSeconds, now.getTime())
          : next.restTimer,
    },
  };
}
