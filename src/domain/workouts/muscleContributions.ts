import { getExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import type { MuscleGroup, WorkoutSession } from '@/types';

export const MUSCLE_CONTRIBUTION_MODEL = {
  version: 1,
  label: 'Direct sets + mapped secondary estimate',
  limitation:
    'Secondary factors are reviewable heuristics for selected exercises, not equivalent physiological set counts.',
} as const;

/**
 * Explicit, reviewable secondary-set estimates. Missing entries stay visible as
 * indirect exposures but do not silently receive a global multiplier.
 */
const SECONDARY_SET_FACTORS: Partial<Record<string, Partial<Record<MuscleGroup, number>>>> = {
  'barbell-bench-press': { triceps: 0.5, shoulders: 0.25 },
  'dumbbell-bench-press': { triceps: 0.5, shoulders: 0.25 },
  'incline-dumbbell-press': { triceps: 0.4, shoulders: 0.4 },
  'overhead-press': { triceps: 0.5 },
  'pull-up': { biceps: 0.5, forearms: 0.25 },
  'chin-up': { biceps: 0.6, forearms: 0.25 },
  'barbell-row': { biceps: 0.4, forearms: 0.25, lower_back: 0.25 },
  'barbell-back-squat': { glutes: 0.4, hamstrings: 0.2, lower_back: 0.15 },
  'romanian-deadlift': { glutes: 0.4, lower_back: 0.25, forearms: 0.2 },
};

export type MuscleSetContributions = {
  directSets: number;
  indirectExposures: number;
  estimatedSecondarySets: number;
  weightedEstimate: number;
  unmappedIndirectExposures: number;
  modelVersion: typeof MUSCLE_CONTRIBUTION_MODEL.version;
};

export function muscleSetContributions(
  sessions: WorkoutSession[],
  muscle: MuscleGroup,
): MuscleSetContributions {
  let directSets = 0;
  let indirectExposures = 0;
  let estimatedSecondarySets = 0;
  let unmappedIndirectExposures = 0;

  for (const session of sessions) {
    for (const performed of session.exercises) {
      const exercise = getExercise(performed.exerciseId);
      if (!exercise) continue;
      const setCount = completedWorkingSets(performed.sets).length;
      if (setCount === 0) continue;
      if (exercise.primaryMuscles.includes(muscle)) {
        directSets += setCount;
        continue;
      }
      if (!exercise.secondaryMuscles.includes(muscle)) continue;

      indirectExposures += setCount;
      const factor = SECONDARY_SET_FACTORS[exercise.id]?.[muscle];
      if (factor == null) unmappedIndirectExposures += setCount;
      else estimatedSecondarySets += setCount * factor;
    }
  }

  return {
    directSets,
    indirectExposures,
    estimatedSecondarySets: round1(estimatedSecondarySets),
    weightedEstimate: round1(directSets + estimatedSecondarySets),
    unmappedIndirectExposures,
    modelVersion: MUSCLE_CONTRIBUTION_MODEL.version,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
