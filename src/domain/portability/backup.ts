import AsyncStorage from '@react-native-async-storage/async-storage';

import { workoutSessionPayloadSchema, workoutTemplatePayloadSchema } from '@/db/payload';
import { getExercise } from '@/domain/exercises/catalog';
import {
  isTrainingPreferences,
  isUserProfile,
  loadTrainingProfile,
  saveTrainingProfile,
} from '@/domain/programs/profileStore';
import {
  isTrainingProgram,
  loadActiveProgram,
  saveActiveProgram,
} from '@/domain/programs/programStore';
import { importWorkoutTemplates, listTemplates } from '@/domain/programs/templateStore';
import type { WorkoutTemplate } from '@/domain/programs/templates';
import { completedWorkingSets } from '@/domain/progression/engine';
import {
  getInProgressWorkoutSession,
  importWorkoutSessions,
  listWorkoutHistory,
  saveInProgressWorkoutSession,
} from '@/domain/workouts/historyStore';
import type { TrainingPreferences, TrainingProgram, UserProfile, WorkoutSession } from '@/types';

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_RECOVERY_KEY = '@GymBroFitness/restore-recovery/v1';

export type GymBroBackup = {
  source: 'GymBroFitness';
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  profile: {
    user: UserProfile;
    preferences: TrainingPreferences;
  };
  activeProgram: TrainingProgram;
  sessions: WorkoutSession[];
  activeDraft: WorkoutSession | null;
  templates: WorkoutTemplate[];
};

export type BackupPreview = {
  exportedAt: string;
  sessionCount: number;
  newSessionCount: number;
  duplicateSessionCount: number;
  templateCount: number;
  newTemplateCount: number;
  duplicateTemplateCount: number;
  replacesProfile: true;
  replacesActiveProgram: true;
  draftAction: 'none' | 'restore' | 'keep_existing';
};

export async function createBackupSnapshot(now = new Date()): Promise<GymBroBackup> {
  const profile = await loadTrainingProfile();
  const [activeProgram, sessions, activeDraft, templates] = await Promise.all([
    loadActiveProgram(profile.preferences, profile.user.id),
    listWorkoutHistory(),
    getInProgressWorkoutSession(),
    listTemplates(),
  ]);

  return {
    source: 'GymBroFitness',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    profile: { user: profile.user, preferences: profile.preferences },
    activeProgram: activeProgram.program,
    sessions,
    activeDraft,
    templates,
  };
}

export function serializeBackup(backup: GymBroBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(raw: string): GymBroBackup {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Backup is not valid JSON.');
  }
  if (!isRecord(value) || value.source !== 'GymBroFitness') {
    throw new Error('This file is not a GymBroFitness backup.');
  }
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version: ${String(value.schemaVersion)}.`);
  }
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('Backup export date is invalid.');
  }
  if (
    !isRecord(value.profile) ||
    !isUserProfile(value.profile.user) ||
    !isTrainingPreferences(value.profile.preferences)
  ) {
    throw new Error('Backup profile is invalid.');
  }
  if (!isTrainingProgram(value.activeProgram)) {
    throw new Error('Backup active program is invalid.');
  }
  if (value.activeProgram.userId !== value.profile.user.id) {
    throw new Error('Backup program and profile belong to different users.');
  }

  const sessions = parseArray(value.sessions, workoutSessionPayloadSchema.safeParse, 'sessions');
  if (sessions.some((session) => session.status !== 'completed')) {
    throw new Error('Backup history contains a non-completed session.');
  }
  ensureUniqueIds(sessions, 'sessions');

  const activeDraft =
    value.activeDraft == null
      ? null
      : parseOne(value.activeDraft, workoutSessionPayloadSchema.safeParse, 'active draft');
  if (activeDraft && activeDraft.status !== 'in_progress' && activeDraft.status !== 'paused') {
    throw new Error('Backup active draft is not resumable.');
  }

  const templates = parseArray(
    value.templates,
    workoutTemplatePayloadSchema.safeParse,
    'templates',
  );
  ensureUniqueIds(templates, 'templates');

  return {
    source: 'GymBroFitness',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    profile: { user: value.profile.user, preferences: value.profile.preferences },
    activeProgram: value.activeProgram,
    sessions,
    activeDraft,
    templates,
  };
}

export async function previewBackupRestore(backup: GymBroBackup): Promise<BackupPreview> {
  const [sessions, templates, draft] = await Promise.all([
    listWorkoutHistory(),
    listTemplates(),
    getInProgressWorkoutSession(),
  ]);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const templateIds = new Set(templates.map((template) => template.id));
  const duplicateSessionCount = backup.sessions.filter((session) =>
    sessionIds.has(session.id),
  ).length;
  const duplicateTemplateCount = backup.templates.filter((template) =>
    templateIds.has(template.id),
  ).length;

  return {
    exportedAt: backup.exportedAt,
    sessionCount: backup.sessions.length,
    newSessionCount: backup.sessions.length - duplicateSessionCount,
    duplicateSessionCount,
    templateCount: backup.templates.length,
    newTemplateCount: backup.templates.length - duplicateTemplateCount,
    duplicateTemplateCount,
    replacesProfile: true,
    replacesActiveProgram: true,
    draftAction: !backup.activeDraft ? 'none' : draft ? 'keep_existing' : 'restore',
  };
}

export async function restoreBackup(backup: GymBroBackup): Promise<BackupPreview> {
  const preview = await previewBackupRestore(backup);
  const recovery = await createBackupSnapshot();
  await AsyncStorage.setItem(BACKUP_RECOVERY_KEY, serializeBackup(recovery));

  await importWorkoutSessions(backup.sessions);
  await importWorkoutTemplates(backup.templates);
  await saveTrainingProfile(backup.profile);
  await saveActiveProgram(backup.activeProgram);
  if (backup.activeDraft && preview.draftAction === 'restore') {
    await saveInProgressWorkoutSession(backup.activeDraft);
  }

  return preview;
}

export function workoutHistoryToCsv(sessions: WorkoutSession[]): string {
  const rows: (string | number | null)[][] = [
    [
      'session_id',
      'started_at',
      'finished_at',
      'workout',
      'exercise_id',
      'exercise',
      'set_number',
      'set_kind',
      'load_kg',
      'reps',
      'duration_seconds',
      'rir',
    ],
  ];

  for (const session of sessions.filter((item) => item.status === 'completed')) {
    for (const performed of session.exercises) {
      for (const set of completedWorkingSets(performed.sets)) {
        rows.push([
          session.id,
          session.startedAt,
          session.finishedAt,
          session.dayName,
          performed.exerciseId,
          getExercise(performed.exerciseId)?.name ?? performed.exerciseId,
          set.setNumber,
          set.kind,
          set.loadKg,
          set.reps,
          set.durationSeconds,
          set.rir,
        ]);
      }
    }
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function parseArray<T>(
  value: unknown,
  safeParse: (candidate: unknown) => { success: boolean; data?: T },
  label: string,
): T[] {
  if (!Array.isArray(value)) throw new Error(`Backup ${label} are invalid.`);
  return value.map((candidate) => parseOne(candidate, safeParse, label));
}

function parseOne<T>(
  value: unknown,
  safeParse: (candidate: unknown) => { success: boolean; data?: T },
  label: string,
): T {
  const result = safeParse(value);
  if (!result.success || result.data == null) throw new Error(`Backup ${label} are invalid.`);
  return result.data;
}

function ensureUniqueIds(items: { id: string }[], label: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error(`Backup ${label} contain duplicate IDs.`);
  }
}

function csvCell(value: string | number | null): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
