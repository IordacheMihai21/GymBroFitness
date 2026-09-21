import { desc, eq } from 'drizzle-orm';

import {
  decodePayload,
  encodePayload,
  workoutTemplatePayloadSchema,
  type PersistedPayload,
} from '@/db/payload';
import { dataRecoveryTable, workoutTemplatesTable } from '@/db/schema';
import type { GymBroDb } from '@/db/types';

import type { WorkoutTemplate } from './templates';

const MAX_STORED_TEMPLATES = 50;

/** Driver-agnostic SQL operations for saved templates — see `db/types.ts` for why. */

export function listTemplatesSql(db: GymBroDb): WorkoutTemplate[] {
  return db
    .select()
    .from(workoutTemplatesTable)
    .orderBy(desc(workoutTemplatesTable.createdAt))
    .all()
    .flatMap((row) => {
      const template = decodeWorkoutTemplateRow(db, row.id, row.payload);
      return template ? [template] : [];
    });
}

export function saveTemplateSql(db: GymBroDb, template: WorkoutTemplate): WorkoutTemplate {
  db.insert(workoutTemplatesTable)
    .values({ id: template.id, createdAt: template.createdAt, payload: encodePayload(template) })
    .onConflictDoUpdate({
      target: workoutTemplatesTable.id,
      set: { createdAt: template.createdAt, payload: encodePayload(template) },
    })
    .run();

  pruneOldTemplates(db);
  return template;
}

export function deleteTemplateSql(db: GymBroDb, id: string): void {
  db.delete(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id)).run();
}

/** Inserts templates as-is — for importing pre-existing data, not the save flow. */
export function importTemplatesSql(db: GymBroDb, templates: WorkoutTemplate[]): void {
  db.transaction((tx) => {
    for (const template of templates) {
      tx.insert(workoutTemplatesTable)
        .values({
          id: template.id,
          createdAt: template.createdAt,
          payload: encodePayload(template),
        })
        .onConflictDoNothing({ target: workoutTemplatesTable.id })
        .run();
    }
  });
}

export function countTemplatesSql(db: GymBroDb): number {
  return db.select().from(workoutTemplatesTable).all().length;
}

function pruneOldTemplates(db: GymBroDb): void {
  const ids = db
    .select({ id: workoutTemplatesTable.id })
    .from(workoutTemplatesTable)
    .orderBy(desc(workoutTemplatesTable.createdAt))
    .all();
  const staleIds = ids.slice(MAX_STORED_TEMPLATES).map((row) => row.id);
  for (const id of staleIds) {
    db.delete(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id)).run();
  }
}

function decodeWorkoutTemplateRow(
  db: GymBroDb,
  id: string,
  payload: PersistedPayload<WorkoutTemplate>,
): WorkoutTemplate | null {
  const decoded = decodePayload(payload, workoutTemplatePayloadSchema);
  if (!decoded.ok || decoded.data.id !== id) {
    const reason = decoded.ok ? 'payload_id_mismatch' : decoded.reason;
    db.insert(dataRecoveryTable)
      .values({
        id: `workout-template-read-${id}`,
        entityType: 'workout_template',
        entityId: id,
        reason,
        payload: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        migrationVersion: 1,
      })
      .onConflictDoNothing({ target: dataRecoveryTable.id })
      .run();
    return null;
  }

  if (decoded.legacy) {
    db.update(workoutTemplatesTable)
      .set({ payload: encodePayload(decoded.data) })
      .where(eq(workoutTemplatesTable.id, id))
      .run();
  }
  return decoded.data;
}
