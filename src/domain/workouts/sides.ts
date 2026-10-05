import type { PerformedSet, WorkoutSession } from '@/types';

/**
 * Left and right logged separately, for one-side-at-a-time exercises.
 *
 * The set's `reps` is always the weaker side: progression asks the weaker
 * side to earn the next load, the usual advice for fixing imbalances (match
 * the weaker side's reps; don't let the stronger side run ahead). Tonnage uses
 * the real left + right reps.
 */

/** The weaker side, or whichever side was entered. */
export function combineSides(left: number | null, right: number | null): number | null {
  if (left != null && right != null) return Math.min(left, right);
  return left ?? right ?? null;
}

/** The patch for a set when one side's reps change; keeps `reps` in sync. */
export function sidePatch(
  set: Pick<PerformedSet, 'repsLeft' | 'repsRight'>,
  side: 'left' | 'right',
  value: number | null,
): Pick<PerformedSet, 'repsLeft' | 'repsRight' | 'reps'> {
  const repsLeft = side === 'left' ? value : (set.repsLeft ?? null);
  const repsRight = side === 'right' ? value : (set.repsRight ?? null);
  return { repsLeft, repsRight, reps: combineSides(repsLeft, repsRight) };
}

export function hasBothSides(
  set: Pick<PerformedSet, 'repsLeft' | 'repsRight'>,
): set is PerformedSet & { repsLeft: number; repsRight: number } {
  return set.repsLeft != null && set.repsRight != null;
}

/** "10/8" when both sides were logged, else the plain reps. */
export function formatSideReps(set: Pick<PerformedSet, 'repsLeft' | 'repsRight' | 'reps'>): string {
  if (hasBothSides(set)) return `${set.repsLeft}/${set.repsRight}`;
  return String(set.reps ?? 0);
}

export type SideBalance = {
  leftReps: number;
  rightReps: number;
  sets: number;
  sessions: number;
  /** null when the sides are within 5% of each other. */
  weaker: 'left' | 'right' | null;
  /** How far the weaker side is behind, in percent of the stronger side. */
  gapPercent: number;
};

const BALANCED_WITHIN_PERCENT = 5;

/**
 * Left vs right over the most recent sessions where both sides were logged
 * for this exercise. Only sets at the same load on both sides compare fairly,
 * and per-side sets always share the load, so every set with both sides counts.
 */
export function sideBalance(
  history: WorkoutSession[],
  exerciseId: string,
  maxSessions = 6,
): SideBalance | null {
  const sessions = history
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt));

  let leftReps = 0;
  let rightReps = 0;
  let sets = 0;
  let used = 0;
  for (const session of sessions) {
    if (used >= maxSessions) break;
    const sided = session.exercises
      .filter((performed) => performed.exerciseId === exerciseId)
      .flatMap((performed) => performed.sets)
      .filter((set) => set.completed && !set.skipped && set.kind !== 'warmup')
      .filter(hasBothSides);
    if (sided.length === 0) continue;
    used += 1;
    for (const set of sided) {
      leftReps += set.repsLeft;
      rightReps += set.repsRight;
      sets += 1;
    }
  }
  if (sets === 0) return null;
  const stronger = Math.max(leftReps, rightReps);
  const gapPercent =
    stronger > 0 ? Math.round((Math.abs(leftReps - rightReps) / stronger) * 100) : 0;
  return {
    leftReps,
    rightReps,
    sets,
    sessions: used,
    weaker: gapPercent <= BALANCED_WITHIN_PERCENT ? null : leftReps < rightReps ? 'left' : 'right',
    gapPercent,
  };
}
