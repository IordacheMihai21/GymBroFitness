import { desc, eq } from 'drizzle-orm';

import { bodyMeasurementPayloadSchema, decodePayload, encodePayload } from '@/db/payload';
import { bodyMeasurementsTable, dataRecoveryTable } from '@/db/schema';
import type { GymBroDb } from '@/db/types';

import type { BodyMeasurementEntry } from './measurements';

/** Driver-agnostic SQL operations for body measurements — see `db/types.ts` for why. */

export function listBodyMeasurementsSql(db: GymBroDb): BodyMeasurementEntry[] {
  const rows = db
    .select()
    .from(bodyMeasurementsTable)
    .orderBy(desc(bodyMeasurementsTable.date), desc(bodyMeasurementsTable.id))
    .all();

  return rows.flatMap((row) => {
    const entry = decodeMeasurementRow(db, row.id, row.payload);
    return entry ? [entry] : [];
  });
}

export function saveBodyMeasurementSql(
  db: GymBroDb,
  entry: BodyMeasurementEntry,
): BodyMeasurementEntry {
  db.insert(bodyMeasurementsTable)
    .values({ id: entry.id, date: entry.date, payload: encodePayload(entry) })
    .onConflictDoUpdate({
      target: bodyMeasurementsTable.id,
      set: { date: entry.date, payload: encodePayload(entry) },
    })
    .run();
  return entry;
}

export function deleteBodyMeasurementSql(db: GymBroDb, id: string): void {
  db.delete(bodyMeasurementsTable).where(eq(bodyMeasurementsTable.id, id)).run();
}

function decodeMeasurementRow(
  db: GymBroDb,
  id: string,
  payload: unknown,
): BodyMeasurementEntry | null {
  const decoded = decodePayload(payload, bodyMeasurementPayloadSchema);
  if (!decoded.ok) {
    db.insert(dataRecoveryTable)
      .values({
        id: `body-measurement-read-${id}`,
        entityType: 'body_measurement',
        entityId: id,
        reason: decoded.reason,
        payload: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        migrationVersion: 1,
      })
      .onConflictDoNothing({ target: dataRecoveryTable.id })
      .run();
    return null;
  }

  if (decoded.legacy) {
    db.update(bodyMeasurementsTable)
      .set({ payload: encodePayload(decoded.data) })
      .where(eq(bodyMeasurementsTable.id, id))
      .run();
  }
  return decoded.data;
}
