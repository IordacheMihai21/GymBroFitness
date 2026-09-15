import { desc, eq } from 'drizzle-orm';

import { workoutTemplatesTable } from '@/db/schema';
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
    .map((row) => row.payload);
}

export function saveTemplateSql(db: GymBroDb, template: WorkoutTemplate): WorkoutTemplate {
  db.insert(workoutTemplatesTable)
    .values({ id: template.id, createdAt: template.createdAt, payload: template })
    .onConflictDoUpdate({
      target: workoutTemplatesTable.id,
      set: { createdAt: template.createdAt, payload: template },
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
  for (const template of templates) {
    db.insert(workoutTemplatesTable)
      .values({ id: template.id, createdAt: template.createdAt, payload: template })
      .onConflictDoNothing()
      .run();
  }
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
