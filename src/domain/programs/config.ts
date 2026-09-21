import type { ExerciseType, ExperienceLevel, MuscleGroup, TrainingGoal } from '@/types';

/**
 * Tunable programming defaults. The generator and progression engine read
 * from here — never hardcode these numbers in components or engines.
 */

export type RepRange = { min: number; max: number };

export const REP_RANGES: Record<ExerciseType, RepRange> = {
  compound: { min: 6, max: 10 },
  isolation: { min: 10, max: 15 },
};

/** Goal-specific defaults. Isolation work stays moderate even in strength plans. */
export const GOAL_REP_RANGES: Record<TrainingGoal, Record<ExerciseType, RepRange>> = {
  hypertrophy: REP_RANGES,
  strength: {
    compound: { min: 3, max: 6 },
    isolation: { min: 8, max: 12 },
  },
  mixed: {
    compound: { min: 5, max: 8 },
    isolation: { min: 10, max: 15 },
  },
};

/** Small muscles respond well to higher-rep isolation work. */
export const HIGH_REP_MUSCLES: MuscleGroup[] = ['calves', 'abs', 'forearms'];
export const HIGH_REP_RANGE: RepRange = { min: 12, max: 20 };

/** Time-tracked exercises (e.g. planks) target seconds, not reps. */
export const TIME_RANGE_SECONDS: RepRange = { min: 30, max: 60 };

export const REST_SECONDS: Record<ExerciseType, number> = {
  compound: 180,
  isolation: 105,
};

export const GOAL_REST_SECONDS: Record<TrainingGoal, Record<ExerciseType, number>> = {
  hypertrophy: REST_SECONDS,
  strength: { compound: 240, isolation: 120 },
  mixed: { compound: 210, isolation: 105 },
};

/** Default target RIR for working sets by experience. */
export const TARGET_RIR: Record<ExperienceLevel, number> = {
  beginner: 3,
  intermediate: 2,
  advanced: 1,
};

/** Default working sets per exercise slot. */
export const DEFAULT_SETS: Record<ExperienceLevel, { compound: number; isolation: number }> = {
  beginner: { compound: 3, isolation: 2 },
  intermediate: { compound: 3, isolation: 3 },
  advanced: { compound: 4, isolation: 3 },
};

/** Extra weekly sets added for a muscle the user marked as a priority. */
export const PRIORITY_EXTRA_WEEKLY_SETS = 3;

/** Weekly working-set ceilings per muscle by experience (fatigue guardrail). */
export const MAX_WEEKLY_SETS: Record<ExperienceLevel, number> = {
  beginner: 12,
  intermediate: 18,
  advanced: 22,
};

export const MIN_WORKING_SETS_PER_EXERCISE = 1;
export const MAX_WORKING_SETS_PER_EXERCISE = 5;

export const ABSOLUTE_REP_FLOOR = 3;
export const ABSOLUTE_REP_CEILING = 30;

/** Session time model, minutes. */
export const TIME_MODEL = {
  sessionOverheadMinutes: 6, // arrival, general warm-up
  perExerciseSetupMinutes: 1.5, // changing stations, warm-up sets
  workSecondsPerSet: 45,
};

export function estimateExerciseMinutes(workingSets: number, restSeconds: number): number {
  const perSet = (TIME_MODEL.workSecondsPerSet + restSeconds) / 60;
  return TIME_MODEL.perExerciseSetupMinutes + workingSets * perSet;
}
