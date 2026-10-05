import type { PerformedExercise, PerformedSet, Units, WorkoutSession } from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

import { sameExerciseIdentity } from '../exercises/catalog';
import { completedWorkingSets } from '../progression/engine';
import { formatSideReps } from './sides';

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
    return `Last: ${displayLoad(set.loadKg, units)} ${unitLabel(units)} × ${formatSideReps(set)}${rir}`;
  }
  if (set.reps != null) {
    return `Last: ${formatSideReps(set)} reps`;
  }
  return null;
}

/**
 * One-line summary of the last time an exercise was trained, for plan rows:
 * "Last: 85 kg × 4, 2 sets". Uses the heaviest completed working set.
 */
export function lastPerformanceLabel(
  history: WorkoutSession[],
  exerciseId: string,
  units: Units = 'kg',
): string | null {
  const previous = findLastPerformedExercise(history, exerciseId);
  if (!previous) return null;
  const working = completedWorkingSets(previous.sets);
  if (working.length === 0) return null;
  const top = [...working].sort(
    (a, b) => (b.loadKg ?? 0) - (a.loadKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0),
  )[0];
  const sets = `${working.length} ${working.length === 1 ? 'set' : 'sets'}`;
  if (top.durationSeconds != null && top.durationSeconds > 0) {
    return `Last: ${top.durationSeconds}s, ${sets}`;
  }
  const load =
    top.loadKg != null && top.loadKg > 0
      ? `${displayLoad(top.loadKg, units)} ${unitLabel(units)} × `
      : '';
  return `Last: ${load}${top.reps ?? 0}, ${sets}`;
}
