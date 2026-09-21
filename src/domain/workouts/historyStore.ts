import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '@/db/client';
import { workoutSessionPayloadSchema } from '@/db/payload';
import type { GymBroDb } from '@/db/types';
import type { WorkoutSession } from '@/types';

import {
  clearWorkoutHistorySql,
  discardInProgressWorkoutSessionSql,
  getInProgressWorkoutSessionSql,
  importSessionsSql,
  listWorkoutHistorySql,
  type WorkoutHistoryPage,
  saveInProgressWorkoutSessionSql,
  saveWorkoutSessionSql,
} from './historyRepository';

/** The pre-SQLite key this app used to store history under (see the migration below). */
const LEGACY_STORAGE_KEY = '@GymBroFitness/workout-history/v1';

type LegacyHistoryStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem'>;

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
  if (!migration) {
    migration = migrateLegacyHistory(AsyncStorage, getDb()).catch((error: unknown) => {
      // A transient storage/DB failure must remain retryable in the same app process.
      migration = null;
      throw error;
    });
  }
  return migration;
}

export async function migrateLegacyHistory(
  storage: LegacyHistoryStorage,
  db: GymBroDb,
): Promise<void> {
  const raw = await storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Preserve unparseable data for a future recovery/export path.
    return;
  }

  if (!Array.isArray(parsed)) {
    // Partial imports would make it impossible to know which legacy records
    // were intentionally omitted. Keep the original untouched instead.
    return;
  }

  const sessions: WorkoutSession[] = [];
  for (const candidate of parsed) {
    const result = workoutSessionPayloadSchema.safeParse(candidate);
    if (!result.success) return;
    sessions.push(result.data);
  }

  // The repository imports the entire batch in one SQLite transaction and
  // ignores existing ids. If removing the legacy key fails, retrying is safe.
  importSessionsSql(db, sessions);
  await storage.removeItem(LEGACY_STORAGE_KEY);
}

export async function listWorkoutHistory(page?: WorkoutHistoryPage): Promise<WorkoutSession[]> {
  await ensureMigrated();
  return listWorkoutHistorySql(getDb(), page);
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

export async function importWorkoutSessions(sessions: WorkoutSession[]): Promise<void> {
  await ensureMigrated();
  importSessionsSql(getDb(), sessions);
}
