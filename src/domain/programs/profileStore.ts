import AsyncStorage from '@react-native-async-storage/async-storage';

import { preserveAsyncStoragePayload } from '@/domain/persistence/asyncStorageRecovery';

import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  type CoachingTone,
  type DayOfWeek,
  type EquipmentType,
  type ExperienceLevel,
  type MuscleGroup,
  type NutritionContext,
  type TrainingEnvironment,
  type TrainingGoal,
  type TrainingPreferences,
  type Units,
  type UserProfile,
} from '@/types';

import { DEMO_DISPLAY_NAME, DEMO_PREFERENCES, DEMO_USER_ID } from './demoPreferences';

const STORAGE_KEY = '@GymBroFitness/training-profile/v1';
const PROFILE_VERSION = 1;

const EXPERIENCE_LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const TRAINING_GOALS: TrainingGoal[] = ['hypertrophy', 'strength', 'mixed'];
const NUTRITION_CONTEXTS: NutritionContext[] = ['unknown', 'maintenance', 'surplus', 'deficit'];
const TRAINING_ENVIRONMENTS: TrainingEnvironment[] = [
  'commercial_gym',
  'home_gym',
  'bodyweight',
  'custom',
];
const UNITS: Units[] = ['kg', 'lb'];
const COACHING_TONES: CoachingTone[] = ['supportive', 'direct', 'hype', 'science'];
const DAYS_PER_WEEK = [2, 3, 4, 5, 6] as const;
const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;

export type TrainingProfileSource = 'fallback' | 'local';

export type StoredTrainingProfile = {
  version: typeof PROFILE_VERSION;
  user: UserProfile;
  preferences: TrainingPreferences;
  updatedAt: string;
};

export type TrainingProfileSnapshot = StoredTrainingProfile & {
  source: TrainingProfileSource;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: DEMO_USER_ID,
  displayName: DEMO_DISPLAY_NAME,
  createdAt: new Date(0).toISOString(),
  onboardingCompleted: false,
};

export const DEFAULT_TRAINING_PROFILE: TrainingProfileSnapshot = {
  version: PROFILE_VERSION,
  user: DEFAULT_USER_PROFILE,
  preferences: DEMO_PREFERENCES,
  updatedAt: new Date(0).toISOString(),
  source: 'fallback',
};

export async function loadTrainingProfile(): Promise<TrainingProfileSnapshot> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_TRAINING_PROFILE;

  try {
    const parsed = JSON.parse(raw);
    if (isStoredTrainingProfile(parsed)) {
      return { ...parsed, source: 'local' };
    }
  } catch {
    // Corrupt user preferences should never block the app shell.
  }

  await preserveAsyncStoragePayload(AsyncStorage, STORAGE_KEY, raw);
  return DEFAULT_TRAINING_PROFILE;
}

export async function saveTrainingProfile(
  profile: Pick<StoredTrainingProfile, 'user' | 'preferences'>,
): Promise<TrainingProfileSnapshot> {
  const next: StoredTrainingProfile = {
    version: PROFILE_VERSION,
    user: profile.user,
    preferences: profile.preferences,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { ...next, source: 'local' };
}

export async function updateTrainingProfile({
  user,
  preferences,
}: {
  user?: Partial<UserProfile>;
  preferences?: Partial<TrainingPreferences>;
}): Promise<TrainingProfileSnapshot> {
  const current = await loadTrainingProfile();
  return saveTrainingProfile({
    user: { ...current.user, ...user },
    preferences: { ...current.preferences, ...preferences },
  });
}

export async function resetTrainingProfile(): Promise<TrainingProfileSnapshot> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return DEFAULT_TRAINING_PROFILE;
}

function isStoredTrainingProfile(value: unknown): value is StoredTrainingProfile {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredTrainingProfile>;
  return (
    candidate.version === PROFILE_VERSION &&
    isUserProfile(candidate.user) &&
    isTrainingPreferences(candidate.preferences) &&
    typeof candidate.updatedAt === 'string'
  );
}

export function isUserProfile(value: unknown): value is UserProfile {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<UserProfile>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.displayName === 'string' &&
    candidate.displayName.length > 0 &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.onboardingCompleted === 'boolean'
  );
}

export function isTrainingPreferences(value: unknown): value is TrainingPreferences {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<TrainingPreferences>;
  return (
    isOneOf(candidate.goal, TRAINING_GOALS) &&
    (candidate.nutritionContext == null ||
      isOneOf(candidate.nutritionContext, NUTRITION_CONTEXTS)) &&
    isOneOf(candidate.experience, EXPERIENCE_LEVELS) &&
    isOneOf(candidate.environment, TRAINING_ENVIRONMENTS) &&
    isArrayOf(candidate.equipment, isEquipment) &&
    isOneOf(candidate.daysPerWeek, DAYS_PER_WEEK) &&
    isArrayOf(candidate.preferredDays, isDayOfWeek) &&
    isOneOf(candidate.sessionMinutes, SESSION_MINUTES) &&
    isArrayOf(candidate.musclePriorities, isMuscleGroup) &&
    isArrayOf(candidate.preferredExerciseSlugs, isString) &&
    isArrayOf(candidate.dislikedExerciseSlugs, isString) &&
    isArrayOf(candidate.excludedExerciseSlugs, isString) &&
    isArrayOf(candidate.discomfortExerciseSlugs, isString) &&
    isOneOf(candidate.units, UNITS) &&
    isOneOf(candidate.coachingTone, COACHING_TONES)
  );
}

function isEquipment(value: unknown): value is EquipmentType {
  return isOneOf(value, EQUIPMENT_TYPES);
}

function isMuscleGroup(value: unknown): value is MuscleGroup {
  return isOneOf(value, MUSCLE_GROUPS);
}

function isDayOfWeek(value: unknown): value is DayOfWeek {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function isOneOf<T extends readonly unknown[]>(value: unknown, allowed: T): value is T[number] {
  return allowed.includes(value);
}
