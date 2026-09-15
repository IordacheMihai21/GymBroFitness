import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '@/db/client';

import {
  deleteTemplateSql,
  importTemplatesSql,
  listTemplatesSql,
  saveTemplateSql,
} from './templateRepository';
import type { WorkoutTemplate } from './templates';

/** The pre-SQLite key this app used to store templates under (see the migration below). */
const LEGACY_STORAGE_KEY = '@GymBroFitness/workout-templates/v1';

/**
 * SQLite is now the source of truth for saved templates — same migration as
 * `historyStore.ts` (see docs/PLAN.md, "Architecture decision: local-first
 * SQLite"), applied here second now that the pattern is proven. Public API
 * unchanged so `workout.tsx`/`history.tsx` needed no changes.
 */
let migration: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
  if (!migration) migration = migrateLegacyTemplates();
  return migration;
}

async function migrateLegacyTemplates(): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const templates = parsed.filter(isWorkoutTemplateLike);
      if (templates.length > 0) importTemplatesSql(getDb(), templates);
    }
  } catch {
    // Corrupt legacy data — nothing usable to migrate, nothing to crash over.
  } finally {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  }
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

function isWorkoutTemplateLike(value: unknown): value is WorkoutTemplate {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkoutTemplate>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.createdAt === 'string' &&
    candidate.day != null &&
    Array.isArray(candidate.day.prescriptions)
  );
}
