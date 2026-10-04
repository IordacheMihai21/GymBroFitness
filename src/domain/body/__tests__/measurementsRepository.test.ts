import { createTestDb } from '@/db/createTestDb';

import { createBodyMeasurementEntry, type BodyMeasurementEntry } from '../measurements';
import {
  deleteBodyMeasurementSql,
  listBodyMeasurementsSql,
  saveBodyMeasurementSql,
} from '../measurementsRepository';

function makeEntry(patch: Partial<BodyMeasurementEntry> = {}): BodyMeasurementEntry {
  return createBodyMeasurementEntry({
    userId: 'user-1',
    date: '2026-09-01',
    bodyWeightKg: 80,
    measurementsCm: { waist: 85 },
    now: () => '2026-09-01T08:00:00.000Z',
    ...patch,
  });
}

describe('body measurements repository', () => {
  it('round-trips a saved entry', () => {
    const db = createTestDb();
    const entry = makeEntry();
    saveBodyMeasurementSql(db, entry);
    expect(listBodyMeasurementsSql(db)).toEqual([entry]);
  });

  it('lists entries newest date first', () => {
    const db = createTestDb();
    const older = makeEntry({ date: '2026-09-01' });
    const newer = makeEntry({ date: '2026-09-10' });
    saveBodyMeasurementSql(db, older);
    saveBodyMeasurementSql(db, newer);
    expect(listBodyMeasurementsSql(db).map((e) => e.id)).toEqual([newer.id, older.id]);
  });

  it('upserts by id instead of duplicating on a second save', () => {
    const db = createTestDb();
    const entry = makeEntry();
    saveBodyMeasurementSql(db, entry);
    saveBodyMeasurementSql(db, { ...entry, bodyWeightKg: 79 });
    const rows = listBodyMeasurementsSql(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].bodyWeightKg).toBe(79);
  });

  it('deletes an entry by id', () => {
    const db = createTestDb();
    const entry = makeEntry();
    saveBodyMeasurementSql(db, entry);
    deleteBodyMeasurementSql(db, entry.id);
    expect(listBodyMeasurementsSql(db)).toEqual([]);
  });
});
