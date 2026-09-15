import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { BOOTSTRAP_SQL, schema } from './schema';
import type { GymBroDb } from './types';

/**
 * Test-only: an in-memory SQLite database running the exact same bootstrap
 * DDL and schema as the real app, via `drizzle-orm/better-sqlite3` instead
 * of `drizzle-orm/expo-sqlite`. Repository functions are written against the
 * shared `GymBroDb` type, so this exercises the real query logic — not a
 * hand-rolled fake — which matters here specifically because on-device
 * verification is currently blocked (see docs/PLAN.md); this is the only way
 * the SQLite layer gets meaningfully tested before that's resolved.
 */
export function createTestDb(): GymBroDb {
  const sqlite = new Database(':memory:');
  sqlite.exec(BOOTSTRAP_SQL);
  return drizzle(sqlite, { schema }) as unknown as GymBroDb;
}
