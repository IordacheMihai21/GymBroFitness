import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ExercisePrescription,
  ProgramDay,
  SplitType,
  TrainingPreferences,
  TrainingProgram,
} from '@/types';

import { generateProgram } from './generator';

const STORAGE_KEY = '@GymBroFitness/active-program/v1';
const PROGRAM_VERSION = 1;

const SPLIT_TYPES: SplitType[] = [
  'full_body',
  'upper_lower',
  'push_pull_legs',
  'upper_lower_full',
  'custom',
];

export type ActiveProgramSource = 'generated' | 'local';

export type StoredActiveProgram = {
  version: typeof PROGRAM_VERSION;
  program: TrainingProgram;
  updatedAt: string;
};

export type ActiveProgramSnapshot = {
  source: ActiveProgramSource;
  program: TrainingProgram;
  updatedAt: string;
};

export function createGeneratedProgramSnapshot(
  preferences: TrainingPreferences,
  userId: string,
): ActiveProgramSnapshot {
  const program = generateProgram(preferences, userId);
  return {
    source: 'generated',
    program,
    updatedAt: program.createdAt,
  };
}

export async function loadActiveProgram(
  preferences: TrainingPreferences,
  userId: string,
): Promise<ActiveProgramSnapshot> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return createGeneratedProgramSnapshot(preferences, userId);

  try {
    const parsed = JSON.parse(raw);
    if (isStoredActiveProgram(parsed) && parsed.program.userId === userId) {
      return {
        source: 'local',
        program: parsed.program,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    // Corrupt active program data should never block the gym flow.
  }

  await AsyncStorage.removeItem(STORAGE_KEY);
  return createGeneratedProgramSnapshot(preferences, userId);
}

export async function saveActiveProgram(program: TrainingProgram): Promise<ActiveProgramSnapshot> {
  const stored: StoredActiveProgram = {
    version: PROGRAM_VERSION,
    program: {
      ...program,
      active: true,
    },
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return {
    source: 'local',
    program: stored.program,
    updatedAt: stored.updatedAt,
  };
}

export async function resetActiveProgram(
  preferences: TrainingPreferences,
  userId: string,
): Promise<ActiveProgramSnapshot> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return createGeneratedProgramSnapshot(preferences, userId);
}

function isStoredActiveProgram(value: unknown): value is StoredActiveProgram {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredActiveProgram>;
  return (
    candidate.version === PROGRAM_VERSION &&
    isTrainingProgram(candidate.program) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isTrainingProgram(value: unknown): value is TrainingProgram {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<TrainingProgram>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.name === 'string' &&
    isOneOf(candidate.splitType, SPLIT_TYPES) &&
    typeof candidate.daysPerWeek === 'number' &&
    Array.isArray(candidate.days) &&
    candidate.days.length > 0 &&
    candidate.days.every(isProgramDay) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.active === 'boolean' &&
    typeof candidate.rationale === 'string'
  );
}

function isProgramDay(value: unknown): value is ProgramDay {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<ProgramDay>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.order === 'number' &&
    Array.isArray(candidate.focus) &&
    Array.isArray(candidate.prescriptions) &&
    candidate.prescriptions.length > 0 &&
    candidate.prescriptions.every(isExercisePrescription) &&
    typeof candidate.estimatedMinutes === 'number'
  );
}

function isExercisePrescription(value: unknown): value is ExercisePrescription {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<ExercisePrescription>;
  return (
    typeof candidate.exerciseId === 'string' &&
    typeof candidate.order === 'number' &&
    typeof candidate.workingSets === 'number' &&
    typeof candidate.minReps === 'number' &&
    typeof candidate.maxReps === 'number' &&
    typeof candidate.targetRir === 'number' &&
    typeof candidate.restSeconds === 'number' &&
    typeof candidate.selectionReason === 'string'
  );
}

function isOneOf<T extends readonly unknown[]>(value: unknown, allowed: T): value is T[number] {
  return allowed.includes(value);
}
