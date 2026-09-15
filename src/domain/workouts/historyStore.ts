import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '@/db/client';
import type { WorkoutSession } from '@/types';

import {
  clearWorkoutHistorySql,
  discardInProgressWorkoutSessionSql,
  getInProgressWorkoutSessionSql,
  importSessionsSql,
  listWorkoutHistorySql,
  saveInProgressWorkoutSessionSql,
  saveWorkoutSessionSql,
} from './historyRepository';

/** The pre-SQLite key this app used to store history under (see the migration below). */
const LEGACY_STORAGE_KEY = '@GymBroFitness/workout-history/v1';

/**
 * SQLite (via `db/client.ts`) is now the source of truth for workout history
 * — see docs/PLAN.md, "Architecture decision: local-first SQLite". This file
 * keeps the exact public API the rest of the app already calls
 * (`workout.tsx`, `history.tsx`, `exercise/[id].tsx`) so nothing else needed
 * to change; it just delegates to the driver-agnostic, unit-tested SQL in
 * `historyRepository.ts`, bound to the real production `db`.
 *
 * One-time migration: any history saved before this change lives in
 * AsyncStorage under `LEGACY_STORAGE_KEY`. The first call to any exported
 * function here imports it into SQLite (idempotent — safe to run more than
 * once) and clears the old key, matching the "claim your local history"
 * pattern real apps use when changing their storage layer (see LiftLog's
 * `services/data-migrations/import-sessions.ts` for the same idea).
 */
let migration: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
  if (!migration) migration = migrateLegacyHistory();
  return migration;
}

async function migrateLegacyHistory(): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sessions = parsed.filter(isWorkoutSessionLike);
      if (sessions.length > 0) importSessionsSql(getDb(), sessions);
    }
  } catch {
    // Corrupt legacy data — nothing usable to migrate, nothing to crash over.
  } finally {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

export async function listWorkoutHistory(): Promise<WorkoutSession[]> {
  await ensureMigrated();
  return listWorkoutHistorySql(getDb());
}

export async function getInProgressWorkoutSession(): Promise<WorkoutSession | null> {
  await ensureMigrated();
  return getInProgressWorkoutSessionSql(getDb());
}

export async function saveInProgressWorkoutSession(
  session: WorkoutSession,
): Promise<WorkoutSession> {
  await ensureMigrated();
  return saveInProgressWorkoutSessionSql(getDb(), session);
}

export async function discardInProgressWorkoutSession(sessionId: string): Promise<void> {
  await ensureMigrated();
  discardInProgressWorkoutSessionSql(getDb(), sessionId);
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  await ensureMigrated();
  return saveWorkoutSessionSql(getDb(), session);
}

export async function clearWorkoutHistory(): Promise<void> {
  await ensureMigrated();
  clearWorkoutHistorySql(getDb());
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
