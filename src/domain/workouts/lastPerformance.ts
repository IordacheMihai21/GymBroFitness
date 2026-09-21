import type { PerformedExercise, PerformedSet, Units, WorkoutSession } from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

import { sameExerciseIdentity } from '../exercises/catalog';
import { completedWorkingSets } from '../progression/engine';

/**
 * Find the most recent completed session that trained a given exercise.
 * `history` is expected pre-sorted newest-first (as `listWorkoutHistory`
 * returns it) so this is a simple linear scan, not a re-sort.
 */
export function findLastPerformedExercise(
  history: WorkoutSession[],
  exerciseId: string,
): PerformedExercise | null {
  for (const session of history) {
    const match = session.exercises.find((ex) => sameExerciseIdentity(ex.exerciseId, exerciseId));
    if (match) return match;
  }
  return null;
}

/**
 * The previous session's Nth completed working set (0-indexed), for showing
 * a "last time" overlay next to the set currently being logged.
 */
export function previousSetAtIndex(
  previous: PerformedExercise | null,
  setIndex: number,
): PerformedSet | null {
  if (!previous) return null;
  const working = completedWorkingSets(previous.sets);
  return working[setIndex] ?? null;
}

/** Human-readable "last time" label for a single previous set. */
export function formatPreviousSet(set: PerformedSet | null, units: Units = 'kg'): string | null {
  if (!set) return null;
  if (set.durationSeconds != null && set.durationSeconds > 0) {
    return `Last: ${set.durationSeconds}s`;
  }
  if (set.loadKg != null && set.loadKg > 0) {
    const rir = set.rir != null ? ` @ RIR ${set.rir}` : '';
    return `Last: ${displayLoad(set.loadKg, units)} ${unitLabel(units)} × ${set.reps ?? 0}${rir}`;
  }
  if (set.reps != null) {
    return `Last: ${set.reps} reps`;
  }
  return null;
}
