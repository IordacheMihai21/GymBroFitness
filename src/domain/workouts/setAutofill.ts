import type { PerformedExercise, PerformedSet } from '@/types';

import { formatPreviousSet, previousSetAtIndex } from './lastPerformance';

export type SetAutofillSource =
  | 'previous_session_set'
  | 'previous_session_top_set'
  | 'current_previous_set'
  | 'prescription';

export type SetAutofillSuggestion = {
  source: SetAutofillSource;
  loadKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rir: number | null;
  label: string;
  detail: string;
};

export function buildSetAutofillSuggestion(
  currentExercise: PerformedExercise,
  previousExercise: PerformedExercise | null,
  setIndex: number,
): SetAutofillSuggestion {
  const exactPrevious = previousSetAtIndex(previousExercise, setIndex);
  if (hasTrackableInput(exactPrevious)) {
    return suggestionFromSet(
      exactPrevious,
      'previous_session_set',
      `Last session set ${setIndex + 1}`,
    );
  }

  const previousTopSet = previousSetAtIndex(previousExercise, 0);
  if (hasTrackableInput(previousTopSet)) {
    return suggestionFromSet(previousTopSet, 'previous_session_top_set', 'Last session top set');
  }

  const currentPrevious = [...currentExercise.sets.slice(0, setIndex)]
    .reverse()
    .find((set) => hasTrackableInput(set) && !set.skipped);
  if (currentPrevious) {
    return suggestionFromSet(currentPrevious, 'current_previous_set', 'Previous working set');
  }

  const { prescription } = currentExercise;
  return {
    source: 'prescription',
    loadKg: prescription.recommendedLoad ?? null,
    reps: prescription.minReps,
    durationSeconds: null,
    rir: prescription.targetRir,
    label: 'Prescription floor',
    detail: `${prescription.minReps}-${prescription.maxReps} reps @ RIR ${prescription.targetRir}`,
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
): SetAutofillSuggestion {
  return {
    source,
    loadKg: set.loadKg,
    reps: set.reps,
    durationSeconds: set.durationSeconds,
    rir: set.rir,
    label,
    detail: formatPreviousSet(set)?.replace(/^Last: /, '') ?? 'Saved performance',
  };
}

function hasTrackableInput(set: PerformedSet | null | undefined): set is PerformedSet {
  return (
    set != null &&
    (set.loadKg != null || set.reps != null || set.durationSeconds != null || set.rir != null)
  );
}
