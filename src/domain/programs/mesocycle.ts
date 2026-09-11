export type MesocyclePhase = 'accumulation' | 'overreaching' | 'deload';

export type MesocycleBlock = {
  name: string;
  totalWeeks: number;
  /** ISO date the block's week 1 started (any day within that week works). */
  startDate: string;
};

export type MesocycleStatus = {
  currentWeek: number; // 1-indexed, clamped to totalWeeks
  totalWeeks: number;
  phase: MesocyclePhase;
  daysToDeload: number; // days until the deload week starts; 0 once in it
  progress: number; // 0-1 through the block
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Planned periodization layered on top of the reactive progression engine:
 * this decides the block-level phase (and when a deload week is scheduled),
 * while `progression/engine.ts` still auto-regulates load/reps within it and
 * can still flag an early deload from real performance signals.
 */
export function computeMesocycleStatus(
  block: MesocycleBlock,
  now: Date = new Date(),
): MesocycleStatus {
  const elapsedMs = now.getTime() - new Date(block.startDate).getTime();
  const rawWeek = Math.floor(elapsedMs / MS_PER_WEEK) + 1;
  const currentWeek = Math.max(1, Math.min(block.totalWeeks, rawWeek));

  let phase: MesocyclePhase = 'accumulation';
  if (currentWeek >= block.totalWeeks) phase = 'deload';
  else if (currentWeek === block.totalWeeks - 1) phase = 'overreaching';

  const deloadWeekStartMs =
    new Date(block.startDate).getTime() + (block.totalWeeks - 1) * MS_PER_WEEK;
  const daysToDeload = Math.max(0, Math.ceil((deloadWeekStartMs - now.getTime()) / MS_PER_DAY));

  return {
    currentWeek,
    totalWeeks: block.totalWeeks,
    phase,
    daysToDeload,
    progress: currentWeek / block.totalWeeks,
  };
}
