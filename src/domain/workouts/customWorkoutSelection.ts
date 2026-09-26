import { getExercise, isExerciseAvailable } from '@/domain/exercises/catalog';
import type { TrainingPreferences } from '@/types';

export type CustomWorkoutSelectionResult = {
  ids: string[];
  issue: string | null;
};

export function validateCustomWorkoutSelection(
  ids: string[],
  preferences: TrainingPreferences,
): CustomWorkoutSelectionResult {
  const accepted: string[] = [];
  const rejected: string[] = [];

  for (const id of new Set(ids)) {
    const exercise = getExercise(id);
    if (!exercise) {
      rejected.push('An exercise from the link no longer exists in the catalog.');
      continue;
    }
    if (preferences.discomfortExerciseSlugs.includes(exercise.slug)) {
      rejected.push(`${exercise.name} is marked as uncomfortable in your preferences.`);
      continue;
    }
    if (preferences.excludedExerciseSlugs.includes(exercise.slug)) {
      rejected.push(`${exercise.name} is excluded in your training preferences.`);
      continue;
    }
    if (!isExerciseAvailable(exercise, preferences.equipment)) {
      rejected.push(`${exercise.name} requires equipment not selected in your profile.`);
      continue;
    }
    accepted.push(exercise.id);
  }

  return {
    ids: accepted,
    issue: rejected.length > 0 ? `${rejected[0]} Review Settings to change this.` : null,
  };
}
