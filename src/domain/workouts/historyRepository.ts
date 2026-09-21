import { desc, eq } from 'drizzle-orm';

import {
  decodePayload,
  encodePayload,
  workoutSessionPayloadSchema,
  type PersistedPayload,
} from '@/db/payload';
import { dataRecoveryTable, workoutSessionsTable } from '@/db/schema';
import type { GymBroDb } from '@/db/types';
import type { WorkoutSession } from '@/types';

const RESUMABLE_STATUSES = new Set<WorkoutSession['status']>(['in_progress', 'paused']);

export type WorkoutHistoryPage = {
  limit: number;
  offset?: number;
};

/** Driver-agnostic SQL operations for workout history — see `db/types.ts` for why. */

export function listWorkoutHistorySql(db: GymBroDb, page?: WorkoutHistoryPage): WorkoutSession[] {
  const query = db
    .select()
    .from(workoutSessionsTable)
    .where(eq(workoutSessionsTable.status, 'completed'))
    .orderBy(desc(workoutSessionsTable.startedAt), desc(workoutSessionsTable.id));

  const rows = page
    ? query
        .limit(Math.max(1, Math.trunc(page.limit)))
        .offset(Math.max(0, Math.trunc(page.offset ?? 0)))
        .all()
    : query.all();

  return rows.flatMap((row) => {
    const session = decodeWorkoutSessionRow(db, row.id, row.payload);
    return session ? [session] : [];
  });
}

export function getInProgressWorkoutSessionSql(db: GymBroDb): WorkoutSession | null {
  return (
    db
      .select()
      .from(workoutSessionsTable)
      .orderBy(desc(workoutSessionsTable.startedAt))
      .all()
      .filter((row) => RESUMABLE_STATUSES.has(row.status as WorkoutSession['status']))
      .map((row) => decodeWorkoutSessionRow(db, row.id, row.payload))
      .find((session): session is WorkoutSession => session != null) ?? null
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

  db.transaction((tx) => {
    const existingDrafts = tx
      .select()
      .from(workoutSessionsTable)
      .orderBy(desc(workoutSessionsTable.startedAt))
      .all()
      .filter((row) => RESUMABLE_STATUSES.has(row.status as WorkoutSession['status']));
    for (const existing of existingDrafts) {
      if (existing.id !== draft.id) {
        tx.delete(workoutSessionsTable).where(eq(workoutSessionsTable.id, existing.id)).run();
      }
    }

    tx.insert(workoutSessionsTable)
      .values({
        id: draft.id,
        startedAt: draft.startedAt,
        status: draft.status,
        payload: encodePayload(draft),
      })
      .onConflictDoUpdate({
        target: workoutSessionsTable.id,
        set: { startedAt: draft.startedAt, status: draft.status, payload: encodePayload(draft) },
      })
      .run();
  });

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
      payload: encodePayload(completed),
    })
    .onConflictDoUpdate({
      target: workoutSessionsTable.id,
      set: {
        startedAt: completed.startedAt,
        status: completed.status,
        payload: encodePayload(completed),
      },
    })
    .run();

  return completed;
}

/** Inserts sessions as-is (status preserved) — for importing pre-existing data, not the save-on-finish flow. */
export function importSessionsSql(db: GymBroDb, sessions: WorkoutSession[]): void {
  db.transaction((tx) => {
    for (const session of sessions) {
      tx.insert(workoutSessionsTable)
        .values({
          id: session.id,
          startedAt: session.startedAt,
          status: session.status,
          payload: encodePayload(session),
        })
        .onConflictDoNothing({ target: workoutSessionsTable.id })
        .run();
    }
  });
}

export function clearWorkoutHistorySql(db: GymBroDb): void {
  db.delete(workoutSessionsTable).run();
}

export function countWorkoutHistorySql(db: GymBroDb): number {
  return db.select().from(workoutSessionsTable).all().length;
}

function decodeWorkoutSessionRow(
  db: GymBroDb,
  id: string,
  payload: PersistedPayload<WorkoutSession>,
): WorkoutSession | null {
  const decoded = decodePayload(payload, workoutSessionPayloadSchema);
  if (!decoded.ok) {
    preserveUnrecognizedPayload(db, id, decoded.reason, payload);
    return null;
  }

  if (decoded.data.id !== id) {
    preserveUnrecognizedPayload(db, id, 'payload_id_mismatch', payload);
    return null;
  }

  if (decoded.legacy) {
    db.update(workoutSessionsTable)
      .set({ payload: encodePayload(decoded.data) })
      .where(eq(workoutSessionsTable.id, id))
      .run();
  }
  return decoded.data;
}

function preserveUnrecognizedPayload(
  db: GymBroDb,
  id: string,
  reason: string,
  payload: unknown,
): void {
  db.insert(dataRecoveryTable)
    .values({
      id: `workout-session-read-${id}`,
      entityType: 'workout_session',
      entityId: id,
      reason,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      migrationVersion: 1,
    })
    .onConflictDoNothing({ target: dataRecoveryTable.id })
    .run();
}
