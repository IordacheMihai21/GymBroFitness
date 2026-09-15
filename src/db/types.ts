import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { GymBroSchema } from './schema';

/**
 * Driver-agnostic db type: `drizzle-orm/expo-sqlite` (the real app) and
 * `drizzle-orm/better-sqlite3` (tests) both produce a subclass of this same
 * base — see the note in `client.ts`. Repository code is written against
 * this type so the exact same query logic runs, unmocked, in both places.
 */
export type GymBroDb = BaseSQLiteDatabase<'sync', unknown, GymBroSchema>;
