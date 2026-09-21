import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import { CORE_SCHEMA_SQL, DATABASE_VERSION, MIGRATION_1_SQL, schema } from './schema';
import type { GymBroDb } from './types';

/**
 * The real, on-device database. `drizzle-orm/expo-sqlite` and
 * `drizzle-orm/better-sqlite3` (used in tests, see the repository test files)
 * both extend the same `BaseSQLiteDatabase<'sync', ...>` — this is the only
 * file in the app that touches the concrete driver; everything else is
 * written against `GymBroDb`.
 *
 * Opened lazily, not as a module-load side effect: importing this file (even
 * transitively, e.g. through `historyStore.ts` from an unrelated test) must
 * not require a real SQLite native module to exist. Only calling `getDb()`
 * does.
 */
let instance: GymBroDb | null = null;

function openDb(): GymBroDb {
  const sqliteDb = SQLite.openDatabaseSync('gymbrofitness.db');
  sqliteDb.execSync(CORE_SCHEMA_SQL);
  migrateDb(sqliteDb);
  return drizzle(sqliteDb, { schema });
}

function migrateDb(sqliteDb: SQLite.SQLiteDatabase): void {
  const row = sqliteDb.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version > DATABASE_VERSION) {
    throw new Error(`Unsupported database version ${version}; app supports ${DATABASE_VERSION}.`);
  }

  const migrations = [{ version: 1, sql: MIGRATION_1_SQL }];
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    try {
      sqliteDb.execSync(
        `BEGIN IMMEDIATE;\n${migration.sql}\nPRAGMA user_version = ${migration.version};\nCOMMIT;`,
      );
    } catch (error) {
      try {
        sqliteDb.execSync('ROLLBACK;');
      } catch {
        // SQLite may already have rolled back the transaction itself.
      }
      throw error;
    }
    version = migration.version;
  }
}

export function getDb(): GymBroDb {
  if (!instance) instance = openDb();
  return instance;
}
