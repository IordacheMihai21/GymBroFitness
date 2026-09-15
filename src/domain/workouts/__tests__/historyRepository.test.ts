import { createTestDb } from '@/db/createTestDb';
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

  it('prunes beyond the max stored session count, keeping the newest', () => {
    const db = createTestDb();
    for (let i = 0; i < 105; i++) {
      saveWorkoutSessionSql(
        db,
        makeSession({ id: `session-${i}`, startedAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z` }),
      );
    }
    expect(countWorkoutHistorySql(db)).toBe(100);
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
});

describe('clearWorkoutHistorySql', () => {
  it('removes every session', () => {
    const db = createTestDb();
    saveWorkoutSessionSql(db, makeSession());
    clearWorkoutHistorySql(db);
    expect(listWorkoutHistorySql(db)).toHaveLength(0);
  });
});
