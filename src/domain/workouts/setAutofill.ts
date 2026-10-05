import type { PerformedExercise, PerformedSet, TrackingType, Units } from '@/types';

import { formatPreviousSet, previousSetAtIndex } from './lastPerformance';
import { workingIndexOf } from './warmup';

export type SetAutofillSource =
  'previous_session_set' | 'previous_session_top_set' | 'current_previous_set' | 'prescription';

export type SetAutofillSuggestion = {
  source: SetAutofillSource;
  loadKg: number | null;
  reps: number | null;
  /** Remembered per-side reps, when last time logged each side. */
  repsLeft?: number | null;
  repsRight?: number | null;
  durationSeconds: number | null;
  rir: number | null;
  label: string;
  detail: string;
};

export function buildSetAutofillSuggestion(
  currentExercise: PerformedExercise,
  previousExercise: PerformedExercise | null,
  setIndex: number,
  units: Units = 'kg',
  trackingType: TrackingType = 'weight_reps',
): SetAutofillSuggestion {
  const target = currentExercise.sets[setIndex];
  // Warm-ups carry their own ramp numbers; history and plans describe working sets.
  if (target?.kind === 'warmup') {
    return {
      source: 'prescription',
      loadKg: target.loadKg,
      reps: target.reps,
      durationSeconds: target.durationSeconds,
      rir: null,
      label: 'Warm-up',
      detail: 'Warm-up set',
    };
  }
  // Inserted warm-ups must not shift which working set we compare with.
  const workingIndex = workingIndexOf(currentExercise.sets, setIndex);
  const planned = prescriptionSuggestion(currentExercise, workingIndex, trackingType);

  const exactPrevious = previousSetAtIndex(previousExercise, workingIndex);
  if (hasTrackableInput(exactPrevious)) {
    return withPlanFallback(
      suggestionFromSet(
        exactPrevious,
        'previous_session_set',
        `Last session set ${workingIndex + 1}`,
        units,
      ),
      planned,
    );
  }

  const previousTopSet = previousSetAtIndex(previousExercise, 0);
  if (hasTrackableInput(previousTopSet)) {
    return withPlanFallback(
      suggestionFromSet(previousTopSet, 'previous_session_top_set', 'Last session top set', units),
      planned,
    );
  }

  // Only a set the lifter actually did today says anything about the next one;
  // a planned load pre-filled into an open row does not.
  const currentPrevious = [...currentExercise.sets.slice(0, setIndex)]
    .reverse()
    .find(
      (set) => set.kind !== 'warmup' && set.completed && !set.skipped && hasTrackableInput(set),
    );
  if (currentPrevious) {
    return withPlanFallback(
      suggestionFromSet(currentPrevious, 'current_previous_set', 'Previous working set', units),
      planned,
    );
  }

  return planned;
}

function prescriptionSuggestion(
  currentExercise: PerformedExercise,
  setIndex: number,
  trackingType: TrackingType,
): SetAutofillSuggestion {
  const { prescription } = currentExercise;
  const plannedSet = prescription.plannedSets?.[setIndex];
  return {
    source: 'prescription',
    loadKg:
      trackingType === 'weight_reps' || trackingType === 'weighted_bodyweight'
        ? (plannedSet?.loadKg ?? prescription.recommendedLoad ?? null)
        : null,
    reps: trackingType === 'time' ? null : prescription.minReps,
    durationSeconds: trackingType === 'time' ? prescription.minReps : null,
    rir: plannedSet?.rir ?? prescription.targetRir,
    label: plannedSet ? `Planned set ${setIndex + 1}` : 'Prescription floor',
    detail:
      trackingType === 'time'
        ? `${prescription.minReps}-${prescription.maxReps}s @ RIR ${prescription.targetRir}`
        : `${prescription.minReps}-${prescription.maxReps} reps @ RIR ${prescription.targetRir}`,
  };
}

/** A remembered set with a missing field (e.g. load but no reps) borrows it from the plan. */
function withPlanFallback(
  suggestion: SetAutofillSuggestion,
  planned: SetAutofillSuggestion,
): SetAutofillSuggestion {
  return {
    ...suggestion,
    loadKg: suggestion.loadKg ?? planned.loadKg,
    reps: suggestion.reps ?? (suggestion.durationSeconds == null ? planned.reps : null),
    durationSeconds:
      suggestion.durationSeconds ?? (suggestion.reps == null ? planned.durationSeconds : null),
  };
}

export function setAutofillPatch(
  suggestion: SetAutofillSuggestion,
): Pick<PerformedSet, 'loadKg' | 'reps' | 'durationSeconds' | 'rir'> {
  return {
    loadKg: suggestion.loadKg,
    reps: suggestion.reps,
    durationSeconds: suggestion.durationSeconds,
    rir: suggestion.rir,
  };
}

function suggestionFromSet(
  set: PerformedSet,
  source: SetAutofillSource,
  label: string,
  units: Units,
): SetAutofillSuggestion {
  return {
    source,
    loadKg: set.loadKg,
    reps: set.reps,
    repsLeft: set.repsLeft ?? null,
    repsRight: set.repsRight ?? null,
    durationSeconds: set.durationSeconds,
    rir: set.rir,
    label,
    detail: formatPreviousSet(set, units)?.replace(/^Last: /, '') ?? 'Saved performance',
  };
}

function hasTrackableInput(set: PerformedSet | null | undefined): set is PerformedSet {
  return (
    set != null &&
    (set.loadKg != null || set.reps != null || set.durationSeconds != null || set.rir != null)
  );
}
