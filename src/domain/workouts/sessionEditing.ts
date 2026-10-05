import type { PerformedSet, TrackingType, WorkoutSession } from '@/types';

import { startRestTimer } from './restTimer';
import { normalizeSetForTracking, validateSetForTracking } from './setTracking';
import { navigateAfterSetCompletion, type SetCompletionNavigation } from './supersetNavigation';

const WARMUP_REST_SECONDS = 60;

export type SetCompletionResult =
  | {
      ok: true;
      session: WorkoutSession;
      completed: boolean;
      navigation: SetCompletionNavigation;
    }
  | { ok: false; reason: 'paused' | 'missing_set'; message: string }
  | { ok: false; reason: 'invalid_set'; message: string; setId: string };

export type ExerciseSetCompletionResult =
  | { ok: true; session: WorkoutSession; completedCount: number }
  | {
      ok: false;
      reason: 'paused' | 'missing_exercise' | 'invalid_sets';
      errors: Record<string, string>;
    };

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

export function toggleWorkoutSetSkipped(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
): WorkoutSession {
  if (session.status === 'paused') return session;
  const exercise = session.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set || set.completed) return session;

  return patchWorkoutSet(session, exerciseIndex, setIndex, {
    skipped: !set.skipped,
    completedAt: null,
  });
}

export function skipAllOpenSets(session: WorkoutSession): WorkoutSession {
  if (session.status === 'paused') return session;
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) =>
        set.completed || set.skipped ? set : { ...set, skipped: true, completedAt: null },
      ),
    })),
  };
}

export function toggleWorkoutSetCompletion(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  trackingType: TrackingType,
  now = new Date(),
  options: { startRestTimer?: boolean } = {},
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
  // Warm-ups are done in a row before the working sets, so they never jump
  // to a superset partner.
  const navigation =
    completed && normalized.kind !== 'warmup'
      ? navigateAfterSetCompletion(next.exercises, exerciseIndex)
      : { nextExerciseIndex: null, skipRest: false };

  return {
    ok: true,
    completed,
    navigation,
    session: {
      ...next,
      restTimer:
        completed && !navigation.skipRest && options.startRestTimer !== false
          ? startRestTimer(
              // A warm-up only needs a short breather before the next ramp step.
              normalized.kind === 'warmup'
                ? Math.min(WARMUP_REST_SECONDS, exercise.prescription.restSeconds)
                : exercise.prescription.restSeconds,
              now.getTime(),
            )
          : next.restTimer,
    },
  };
}

export function completeOpenSetsForExercise(
  session: WorkoutSession,
  exerciseIndex: number,
  trackingType: TrackingType,
  now = new Date(),
): ExerciseSetCompletionResult {
  if (session.status === 'paused') {
    return { ok: false, reason: 'paused', errors: {} };
  }
  const exercise = session.exercises[exerciseIndex];
  if (!exercise) {
    return { ok: false, reason: 'missing_exercise', errors: {} };
  }

  const openSets = exercise.sets.filter((set) => !set.completed && !set.skipped);
  const normalizedById = new Map<string, PerformedSet>();
  const errors: Record<string, string> = {};

  for (const set of openSets) {
    const normalized = normalizeSetForTracking(set, trackingType);
    normalizedById.set(set.id, normalized);
    const validation = validateSetForTracking(normalized, trackingType);
    if (!validation.valid) errors[set.id] = validation.message;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, reason: 'invalid_sets', errors };
  }

  const completedAt = now.toISOString();
  const exercises = [...session.exercises];
  exercises[exerciseIndex] = {
    ...exercise,
    sets: exercise.sets.map((set) => {
      const normalized = normalizedById.get(set.id);
      return normalized ? { ...normalized, completed: true, completedAt } : set;
    }),
  };

  return {
    ok: true,
    completedCount: openSets.length,
    session: { ...session, exercises },
  };
}
