import { desc, eq } from 'drizzle-orm';

import { workoutSessionsTable } from '@/db/schema';
import type { GymBroDb } from '@/db/types';
import type { WorkoutSession } from '@/types';

const MAX_STORED_SESSIONS = 100;
const RESUMABLE_STATUSES = new Set<WorkoutSession['status']>(['in_progress', 'paused']);

/** Driver-agnostic SQL operations for workout history — see `db/types.ts` for why. */

export function listWorkoutHistorySql(db: GymBroDb): WorkoutSession[] {
  return db
    .select()
    .from(workoutSessionsTable)
    .where(eq(workoutSessionsTable.status, 'completed'))
    .orderBy(desc(workoutSessionsTable.startedAt))
    .all()
    .map((row) => row.payload);
}

export function getInProgressWorkoutSessionSql(db: GymBroDb): WorkoutSession | null {
  return (
    db
      .select()
      .from(workoutSessionsTable)
      .orderBy(desc(workoutSessionsTable.startedAt))
      .all()
      .find((row) => RESUMABLE_STATUSES.has(row.status as WorkoutSession['status']))?.payload ??
    null
  );
}

export function saveInProgressWorkoutSessionSql(
  db: GymBroDb,
  session: WorkoutSession,
): WorkoutSession {
  const status: WorkoutSession['status'] = session.status === 'paused' ? 'paused' : 'in_progress';
  const draft: WorkoutSession = {
    ...session,
    status,
    finishedAt: null,
  };

  const existingDrafts = db
    .select()
    .from(workoutSessionsTable)
    .orderBy(desc(workoutSessionsTable.startedAt))
    .all()
    .filter((row) => RESUMABLE_STATUSES.has(row.status as WorkoutSession['status']));
  for (const existing of existingDrafts) {
    if (existing.id !== draft.id) {
      db.delete(workoutSessionsTable).where(eq(workoutSessionsTable.id, existing.id)).run();
    }
  }

  db.insert(workoutSessionsTable)
    .values({
      id: draft.id,
      startedAt: draft.startedAt,
      status: draft.status,
      payload: draft,
    })
    .onConflictDoUpdate({
      target: workoutSessionsTable.id,
      set: { startedAt: draft.startedAt, status: draft.status, payload: draft },
    })
    .run();

  return draft;
}

export function discardInProgressWorkoutSessionSql(db: GymBroDb, sessionId: string): void {
  db.delete(workoutSessionsTable).where(eq(workoutSessionsTable.id, sessionId)).run();
}

export function saveWorkoutSessionSql(db: GymBroDb, session: WorkoutSession): WorkoutSession {
  const completed: WorkoutSession = {
    ...session,
    status: 'completed',
    finishedAt: session.finishedAt ?? new Date().toISOString(),
  };

  db.insert(workoutSessionsTable)
    .values({
      id: completed.id,
      startedAt: completed.startedAt,
      status: completed.status,
      payload: completed,
    })
    .onConflictDoUpdate({
      target: workoutSessionsTable.id,
      set: { startedAt: completed.startedAt, status: completed.status, payload: completed },
    })
    .run();

  pruneOldSessions(db);
  return completed;
}

/** Inserts sessions as-is (status preserved) — for importing pre-existing data, not the save-on-finish flow. */
export function importSessionsSql(db: GymBroDb, sessions: WorkoutSession[]): void {
  for (const session of sessions) {
    db.insert(workoutSessionsTable)
      .values({ id: session.id, startedAt: session.startedAt, status: session.status, payload: session })
      .onConflictDoNothing()
      .run();
  }
}

export function clearWorkoutHistorySql(db: GymBroDb): void {
  db.delete(workoutSessionsTable).run();
}

export function countWorkoutHistorySql(db: GymBroDb): number {
  return db.select().from(workoutSessionsTable).all().length;
}

function pruneOldSessions(db: GymBroDb): void {
  const ids = db
    .select({ id: workoutSessionsTable.id })
    .from(workoutSessionsTable)
    .orderBy(desc(workoutSessionsTable.startedAt))
    .all();
  const staleIds = ids.slice(MAX_STORED_SESSIONS).map((row) => row.id);
  for (const id of staleIds) {
    db.delete(workoutSessionsTable).where(eq(workoutSessionsTable.id, id)).run();
  }
}
