import { createTestDb } from '@/db/createTestDb';
import { dataRecoveryTable, workoutSessionsTable } from '@/db/schema';
import type { WorkoutSession } from '@/types';

import {
  clearWorkoutHistorySql,
  countWorkoutHistorySql,
  discardInProgressWorkoutSessionSql,
  getInProgressWorkoutSessionSql,
  importSessionsSql,
  listWorkoutHistorySql,
  saveInProgressWorkoutSessionSql,
  saveWorkoutSessionSql,
} from '../historyRepository';

function makeSession(patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: 'upper-a',
    dayName: 'Upper A',
    status: 'in_progress',
    startedAt: '2026-09-14T10:00:00.000Z',
    finishedAt: null,
    exercises: [],
    totalPausedSeconds: 0,
    ...patch,
  };
}

describe('saveWorkoutSessionSql', () => {
  it('marks the session completed and stamps finishedAt when missing', () => {
    const db = createTestDb();
    const saved = saveWorkoutSessionSql(db, makeSession());
    expect(saved.status).toBe('completed');
    expect(saved.finishedAt).not.toBeNull();
  });

  it('upserts by id instead of duplicating on a second save', () => {
    const db = createTestDb();
    saveWorkoutSessionSql(db, makeSession({ dayName: 'Upper A' }));
    saveWorkoutSessionSql(db, makeSession({ dayName: 'Upper A (edited)' }));

    const history = listWorkoutHistorySql(db);
    expect(history).toHaveLength(1);
    expect(history[0].dayName).toBe('Upper A (edited)');
  });

  it('preserves history beyond 100 sessions', () => {
    const db = createTestDb();
    for (let i = 0; i < 105; i++) {
      saveWorkoutSessionSql(
        db,
        makeSession({
          id: `session-${i}`,
          startedAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
        }),
      );
    }
    expect(countWorkoutHistorySql(db)).toBe(105);
  });
});

describe('listWorkoutHistorySql', () => {
  it('returns sessions newest-first', () => {
    const db = createTestDb();
    saveWorkoutSessionSql(db, makeSession({ id: 'older', startedAt: '2026-09-01T00:00:00.000Z' }));
    saveWorkoutSessionSql(db, makeSession({ id: 'newer', startedAt: '2026-09-10T00:00:00.000Z' }));

    const history = listWorkoutHistorySql(db);
    expect(history.map((s) => s.id)).toEqual(['newer', 'older']);
  });

  it('does not include active drafts in workout history', () => {
    const db = createTestDb();
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft' }));
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'paused', status: 'paused' }));
    saveWorkoutSessionSql(db, makeSession({ id: 'complete' }));

    expect(listWorkoutHistorySql(db).map((s) => s.id)).toEqual(['complete']);
  });

  it('supports stable limit/offset pagination without deleting older sessions', () => {
    const db = createTestDb();
    for (let i = 0; i < 5; i++) {
      saveWorkoutSessionSql(
        db,
        makeSession({ id: `session-${i}`, startedAt: `2026-09-0${i + 1}T00:00:00.000Z` }),
      );
    }

    expect(listWorkoutHistorySql(db, { limit: 2 }).map((session) => session.id)).toEqual([
      'session-4',
      'session-3',
    ]);
    expect(listWorkoutHistorySql(db, { limit: 2, offset: 2 }).map((session) => session.id)).toEqual(
      ['session-2', 'session-1'],
    );
    expect(countWorkoutHistorySql(db)).toBe(5);
  });
});

describe('in-progress workout drafts', () => {
  it('saves and retrieves the current in-progress session', () => {
    const db = createTestDb();
    const draft = saveInProgressWorkoutSessionSql(
      db,
      makeSession({ id: 'draft', dayName: 'Upper A' }),
    );

    expect(draft.status).toBe('in_progress');
    expect(draft.finishedAt).toBeNull();
    expect(getInProgressWorkoutSessionSql(db)?.dayName).toBe('Upper A');
  });

  it('preserves paused drafts as resumable sessions', () => {
    const db = createTestDb();
    const draft = saveInProgressWorkoutSessionSql(
      db,
      makeSession({ id: 'draft', status: 'paused', dayName: 'Upper A' }),
    );

    expect(draft.status).toBe('paused');
    expect(getInProgressWorkoutSessionSql(db)?.status).toBe('paused');
  });

  it('upserts the same draft instead of duplicating it', () => {
    const db = createTestDb();
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft', dayName: 'Upper A' }));
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft', dayName: 'Upper A edited' }));

    expect(countWorkoutHistorySql(db)).toBe(1);
    expect(getInProgressWorkoutSessionSql(db)?.dayName).toBe('Upper A edited');
  });

  it('replaces an older in-progress draft when a different workout starts', () => {
    const db = createTestDb();
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft-a', dayName: 'Upper A' }));
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft-b', dayName: 'Lower A' }));

    expect(countWorkoutHistorySql(db)).toBe(1);
    expect(getInProgressWorkoutSessionSql(db)?.id).toBe('draft-b');
  });

  it('replaces a paused draft when a different workout starts', () => {
    const db = createTestDb();
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'paused-a', status: 'paused' }));
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft-b', status: 'in_progress' }));

    expect(countWorkoutHistorySql(db)).toBe(1);
    expect(getInProgressWorkoutSessionSql(db)?.id).toBe('draft-b');
  });

  it('rolls back deletion of the old draft if writing the replacement fails', () => {
    const db = createTestDb();
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft-a' }));
    const invalid = makeSession({ id: 'draft-b' }) as WorkoutSession & { self?: unknown };
    invalid.self = invalid;

    expect(() => saveInProgressWorkoutSessionSql(db, invalid)).toThrow();
    expect(getInProgressWorkoutSessionSql(db)?.id).toBe('draft-a');
  });

  it('discards an in-progress draft by id', () => {
    const db = createTestDb();
    saveInProgressWorkoutSessionSql(db, makeSession({ id: 'draft' }));
    discardInProgressWorkoutSessionSql(db, 'draft');

    expect(getInProgressWorkoutSessionSql(db)).toBeNull();
  });
});

describe('importSessionsSql', () => {
  it('preserves the original status instead of forcing completed', () => {
    const db = createTestDb();
    importSessionsSql(db, [makeSession({ status: 'discarded' })]);
    expect(countWorkoutHistorySql(db)).toBe(1);
  });

  it('is idempotent — importing the same session twice does not duplicate it', () => {
    const db = createTestDb();
    const session = makeSession();
    importSessionsSql(db, [session]);
    importSessionsSql(db, [session]);
    expect(countWorkoutHistorySql(db)).toBe(1);
  });

  it('rolls back the whole batch when a later insert fails', () => {
    const db = createTestDb();
    const twoActiveDrafts = [makeSession({ id: 'draft-a' }), makeSession({ id: 'draft-b' })];

    expect(() => importSessionsSql(db, twoActiveDrafts)).toThrow();
    expect(countWorkoutHistorySql(db)).toBe(0);
  });
});

describe('clearWorkoutHistorySql', () => {
  it('removes every session', () => {
    const db = createTestDb();
    saveWorkoutSessionSql(db, makeSession());
    clearWorkoutHistorySql(db);
    expect(listWorkoutHistorySql(db)).toHaveLength(0);
  });
});

describe('versioned workout payloads', () => {
  it('upgrades a valid legacy payload when it is read', () => {
    const db = createTestDb();
    const session = makeSession({ id: 'legacy', status: 'completed' });
    db.insert(workoutSessionsTable)
      .values({
        id: session.id,
        startedAt: session.startedAt,
        status: session.status,
        payload: session,
      })
      .run();

    expect(listWorkoutHistorySql(db).map((item) => item.id)).toEqual(['legacy']);
    const row = db.select().from(workoutSessionsTable).all()[0];
    expect(row.payload).toMatchObject({ schemaVersion: 1, data: { id: 'legacy' } });
  });

  it('quarantines an unknown payload version without deleting its source row', () => {
    const db = createTestDb();
    const session = makeSession({ id: 'future', status: 'completed' });
    db.insert(workoutSessionsTable)
      .values({
        id: session.id,
        startedAt: session.startedAt,
        status: session.status,
        payload: { schemaVersion: 99, data: session } as never,
      })
      .run();

    expect(listWorkoutHistorySql(db)).toEqual([]);
    expect(countWorkoutHistorySql(db)).toBe(1);
    expect(db.select().from(dataRecoveryTable).all()).toEqual([
      expect.objectContaining({
        entityId: 'future',
        reason: 'unknown_payload_version',
      }),
    ]);
  });
});
