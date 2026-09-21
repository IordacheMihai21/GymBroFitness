import { createTestDb } from '@/db/createTestDb';
import type { WorkoutSession } from '@/types';

import { countWorkoutHistorySql, listWorkoutHistorySql } from '../historyRepository';
import { migrateLegacyHistory } from '../historyStore';

function makeSession(patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'legacy-session-1',
    userId: 'user-1',
    programId: null,
    programDayId: 'upper-a',
    dayName: 'Upper A',
    status: 'completed',
    startedAt: '2026-09-14T10:00:00.000Z',
    finishedAt: '2026-09-14T11:00:00.000Z',
    exercises: [],
    totalPausedSeconds: 0,
    ...patch,
  };
}

function makeStorage(raw: string | null, removeItem = jest.fn().mockResolvedValue(undefined)) {
  return {
    getItem: jest.fn().mockResolvedValue(raw),
    removeItem,
  };
}

describe('migrateLegacyHistory', () => {
  it('imports valid history and removes the legacy key only after success', async () => {
    const db = createTestDb();
    const storage = makeStorage(JSON.stringify([makeSession()]));

    await migrateLegacyHistory(storage, db);

    expect(listWorkoutHistorySql(db)).toEqual([makeSession()]);
    expect(storage.removeItem).toHaveBeenCalledWith('@GymBroFitness/workout-history/v1');
  });

  it('keeps malformed legacy data for recovery', async () => {
    const db = createTestDb();
    const storage = makeStorage('{broken-json');

    await migrateLegacyHistory(storage, db);

    expect(countWorkoutHistorySql(db)).toBe(0);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('keeps the full legacy payload when any record is invalid', async () => {
    const db = createTestDb();
    const storage = makeStorage(JSON.stringify([makeSession(), { id: 'incomplete' }]));

    await migrateLegacyHistory(storage, db);

    expect(countWorkoutHistorySql(db)).toBe(0);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('is safe to retry when removal of the legacy key fails', async () => {
    const db = createTestDb();
    const session = makeSession();
    const firstStorage = makeStorage(
      JSON.stringify([session]),
      jest.fn().mockRejectedValue(new Error('storage unavailable')),
    );

    await expect(migrateLegacyHistory(firstStorage, db)).rejects.toThrow('storage unavailable');
    expect(countWorkoutHistorySql(db)).toBe(1);

    const retryStorage = makeStorage(JSON.stringify([session]));
    await migrateLegacyHistory(retryStorage, db);

    expect(countWorkoutHistorySql(db)).toBe(1);
    expect(retryStorage.removeItem).toHaveBeenCalledTimes(1);
  });

  it('does not remove legacy data when the transactional import fails', async () => {
    const db = createTestDb();
    const storage = makeStorage(
      JSON.stringify([
        makeSession({ id: 'draft-a', status: 'in_progress' }),
        makeSession({ id: 'draft-b', status: 'in_progress' }),
      ]),
    );

    await expect(migrateLegacyHistory(storage, db)).rejects.toThrow();

    expect(countWorkoutHistorySql(db)).toBe(0);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
