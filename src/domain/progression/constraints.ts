import type { ExperienceLevel } from '@/types';

/**
 * Safety rails for every numeric progression decision.
 * All values configurable here; the engine never invents its own limits.
 */
export const PROGRESSION_CONSTRAINTS = {
  /** Hard cap on how much a load recommendation may grow in one step. */
  maxLoadIncreasePercent: 10,
  /** Conservative load reduction when performance misses badly. */
  loadDecreasePercent: 7.5,
  /** Deload load reduction suggestion. */
  deloadLoadPercent: 40,
  /** Number of consecutive under-performing sessions before decreasing load. */
  sessionsBeforeDecrease: 2,
  /** Successful sessions required before considering an added set. */
  sessionsBeforeAddSet: 3,
  /** Regressed sessions (plus poor readiness) that trigger a deload hint. */
  sessionsBeforeDeload: 3,
  minRepTarget: 3,
  maxRepTarget: 30,
  minWorkingSets: 1,
  maxWorkingSets: 5,
} as const;

export const MAX_WEEKLY_SETS_BY_EXPERIENCE: Record<ExperienceLevel, number> = {
  beginner: 12,
  intermediate: 18,
  advanced: 22,
};
