import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WorkoutSession } from '@/types';

const STORAGE_KEY = '@GymBroFitness/workout-history/v1';
const MAX_STORED_SESSIONS = 100;

export async function listWorkoutHistory(): Promise<WorkoutSession[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isWorkoutSessionLike)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  } catch {
    return [];
  }
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  const completed: WorkoutSession = {
    ...session,
    status: 'completed',
    finishedAt: session.finishedAt ?? new Date().toISOString(),
  };
  const history = await listWorkoutHistory();
  const next = [completed, ...history.filter((item) => item.id !== completed.id)]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, MAX_STORED_SESSIONS);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return completed;
}

export async function clearWorkoutHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

function isWorkoutSessionLike(value: unknown): value is WorkoutSession {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkoutSession>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.dayName === 'string' &&
    typeof candidate.startedAt === 'string' &&
    Array.isArray(candidate.exercises)
  );
}
