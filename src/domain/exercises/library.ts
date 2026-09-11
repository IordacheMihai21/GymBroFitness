import type { MuscleGroup } from '@/types';

import libraryData from './seed/library.json';

/**
 * Browsable reference data from the free-exercise-db public-domain dataset
 * (github.com/yuhonas/free-exercise-db, Unlicense). Separate from
 * EXERCISE_CATALOG: this is for search/browse only and isn't tagged with
 * the movementPattern/trackingType/laterality the program generator needs.
 */
export type LibraryExercise = {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipmentLabel: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'expert';
  mechanic: 'compound' | 'isolation' | null;
  instructions: string[];
  images: string[];
};

export const EXERCISE_LIBRARY = libraryData as LibraryExercise[];

export function searchLibrary(
  query: string,
  muscle: MuscleGroup | null,
  pool: LibraryExercise[] = EXERCISE_LIBRARY,
): LibraryExercise[] {
  const normalizedQuery = query.trim().toLowerCase();
  return pool.filter((exercise) => {
    const matchesMuscle = !muscle || exercise.primaryMuscles.includes(muscle);
    const matchesQuery =
      normalizedQuery.length === 0 || exercise.name.toLowerCase().includes(normalizedQuery);
    return matchesMuscle && matchesQuery;
  });
}
