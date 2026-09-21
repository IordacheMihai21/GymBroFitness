import AsyncStorage from '@react-native-async-storage/async-storage';

import { preserveAsyncStoragePayload } from '@/domain/persistence/asyncStorageRecovery';

import { EXERCISE_LIBRARY } from './library';

const STORAGE_KEY = '@GymBroFitness/exercise-library-state/v1';
const VERSION = 1;
const MAX_RECENT = 20;
const referenceIds = new Set(EXERCISE_LIBRARY.map((exercise) => exercise.id));

export type ExerciseLibraryState = {
  version: typeof VERSION;
  favoriteIds: string[];
  recentIds: string[];
  updatedAt: string;
};

export const EMPTY_EXERCISE_LIBRARY_STATE: ExerciseLibraryState = {
  version: VERSION,
  favoriteIds: [],
  recentIds: [],
  updatedAt: new Date(0).toISOString(),
};

export async function loadExerciseLibraryState(): Promise<ExerciseLibraryState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_EXERCISE_LIBRARY_STATE;

  try {
    const parsed = JSON.parse(raw);
    if (isExerciseLibraryState(parsed)) {
      return {
        ...parsed,
        favoriteIds: parsed.favoriteIds.filter((id) => referenceIds.has(id)),
        recentIds: parsed.recentIds.filter((id) => referenceIds.has(id)).slice(0, MAX_RECENT),
      };
    }
  } catch {
    // Preserve the original bytes below before returning an empty state.
  }

  await preserveAsyncStoragePayload(AsyncStorage, STORAGE_KEY, raw);
  return EMPTY_EXERCISE_LIBRARY_STATE;
}

export async function toggleExerciseFavorite(referenceId: string): Promise<ExerciseLibraryState> {
  const current = await loadExerciseLibraryState();
  if (!referenceIds.has(referenceId)) return current;
  const favoriteIds = current.favoriteIds.includes(referenceId)
    ? current.favoriteIds.filter((id) => id !== referenceId)
    : [referenceId, ...current.favoriteIds];
  return save({ ...current, favoriteIds });
}

export async function recordRecentExercise(referenceId: string): Promise<ExerciseLibraryState> {
  const current = await loadExerciseLibraryState();
  if (!referenceIds.has(referenceId)) return current;
  const recentIds = [referenceId, ...current.recentIds.filter((id) => id !== referenceId)].slice(
    0,
    MAX_RECENT,
  );
  return save({ ...current, recentIds });
}

async function save(state: ExerciseLibraryState): Promise<ExerciseLibraryState> {
  const next: ExerciseLibraryState = {
    ...state,
    version: VERSION,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function isExerciseLibraryState(value: unknown): value is ExerciseLibraryState {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<ExerciseLibraryState>;
  return (
    candidate.version === VERSION &&
    Array.isArray(candidate.favoriteIds) &&
    candidate.favoriteIds.every((id) => typeof id === 'string') &&
    Array.isArray(candidate.recentIds) &&
    candidate.recentIds.every((id) => typeof id === 'string') &&
    typeof candidate.updatedAt === 'string'
  );
}
