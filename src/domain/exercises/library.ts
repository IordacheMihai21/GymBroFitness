import type { Exercise, MuscleGroup } from '@/types';

import { getExercise } from './catalog';
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

/**
 * Explicit bridge from reference-only data to the smaller loggable catalog.
 * Entries are reviewed manually; absence means "reference only", never an
 * automatic fuzzy conversion.
 */
export const REFERENCE_TO_CATALOG_ID: Readonly<Record<string, string>> = {
  Barbell_Squat: 'barbell-back-squat',
  Bent_Over_Barbell_Row: 'barbell-row',
  Cable_Crossover: 'cable-fly',
  'Chin-Up': 'chin-up',
  'Dips_-_Chest_Version': 'dip',
  Dumbbell_Bench_Press: 'dumbbell-bench-press',
  Incline_Dumbbell_Press: 'incline-dumbbell-press',
  Leg_Press: 'leg-press',
  Machine_Bench_Press: 'machine-chest-press',
  Plank: 'plank',
  Pullups: 'pull-up',
  Pushups: 'push-up',
  Romanian_Deadlift: 'romanian-deadlift',
  Seated_Calf_Raise: 'seated-calf-raise',
  Standing_Military_Press: 'overhead-press',
};

export function loggableExerciseForReference(reference: LibraryExercise): Exercise | null {
  const catalogId = REFERENCE_TO_CATALOG_ID[reference.id];
  return catalogId ? (getExercise(catalogId) ?? null) : null;
}

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
