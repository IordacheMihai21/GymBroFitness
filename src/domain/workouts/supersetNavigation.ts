import type { PerformedExercise } from '@/types';

export type SetCompletionNavigation = {
  /** Exercise to switch to, or null to stay put (nothing left to advance to yet). */
  nextExerciseIndex: number | null;
  /** True when moving to the paired exercise within an active superset chain — no rest between them. */
  skipRest: boolean;
};

function isExerciseDone(exercise: PerformedExercise): boolean {
  return exercise.sets.every((set) => set.completed || set.skipped);
}

/** [start, end] (inclusive) of the maximal run of chained exercises `index` belongs to. */
export function supersetChainBounds(
  exercises: PerformedExercise[],
  index: number,
): [number, number] {
  let start = index;
  while (start > 0 && exercises[start - 1].prescription.supersetWithNext) start -= 1;
  let end = index;
  while (exercises[end]?.prescription.supersetWithNext && end + 1 < exercises.length) end += 1;
  return [start, end];
}

function nextOpenExerciseIndex(exercises: PerformedExercise[], fromIndex: number): number | null {
  for (let i = fromIndex + 1; i < exercises.length; i += 1) {
    if (!isExerciseDone(exercises[i])) return i;
  }
  return null;
}

/**
 * Decide where to go after a set is marked complete. Outside a superset
 * chain, behavior matches the plain sequential flow: only move once the
 * exercise itself is fully done. Inside a chain, every completed set
 * advances to the next incomplete exercise in the chain (cycling back to an
 * earlier one if needed) with no rest — the whole point of a superset —
 * until the chain itself is done, at which point normal rest resumes.
 */
export function navigateAfterSetCompletion(
  exercises: PerformedExercise[],
  currentIndex: number,
): SetCompletionNavigation {
  const [start, end] = supersetChainBounds(exercises, currentIndex);
  const chainLength = end - start + 1;

  if (chainLength <= 1) {
    const done = isExerciseDone(exercises[currentIndex]);
    return { nextExerciseIndex: done ? nextOpenExerciseIndex(exercises, currentIndex) : null, skipRest: false };
  }

  for (let offset = 1; offset < chainLength; offset += 1) {
    const idx = start + ((currentIndex - start + offset) % chainLength);
    if (!isExerciseDone(exercises[idx])) {
      return { nextExerciseIndex: idx, skipRest: true };
    }
  }

  return { nextExerciseIndex: nextOpenExerciseIndex(exercises, end), skipRest: false };
}
