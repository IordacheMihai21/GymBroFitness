import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '@/db/client';
import { workoutTemplatePayloadSchema } from '@/db/payload';
import type { GymBroDb } from '@/db/types';

import {
  deleteTemplateSql,
  importTemplatesSql,
  listTemplatesSql,
  saveTemplateSql,
} from './templateRepository';
import type { WorkoutTemplate } from './templates';

/** The pre-SQLite key this app used to store templates under (see the migration below). */
const LEGACY_STORAGE_KEY = '@GymBroFitness/workout-templates/v1';
type LegacyTemplateStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem'>;

/**
 * SQLite is now the source of truth for saved templates — same migration as
 * `historyStore.ts` (see docs/PLAN.md, "Architecture decision: local-first
 * SQLite"), applied here second now that the pattern is proven. Public API
 * unchanged so `workout.tsx`/`history.tsx` needed no changes.
 */
let migration: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
  if (!migration) {
    migration = migrateLegacyTemplates(AsyncStorage, getDb()).catch((error: unknown) => {
      migration = null;
      throw error;
    });
  }
  return migration;
}

export async function migrateLegacyTemplates(
  storage: LegacyTemplateStorage,
  db: GymBroDb,
): Promise<void> {
  const raw = await storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(parsed)) return;

  const templates: WorkoutTemplate[] = [];
  for (const candidate of parsed) {
    const result = workoutTemplatePayloadSchema.safeParse(candidate);
    if (!result.success) return;
    templates.push(result.data);
  }

  importTemplatesSql(db, templates);
  await storage.removeItem(LEGACY_STORAGE_KEY);
}

export async function listTemplates(): Promise<WorkoutTemplate[]> {
  await ensureMigrated();
  return listTemplatesSql(getDb());
}

export async function saveTemplate(template: WorkoutTemplate): Promise<WorkoutTemplate> {
  await ensureMigrated();
  return saveTemplateSql(getDb(), template);
}

export async function deleteTemplate(id: string): Promise<void> {
  await ensureMigrated();
  deleteTemplateSql(getDb(), id);
}

export async function importWorkoutTemplates(templates: WorkoutTemplate[]): Promise<void> {
  await ensureMigrated();
  importTemplatesSql(getDb(), templates);
}
