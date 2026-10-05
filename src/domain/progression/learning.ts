import type { PerformedSet } from '@/types';

/**
 * Learns, per lifter and per exercise, how readily load should go up.
 *
 * Every past load increase is an experiment: if all sets stayed inside the
 * rep range at the new load, the jump held. Lifts where jumps keep holding
 * with reps to spare can jump a rep sooner; a lift where the last jump cost
 * reps waits for the top of the range to be hit twice before trying again.
 * Gravl describes the same idea; this is a small, explainable version of it.
 */

export type BumpMode = 'early' | 'standard' | 'patient';

export type LoadBump = {
  fromLoadKg: number;
  toLoadKg: number;
  /** Every working set at the new load reached the rep floor. */
  held: boolean;
  /** Lowest reps at the new load minus the rep floor (negative = missed). */
  repsMargin: number;
};

export type BumpProfile = {
  mode: BumpMode;
  bumps: number;
  held: number;
  summary: string;
};

export type BumpSession = {
  sets: PerformedSet[];
  minReps: number;
  expectedSets: number;
};

/** Clear-margin threshold: the new load was absorbed with this many reps above the floor. */
const COMFORTABLE_MARGIN = 2;

function working(sets: PerformedSet[]): PerformedSet[] {
  return sets.filter((set) => set.kind !== 'warmup' && set.completed && !set.skipped);
}

function topLoad(sets: PerformedSet[]): number {
  return Math.max(0, ...sets.map((set) => set.loadKg ?? 0));
}

/** Load increases between consecutive sessions (oldest first), with how each one went. */
export function findLoadBumps(sessions: BumpSession[], isTime = false): LoadBump[] {
  const bumps: LoadBump[] = [];
  let previousTop: number | null = null;
  for (const session of sessions) {
    const sets = working(session.sets);
    if (sets.length === 0) continue;
    const top = topLoad(sets);
    if (previousTop != null && previousTop > 0 && top > previousTop + 0.01) {
      const efforts = sets.map((set) => (isTime ? set.durationSeconds : set.reps) ?? 0);
      const lowest = Math.min(...efforts);
      bumps.push({
        fromLoadKg: previousTop,
        toLoadKg: top,
        held: sets.length >= session.expectedSets && lowest >= session.minReps,
        repsMargin: lowest - session.minReps,
      });
    }
    previousTop = top;
  }
  return bumps;
}

export function learnBumpProfile(bumps: LoadBump[]): BumpProfile {
  const held = bumps.filter((bump) => bump.held).length;
  const base = { bumps: bumps.length, held };
  const last = bumps.at(-1);
  if (!last) {
    return { ...base, mode: 'standard', summary: 'No load jumps yet.' };
  }
  const recentMisses = bumps.slice(-3).filter((bump) => !bump.held).length;
  if (!last.held || recentMisses >= 2) {
    return {
      ...base,
      mode: 'patient',
      summary: `The last load jump cost reps (${held} of ${bumps.length} held), so the next one waits for confirmation.`,
    };
  }
  const lastTwo = bumps.slice(-2);
  if (
    lastTwo.length === 2 &&
    lastTwo.every((bump) => bump.held && bump.repsMargin >= COMFORTABLE_MARGIN)
  ) {
    return {
      ...base,
      mode: 'early',
      summary: `Your load jumps hold with reps to spare (${held} of ${bumps.length}), so the next one comes a rep sooner.`,
    };
  }
  return {
    ...base,
    mode: 'standard',
    summary: `${held} of ${bumps.length} load jumps held.`,
  };
}
