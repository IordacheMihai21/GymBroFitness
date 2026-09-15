import { eq } from 'drizzle-orm';

import { createTestDb } from '../createTestDb';
import { workoutSessionsTable, workoutTemplatesTable } from '../schema';
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
      .values({ id: session.id, startedAt: session.startedAt, status: session.status, payload: session })
      .run();

    const [row] = db.select().from(workoutSessionsTable).where(eq(workoutSessionsTable.id, session.id)).all();

    expect(row.payload).toEqual(session);
    // Specifically confirm the nested sub-effort (the newest, most nested part
    // of the domain model) survives the JSON round-trip intact.
    expect(row.payload.exercises[0].sets[0].subEfforts).toEqual([{ loadKg: 80, reps: 6, restSeconds: 0 }]);
  });

  it('enforces at most one in-progress session at the database level', () => {
    const db = createTestDb();
    db.insert(workoutSessionsTable)
      .values({ id: 'a', startedAt: '2026-09-14T10:00:00.000Z', status: 'in_progress', payload: makeSession({ id: 'a' }) })
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
