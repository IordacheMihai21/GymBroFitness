import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import { BOOTSTRAP_SQL, schema } from './schema';
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
  sqliteDb.execSync(BOOTSTRAP_SQL);
  return drizzle(sqliteDb, { schema });
}

export function getDb(): GymBroDb {
  if (!instance) instance = openDb();
  return instance;
}
