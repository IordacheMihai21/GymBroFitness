import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { WorkoutTemplate } from '@/domain/programs/templates';
import type { WorkoutSession } from '@/types';

import type { PersistedPayload } from './payload';

/**
 * Local SQLite is the on-device source of truth (see docs/PLAN.md, "Architecture
 * decision: local-first SQLite"). Each table follows the id + versioned-payload
 * shape used by LiftLog (github.com/LiamMorrow/LiftLog, same Expo/RN/React stack):
 * the full domain object — already a carefully-designed TS type — is stored as
 * JSON in a `schemaVersion` envelope. Only the columns actually needed for querying,
 * sorting, or DB-level invariants are pulled out alongside it. This avoids a
 * deep-normalization ORM/domain-type mismatch while still getting real SQL
 * where it earns its keep (indexed sort, a uniqueness constraint the previous
 * AsyncStorage array never had).
 *
 * Bare payloads from pre-v1 installs remain readable and are promoted on read;
 * unknown future versions are retained in both their source row and recovery.
 */

export const workoutSessionsTable = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    startedAt: text('started_at').notNull(),
    status: text('status').notNull(),
    payload: text('payload', { mode: 'json' }).$type<PersistedPayload<WorkoutSession>>().notNull(),
  },
  (table) => [
    index('workout_sessions_status_started_at_idx').on(table.status, table.startedAt, table.id),
    // A constant-expression partial index makes all resumable statuses share
    // one uniqueness bucket: paused and active are the same logical draft.
    uniqueIndex('single_resumable_session')
      .on(sql`(1)`)
      .where(sql`${table.status} IN ('in_progress', 'paused')`),
  ],
);

export const workoutTemplatesTable = sqliteTable('workout_templates', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  payload: text('payload', { mode: 'json' }).$type<PersistedPayload<WorkoutTemplate>>().notNull(),
});

export const dataRecoveryTable = sqliteTable('data_recovery', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  reason: text('reason').notNull(),
  payload: text('payload'),
  createdAt: text('created_at').notNull(),
  migrationVersion: integer('migration_version').notNull(),
});

export const schema = { workoutSessionsTable, workoutTemplatesTable, dataRecoveryTable };
export type GymBroSchema = typeof schema;

/**
 * Core DDL is idempotent; versioned migration SQL is executed separately by
 * `client.ts` according to SQLite's `user_version`. Keeping SQL as bundled TS
 * strings works consistently in Expo without runtime filesystem access.
 */
export const CORE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_recovery (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL,
  migration_version INTEGER NOT NULL
);
`;

export const DATABASE_VERSION = 1;

/**
 * Migration 1 replaces the two independent draft indexes with one invariant.
 * Every pre-migration payload is copied first so an interrupted or lossy shape
 * migration always has an application-readable recovery source.
 */
export const MIGRATION_1_SQL = `
INSERT OR IGNORE INTO data_recovery
  (id, entity_type, entity_id, reason, payload, created_at, migration_version)
SELECT
  'v1-session-' || id,
  'workout_session',
  id,
  'pre_migration_backup',
  payload,
  datetime('now'),
  1
FROM workout_sessions;

INSERT OR IGNORE INTO data_recovery
  (id, entity_type, entity_id, reason, payload, created_at, migration_version)
SELECT
  'v1-template-' || id,
  'workout_template',
  id,
  'pre_migration_backup',
  payload,
  datetime('now'),
  1
FROM workout_templates;

DROP INDEX IF EXISTS single_in_progress_session;
DROP INDEX IF EXISTS single_paused_session;

INSERT OR IGNORE INTO data_recovery
  (id, entity_type, entity_id, reason, payload, created_at, migration_version)
SELECT
  'v1-extra-draft-' || id,
  'workout_session',
  id,
  'extra_resumable_draft',
  payload,
  datetime('now'),
  1
FROM workout_sessions
WHERE status IN ('in_progress', 'paused')
  AND id NOT IN (
    SELECT id
    FROM workout_sessions
    WHERE status IN ('in_progress', 'paused')
    ORDER BY started_at DESC, id DESC
    LIMIT 1
  );

DELETE FROM workout_sessions
WHERE status IN ('in_progress', 'paused')
  AND id NOT IN (
    SELECT id
    FROM workout_sessions
    WHERE status IN ('in_progress', 'paused')
    ORDER BY started_at DESC, id DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS single_resumable_session
  ON workout_sessions ((1))
  WHERE status IN ('in_progress', 'paused');
CREATE INDEX IF NOT EXISTS workout_sessions_status_started_at_idx
  ON workout_sessions (status, started_at DESC, id DESC);
`;

/** Fresh test databases need the same final shape without a native migrator. */
export const BOOTSTRAP_SQL = `${CORE_SCHEMA_SQL}\n${MIGRATION_1_SQL}`;
