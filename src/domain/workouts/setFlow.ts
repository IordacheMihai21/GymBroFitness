import type { PerformedExercise, PerformedSet, TrackingType, WorkoutSession } from '@/types';
import { uuid } from '@/utils/ids';

import { findLastPerformedExercise } from './lastPerformance';
import type { SetAutofillSuggestion } from './setAutofill';
import { combineSides } from './sides';
import { renumberSets } from './warmup';
import { normalizeSetForTracking, validateSetForTracking } from './setTracking';

/**
 * The fast logging flow: a set can be ticked with nothing typed, because the
 * suggestion (last session, or the plan) fills whatever is empty. Effort
 * defaults to the plan's RIR target, and RIR 0 marks the set as taken to
 * failure, so lifters who train to failure never tag sets by hand.
 */
export function prepareSetForCompletion(
  set: PerformedSet,
  suggestion: SetAutofillSuggestion | null,
  targetRir: number,
  /** The exercise logs left and right separately. */
  splitSides = false,
): PerformedSet {
  if (splitSides && set.kind !== 'warmup') {
    const fallback = set.reps ?? suggestion?.reps ?? null;
    const repsLeft = set.repsLeft ?? suggestion?.repsLeft ?? fallback;
    const repsRight = set.repsRight ?? suggestion?.repsRight ?? fallback;
    return prepareSetForCompletion(
      { ...set, repsLeft, repsRight, reps: combineSides(repsLeft, repsRight) },
      suggestion,
      targetRir,
    );
  }
  // Effort is only meaningful on hard sets; a warm-up keeps whatever was typed.
  const rir = set.kind === 'warmup' ? set.rir : (set.rir ?? suggestion?.rir ?? targetRir);
  return {
    ...set,
    loadKg: set.loadKg ?? suggestion?.loadKg ?? null,
    reps: set.reps ?? suggestion?.reps ?? null,
    durationSeconds: set.durationSeconds ?? suggestion?.durationSeconds ?? null,
    rir,
    kind: set.kind === 'working' && rir === 0 ? 'failure' : set.kind,
  };
}

/** RIR 0 and "to failure" are the same statement; keep them in sync when RIR is edited. */
export function kindForRir(set: PerformedSet, rir: number | null): PerformedSet['kind'] {
  if (set.kind === 'warmup') return 'warmup';
  return rir === 0 ? 'failure' : 'working';
}

function patchExercise(
  session: WorkoutSession,
  exerciseIndex: number,
  update: (exercise: PerformedExercise) => PerformedExercise,
): WorkoutSession {
  const exercise = session.exercises[exerciseIndex];
  if (!exercise || session.status === 'paused') return session;
  const exercises = [...session.exercises];
  exercises[exerciseIndex] = update(exercise);
  return { ...session, exercises };
}

/** Adds one more working set, carrying the last set's load so it is ready to tick. */
export function addSet(session: WorkoutSession, exerciseIndex: number): WorkoutSession {
  return patchExercise(session, exerciseIndex, (exercise) => {
    const last = exercise.sets[exercise.sets.length - 1];
    const next: PerformedSet = {
      id: uuid(),
      setNumber: exercise.sets.filter((set) => set.kind !== 'warmup').length + 1,
      kind: 'working',
      loadKg: last?.loadKg ?? null,
      reps: null,
      durationSeconds: null,
      rir: null,
      completed: false,
      skipped: false,
      completedAt: null,
      technique: last?.technique ?? 'standard',
      subEfforts: [],
    };
    return { ...exercise, sets: [...exercise.sets, next] };
  });
}

/** Removes an unlogged set; the last remaining set always stays. */
export function removeSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
): WorkoutSession {
  return patchExercise(session, exerciseIndex, (exercise) => {
    const target = exercise.sets[setIndex];
    if (!target || target.completed || exercise.sets.length <= 1) return exercise;
    const sets = renumberSets(exercise.sets.filter((_, index) => index !== setIndex));
    return { ...exercise, sets };
  });
}

export type BulkCompletion = {
  session: WorkoutSession;
  completedCount: number;
  /** Open sets that could not be completed (nothing typed and nothing to suggest). */
  leftOpenCount: number;
};

/**
 * Ticks every open set of an exercise using what was typed or remembered, as
 * when the lifter moves to the next exercise. Sets that still have nothing
 * valid stay open rather than being logged as zeros or plan guesses.
 */
export function completeOpenSetsWithSuggestions(
  session: WorkoutSession,
  exerciseIndex: number,
  suggestions: (SetAutofillSuggestion | null)[],
  trackingType: TrackingType,
  now = new Date(),
): BulkCompletion {
  const exercise = session.exercises[exerciseIndex];
  if (!exercise || session.status === 'paused') {
    return { session, completedCount: 0, leftOpenCount: 0 };
  }
  let completedCount = 0;
  let leftOpenCount = 0;
  const stamp = now.toISOString();
  const sets = exercise.sets.map((set, index) => {
    if (set.completed || set.skipped) return set;
    // A bulk tick is blind, so it trusts only real numbers: what was typed, last
    // session, or a set done today. The plan's rep floor is a target, not a
    // record; with nothing else to go on the reps must be typed.
    const suggestion = suggestions[index] ?? null;
    const typedEffort = set.reps != null || set.durationSeconds != null;
    const trusted =
      suggestion && (suggestion.source !== 'prescription' || typedEffort) ? suggestion : null;
    const prepared = normalizeSetForTracking(
      prepareSetForCompletion(
        set,
        trusted,
        exercise.prescription.targetRir,
        exercise.splitSides === true,
      ),
      trackingType,
    );
    if (!validateSetForTracking(prepared, trackingType).valid) {
      leftOpenCount += 1;
      return set;
    }
    completedCount += 1;
    return { ...prepared, completed: true, completedAt: stamp };
  });
  const exercises = [...session.exercises];
  exercises[exerciseIndex] = { ...exercise, sets };
  return { session: { ...session, exercises }, completedCount, leftOpenCount };
}

/** Switches one-side-at-a-time logging for this exercise in this session. */
export function setExercisePerSide(
  session: WorkoutSession,
  exerciseIndex: number,
  perSide: boolean,
): WorkoutSession {
  return patchExercise(session, exerciseIndex, (exercise) => ({ ...exercise, perSide }));
}

/**
 * Swaps the exercise mid-workout (machine taken, different variation). Only
 * allowed before any set is logged, so finished sets are never re-labelled as
 * a different lift.
 */
export function swapSessionExercise(
  session: WorkoutSession,
  exerciseIndex: number,
  nextExerciseId: string,
): WorkoutSession {
  const current = session.exercises[exerciseIndex];
  if (
    !current ||
    current.sets.some((set) => set.completed) ||
    current.exerciseId === nextExerciseId
  ) {
    return session;
  }
  return patchExercise(session, exerciseIndex, (exercise) => {
    return {
      ...exercise,
      exerciseId: nextExerciseId,
      replacedExerciseId: exercise.replacedExerciseId ?? exercise.exerciseId,
      replacementReason: 'equipment_unavailable',
      perSide: undefined,
      prescription: {
        ...exercise.prescription,
        exerciseId: nextExerciseId,
        plannedSets: undefined,
      },
      sets: exercise.sets.map((set) => ({
        ...set,
        loadKg: null,
        reps: null,
        durationSeconds: null,
        rir: null,
        skipped: false,
      })),
    };
  });
}

/**
 * A fresh session remembers how each exercise was done last time: if the
 * lifter switched Bayesian curls to one side at a time (or logged each side
 * separately), it opens that way.
 */
export function inheritPerSide(session: WorkoutSession, history: WorkoutSession[]): WorkoutSession {
  let changed = false;
  const exercises = session.exercises.map((exercise) => {
    const previous = findLastPerformedExercise(history, exercise.exerciseId);
    const perSide =
      typeof exercise.perSide !== 'boolean' && typeof previous?.perSide === 'boolean'
        ? previous.perSide
        : exercise.perSide;
    const splitSides =
      exercise.splitSides == null && previous?.splitSides ? true : exercise.splitSides;
    if (perSide === exercise.perSide && splitSides === exercise.splitSides) return exercise;
    changed = true;
    return { ...exercise, perSide, splitSides };
  });
  return changed ? { ...session, exercises } : session;
}

/** Turns separate left/right logging on or off for one exercise in this session. */
export function setExerciseSplitSides(
  session: WorkoutSession,
  exerciseIndex: number,
  splitSides: boolean,
): WorkoutSession {
  return patchExercise(session, exerciseIndex, (exercise) => ({ ...exercise, splitSides }));
}
