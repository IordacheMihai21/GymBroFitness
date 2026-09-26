import AsyncStorage from '@react-native-async-storage/async-storage';

import { canonicalExerciseId } from '@/domain/exercises/catalog';
import { preserveAsyncStoragePayload } from '@/domain/persistence/asyncStorageRecovery';

import type { WorkoutImportSource } from './workoutImport';

const STORAGE_KEY = '@GymBroFitness/external-exercise-mappings/v1';
const VERSION = 1 as const;

export type ExternalExerciseMappings = {
  version: typeof VERSION;
  mappings: Record<string, string>;
  updatedAt: string;
};

const EMPTY: ExternalExerciseMappings = {
  version: VERSION,
  mappings: {},
  updatedAt: new Date(0).toISOString(),
};

export async function loadExternalExerciseMappings(): Promise<ExternalExerciseMappings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredMappings(parsed)) {
      return {
        ...parsed,
        mappings: Object.fromEntries(
          Object.entries(parsed.mappings).filter(([, exerciseId]) =>
            canonicalExerciseId(exerciseId),
          ),
        ),
      };
    }
  } catch {
    // Preserve the original bytes below.
  }
  await preserveAsyncStoragePayload(AsyncStorage, STORAGE_KEY, raw);
  return EMPTY;
}

export async function saveExternalExerciseMapping(
  source: WorkoutImportSource,
  externalName: string,
  exerciseId: string,
): Promise<ExternalExerciseMappings> {
  const canonicalId = canonicalExerciseId(exerciseId);
  if (!canonicalId) throw new Error('Choose a valid catalog exercise.');
  const name = externalName.trim();
  if (!name) throw new Error('External exercise name is empty.');
  const current = await loadExternalExerciseMappings();
  const next: ExternalExerciseMappings = {
    version: VERSION,
    mappings: { ...current.mappings, [externalMappingKey(source, name)]: canonicalId },
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function externalMappingKey(source: WorkoutImportSource, externalName: string): string {
  return `${source}:${normalizeExternalName(externalName)}`;
}

function normalizeExternalName(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function isStoredMappings(value: unknown): value is ExternalExerciseMappings {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<ExternalExerciseMappings>;
  return (
    candidate.version === VERSION &&
    candidate.mappings != null &&
    typeof candidate.mappings === 'object' &&
    !Array.isArray(candidate.mappings) &&
    Object.entries(candidate.mappings).every(
      ([key, exerciseId]) => key.length > 0 && typeof exerciseId === 'string',
    ) &&
    typeof candidate.updatedAt === 'string'
  );
}
