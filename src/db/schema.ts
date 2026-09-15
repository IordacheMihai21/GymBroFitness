import { sql } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { WorkoutTemplate } from '@/domain/programs/templates';
import type { WorkoutSession } from '@/types';

/**
 * Local SQLite is the on-device source of truth (see docs/PLAN.md, "Architecture
 * decision: local-first SQLite"). Each table follows the id + versioned-payload
 * shape used by LiftLog (github.com/LiamMorrow/LiftLog, same Expo/RN/React stack):
 * the full domain object — already a carefully-designed TS type — is stored as
 * JSON in `payload`, unchanged. Only the columns actually needed for querying,
 * sorting, or DB-level invariants are pulled out alongside it. This avoids a
 * deep-normalization ORM/domain-type mismatch while still getting real SQL
 * where it earns its keep (indexed sort, a uniqueness constraint the previous
 * AsyncStorage array never had).
 *
 * No version envelope on the payload yet (unlike LiftLog's `AnyVersionXJSON`
 * union types) — this app's domain types already evolve via optional fields
 * (see `PerformedSet.technique`/`subEfforts`), which is sufficient at this
 * scale. Revisit if a payload shape ever needs a breaking (non-additive) change.
 */

export const workoutSessionsTable = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    startedAt: text('started_at').notNull(),
    status: text('status').notNull(),
    payload: text('payload', { mode: 'json' }).$type<WorkoutSession>().notNull(),
  },
  (table) => [
    // At most one in-progress session at a time — enforced by the database
    // itself instead of application code remembering to check.
    uniqueIndex('single_in_progress_session')
      .on(table.status)
      .where(sql`${table.status} = 'in_progress'`),
    uniqueIndex('single_paused_session')
      .on(table.status)
      .where(sql`${table.status} = 'paused'`),
  ],
);

export const workoutTemplatesTable = sqliteTable('workout_templates', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  payload: text('payload', { mode: 'json' }).$type<WorkoutTemplate>().notNull(),
});

export const schema = { workoutSessionsTable, workoutTemplatesTable };
export type GymBroSchema = typeof schema;

/**
 * Bootstrap DDL, hand-written and idempotent (`IF NOT EXISTS`) rather than a
 * drizzle-kit migration pipeline — this app's schema is two small tables with
 * no relational constraints between them, so a migrations folder that has to
 * be bundled into the native app (expo-sqlite can't read arbitrary files off
 * disk at runtime the way `drizzle-kit`'s Node-side migrator does) is more
 * infrastructure than the current scale justifies. Revisit with real
 * drizzle-kit migrations if the schema needs a genuine ALTER TABLE later.
 */
export const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS single_in_progress_session
  ON workout_sessions (status)
  WHERE status = 'in_progress';
CREATE UNIQUE INDEX IF NOT EXISTS single_paused_session
  ON workout_sessions (status)
  WHERE status = 'paused';

CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
`;
