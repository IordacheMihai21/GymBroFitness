import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';

import { createTestDb } from '../createTestDb';
import { decodePayload, workoutSessionPayloadSchema } from '../payload';
import {
  CORE_SCHEMA_SQL,
  MIGRATION_1_SQL,
  workoutSessionsTable,
  workoutTemplatesTable,
} from '../schema';
import type { WorkoutSession } from '@/types';

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

describe('workout_sessions table', () => {
  it('round-trips a full WorkoutSession through the JSON payload column', () => {
    const db = createTestDb();
    const session = makeSession({
      readiness: {
        energy: 4,
        sleepQuality: 3,
        recovery: 2,
        soreness: { chest: 1 },
        hasPain: false,
      },
      exercises: [
        {
          id: 'performed-1',
          exerciseId: 'barbell-bench-press',
          order: 0,
          markedDiscomfort: false,
          markedUnavailable: false,
          prescription: {
            exerciseId: 'barbell-bench-press',
            order: 0,
            workingSets: 1,
            minReps: 6,
            maxReps: 10,
            targetRir: 2,
            restSeconds: 120,
            selectionReason: 'test',
          },
          sets: [
            {
              id: 'set-1',
              setNumber: 1,
              kind: 'working',
              loadKg: 100,
              reps: 8,
              durationSeconds: null,
              rir: 2,
              completed: true,
              skipped: false,
              completedAt: null,
              technique: 'drop_set',
              subEfforts: [{ loadKg: 80, reps: 6, restSeconds: 0 }],
            },
          ],
        },
      ],
    });

    db.insert(workoutSessionsTable)
      .values({
        id: session.id,
        startedAt: session.startedAt,
        status: session.status,
        payload: session,
      })
      .run();

    const [row] = db
      .select()
      .from(workoutSessionsTable)
      .where(eq(workoutSessionsTable.id, session.id))
      .all();

    const decoded = decodePayload(row.payload, workoutSessionPayloadSchema);
    expect(decoded).toMatchObject({ ok: true, data: session });
    // Specifically confirm the nested sub-effort (the newest, most nested part
    // of the domain model) survives the JSON round-trip intact.
    expect(decoded.ok && decoded.data.exercises[0].sets[0].subEfforts).toEqual([
      { loadKg: 80, reps: 6, restSeconds: 0 },
    ]);
    expect(decoded.ok && decoded.data.readiness).toEqual(session.readiness);
  });

  it('enforces at most one in-progress session at the database level', () => {
    const db = createTestDb();
    db.insert(workoutSessionsTable)
      .values({
        id: 'a',
        startedAt: '2026-09-14T10:00:00.000Z',
        status: 'in_progress',
        payload: makeSession({ id: 'a' }),
      })
      .run();

    expect(() => {
      db.insert(workoutSessionsTable)
        .values({
          id: 'b',
          startedAt: '2026-09-14T11:00:00.000Z',
          status: 'in_progress',
          payload: makeSession({ id: 'b' }),
        })
        .run();
    }).toThrow();
  });

  it('allows multiple completed sessions (the unique index only applies to in_progress)', () => {
    const db = createTestDb();
    db.insert(workoutSessionsTable)
      .values([
        {
          id: 'a',
          startedAt: '2026-09-14T10:00:00.000Z',
          status: 'completed',
          payload: makeSession({ id: 'a', status: 'completed' }),
        },
        {
          id: 'b',
          startedAt: '2026-09-14T11:00:00.000Z',
          status: 'completed',
          payload: makeSession({ id: 'b', status: 'completed' }),
        },
      ])
      .run();

    const rows = db.select().from(workoutSessionsTable).all();
    expect(rows).toHaveLength(2);
  });

  it('treats paused and in-progress as the same resumable draft invariant', () => {
    const db = createTestDb();
    db.insert(workoutSessionsTable)
      .values({
        id: 'paused',
        startedAt: '2026-09-14T10:00:00.000Z',
        status: 'paused',
        payload: makeSession({ id: 'paused', status: 'paused' }),
      })
      .run();

    expect(() => {
      db.insert(workoutSessionsTable)
        .values({
          id: 'active',
          startedAt: '2026-09-14T11:00:00.000Z',
          status: 'in_progress',
          payload: makeSession({ id: 'active' }),
        })
        .run();
    }).toThrow();
  });
});

describe('database migration 1', () => {
  it('backs up existing rows and consolidates legacy resumable drafts before indexing', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(CORE_SCHEMA_SQL);
    const insert = sqlite.prepare(
      'INSERT INTO workout_sessions (id, started_at, status, payload) VALUES (?, ?, ?, ?)',
    );
    insert.run(
      'older-paused',
      '2026-09-14T10:00:00.000Z',
      'paused',
      JSON.stringify(makeSession({ id: 'older-paused', status: 'paused' })),
    );
    insert.run(
      'newer-active',
      '2026-09-14T11:00:00.000Z',
      'in_progress',
      JSON.stringify(makeSession({ id: 'newer-active' })),
    );

    sqlite.exec(`BEGIN IMMEDIATE;${MIGRATION_1_SQL}PRAGMA user_version = 1;COMMIT;`);

    expect(
      sqlite.prepare('SELECT id FROM workout_sessions ORDER BY started_at DESC').all(),
    ).toEqual([{ id: 'newer-active' }]);
    expect(
      sqlite
        .prepare("SELECT entity_id FROM data_recovery WHERE reason = 'extra_resumable_draft'")
        .all(),
    ).toEqual([{ entity_id: 'older-paused' }]);
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM data_recovery WHERE reason = 'pre_migration_backup'",
        )
        .get(),
    ).toEqual({ count: 2 });
    expect(() =>
      insert.run(
        'second-active',
        '2026-09-14T12:00:00.000Z',
        'in_progress',
        JSON.stringify(makeSession({ id: 'second-active' })),
      ),
    ).toThrow();
    sqlite.close();
  });
});

describe('workout_templates table', () => {
  it('round-trips a WorkoutTemplate through the JSON payload column', () => {
    const db = createTestDb();
    const template = {
      id: 'template-1',
      name: 'Upper A template',
      createdAt: '2026-09-14T10:00:00.000Z',
      sourceSessionId: 'session-1',
      day: {
        id: 'day-1',
        name: 'Upper A',
        order: 0,
        focus: ['chest' as const],
        prescriptions: [],
        estimatedMinutes: 45,
      },
    };

    db.insert(workoutTemplatesTable)
      .values({ id: template.id, createdAt: template.createdAt, payload: template })
      .run();

    const [row] = db
      .select()
      .from(workoutTemplatesTable)
      .where(eq(workoutTemplatesTable.id, template.id))
      .all();

    expect(row.payload).toEqual(template);
  });
});
