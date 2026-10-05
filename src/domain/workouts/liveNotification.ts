import type { Exercise, PerformedSet, Units, WorkoutSession } from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

import { normalizeSessionTiming } from './history';
import { isPerSide, loadFieldLabel, loadMeaning } from './laterality';
import type { SetAutofillSuggestion } from './setAutofill';
import { prepareSetForCompletion } from './setFlow';
import { normalizeSetForTracking, validateSetForTracking } from './setTracking';
import { hasBothSides } from './sides';
import { workingIndexOf } from './warmup';

export type LiveActionId = 'log_set' | 'extend_rest' | 'skip_rest';

export type LiveNotificationModel = {
  title: string;
  text: string;
  subText: string;
  restEndsAt: number | null;
  startedAt: number | null;
  progress: number;
  progressMax: number;
  actions: { id: LiveActionId; title: string }[];
  /** The set "Log set" completes. */
  target: { exerciseIndex: number; setIndex: number } | null;
};

function openSetIndex(sets: PerformedSet[]): number {
  return sets.findIndex((set) => !set.completed && !set.skipped);
}

/** The active exercise's next open set, else the first open set after it, else anywhere. */
export function nextOpenSet(
  session: WorkoutSession,
  activeExerciseIndex: number,
): { exerciseIndex: number; setIndex: number } | null {
  const order = [
    ...session.exercises.map((_, index) => index).slice(activeExerciseIndex),
    ...session.exercises.map((_, index) => index).slice(0, activeExerciseIndex),
  ];
  for (const exerciseIndex of order) {
    const setIndex = openSetIndex(session.exercises[exerciseIndex]?.sets ?? []);
    if (setIndex !== -1) return { exerciseIndex, setIndex };
  }
  return null;
}

function describeSet(set: PerformedSet, exercise: Exercise, perSide: boolean, units: Units) {
  const parts: string[] = [];
  if (exercise.trackingType === 'time') {
    if (set.durationSeconds != null) parts.push(`${set.durationSeconds} s`);
  } else {
    if (set.loadKg != null && set.loadKg > 0) {
      const meaning = loadMeaning(exercise, perSide);
      const label = meaning === 'stack' ? unitLabel(units) : loadFieldLabel(meaning, units);
      parts.push(`${displayLoad(set.loadKg, units)} ${label}`);
    }
    if (hasBothSides(set)) parts.push(`L${set.repsLeft} R${set.repsRight} reps`);
    else if (set.reps != null) parts.push(`${set.reps}${perSide ? '/side' : ''} reps`);
  }
  return parts.join(' × ');
}

/**
 * What the lock-screen notification says right now: the next set with the
 * numbers it will be logged with, a rest countdown or elapsed time, progress,
 * and the buttons that make sense (log the set only when it can be logged
 * without typing anything).
 */
export function buildLiveNotification(
  session: WorkoutSession,
  activeExerciseIndex: number,
  suggestionFor: (exerciseIndex: number, setIndex: number) => SetAutofillSuggestion | null,
  lookup: (id: string) => Exercise | undefined,
  units: Units,
  now = Date.now(),
): LiveNotificationModel | null {
  if (session.status === 'completed' || session.status === 'discarded' || session.reviewStartedAt) {
    return null;
  }

  const working = session.exercises.flatMap((performed) =>
    performed.sets.filter((set) => set.kind !== 'warmup' && !set.skipped),
  );
  const progressMax = working.length;
  const progress = working.filter((set) => set.completed).length;
  const subText = `${session.dayName} · ${progress}/${progressMax} sets`;
  const timing = normalizeSessionTiming(session);
  const startedAt = new Date(timing.startedAt).getTime() + (session.totalPausedSeconds ?? 0) * 1000;

  if (session.status === 'paused') {
    return {
      title: 'Workout paused',
      text: 'Tap to resume.',
      subText,
      restEndsAt: null,
      startedAt: null,
      progress,
      progressMax,
      actions: [],
      target: null,
    };
  }

  const target = nextOpenSet(session, activeExerciseIndex);
  const restEndsAt = session.restTimer ? new Date(session.restTimer.endsAt).getTime() : null;
  const resting = restEndsAt != null && restEndsAt > now;
  const restActions: LiveNotificationModel['actions'] = resting
    ? [
        { id: 'extend_rest', title: '+30 s' },
        { id: 'skip_rest', title: 'Skip rest' },
      ]
    : [];

  if (!target) {
    return {
      title: 'Every set is logged',
      text: 'Open the app to finish and save.',
      subText,
      restEndsAt: resting ? restEndsAt : null,
      startedAt,
      progress,
      progressMax,
      actions: restActions,
      target: null,
    };
  }

  const performed = session.exercises[target.exerciseIndex];
  const exercise = lookup(performed.exerciseId);
  const set = performed.sets[target.setIndex];
  if (!exercise || !set) return null;

  const perSide = isPerSide(performed);
  const prepared = normalizeSetForTracking(
    prepareSetForCompletion(
      set,
      suggestionFor(target.exerciseIndex, target.setIndex),
      performed.prescription.targetRir,
      performed.splitSides === true,
    ),
    exercise.trackingType,
  );
  const loggable = validateSetForTracking(prepared, exercise.trackingType).valid;
  const workingSets = performed.sets.filter((item) => item.kind !== 'warmup').length;
  const setLabel =
    set.kind === 'warmup'
      ? 'Warm-up'
      : `Set ${workingIndexOf(performed.sets, target.setIndex) + 1} of ${workingSets}`;
  const numbers = describeSet(prepared, exercise, perSide, units);

  return {
    title: `${exercise.name} · ${setLabel}`,
    text: numbers
      ? `${resting ? 'Rest, then ' : 'Next: '}${numbers}`
      : resting
        ? 'Resting. Enter this set in the app.'
        : 'Enter this set in the app.',
    subText,
    restEndsAt: resting ? restEndsAt : null,
    startedAt,
    progress,
    progressMax,
    actions: [...(loggable ? [{ id: 'log_set' as const, title: 'Log set' }] : []), ...restActions],
    target,
  };
}
