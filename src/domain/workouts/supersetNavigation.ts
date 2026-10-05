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
 * advances to the next incomplete exercise in the chain with no rest between
 * them (the whole point of a superset), then rests once the round is done
 * before cycling back: A1, B1, rest, A2, B2, rest. When the whole chain is
 * done, it moves on to the next exercise as usual.
 */
export function navigateAfterSetCompletion(
  exercises: PerformedExercise[],
  currentIndex: number,
): SetCompletionNavigation {
  const [start, end] = supersetChainBounds(exercises, currentIndex);
  const chainLength = end - start + 1;

  if (chainLength <= 1) {
    const done = isExerciseDone(exercises[currentIndex]);
    return {
      nextExerciseIndex: done ? nextOpenExerciseIndex(exercises, currentIndex) : null,
      skipRest: false,
    };
  }

  for (let offset = 1; offset < chainLength; offset += 1) {
    const idx = start + ((currentIndex - start + offset) % chainLength);
    if (!isExerciseDone(exercises[idx])) {
      // Moving on within the round is back-to-back; wrapping to the start of
      // the chain means the round is over, and the round is what you rest after.
      return { nextExerciseIndex: idx, skipRest: idx > currentIndex };
    }
  }

  return { nextExerciseIndex: nextOpenExerciseIndex(exercises, end), skipRest: false };
}

/**
 * "Superset with Lat Pulldown, round 2 of 3" for an exercise in a chain, or
 * null outside one. The round is the next working set of this exercise.
 */
export function supersetRound(
  exercises: PerformedExercise[],
  index: number,
): { partnerIndexes: number[]; round: number; rounds: number } | null {
  const [start, end] = supersetChainBounds(exercises, index);
  if (end === start) return null;
  const chain = exercises.slice(start, end + 1);
  const workingCount = (exercise: PerformedExercise) =>
    exercise.sets.filter((set) => set.kind !== 'warmup' && !set.skipped).length;
  const doneCount = (exercise: PerformedExercise) =>
    exercise.sets.filter((set) => set.kind !== 'warmup' && set.completed && !set.skipped).length;
  const rounds = Math.max(...chain.map(workingCount));
  const round = Math.min(rounds, doneCount(exercises[index]) + 1);
  const partnerIndexes = chain
    .map((_, offset) => start + offset)
    .filter((candidate) => candidate !== index);
  return { partnerIndexes, round, rounds };
}
