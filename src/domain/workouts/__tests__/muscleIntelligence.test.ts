import {
  buildExerciseRecordsForMuscle,
  buildMuscleIntelligence,
  buildProgramExercisesForMuscle,
} from '../muscleIntelligence';
import type { PerformedExercise, PerformedSet, ProgramDay, WorkoutSession } from '@/types';

function makeSet(id: string, patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id,
    setNumber: 1,
    kind: 'working',
    loadKg: 100,
    reps: 8,
    durationSeconds: null,
    rir: 1,
    completed: true,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function makeExercise(exerciseId: string, sets: PerformedSet[]): PerformedExercise {
  return {
    id: `${exerciseId}-performed`,
    exerciseId,
    order: 0,
    prescription: {
      exerciseId,
      order: 0,
      workingSets: sets.length,
      minReps: 6,
      maxReps: 10,
      targetRir: 1,
      restSeconds: 120,
      selectionReason: 'test',
    },
    sets,
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

function makeSession(
  id: string,
  startedAt: string,
  exercises: PerformedExercise[],
): WorkoutSession {
  return {
    id,
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Upper A',
    status: 'completed',
    startedAt,
    finishedAt: startedAt,
    exercises,
    totalPausedSeconds: 0,
  };
}

function programDay(): ProgramDay {
  return {
    id: 'upper-a',
    name: 'Upper A',
    order: 0,
    focus: ['chest', 'back'],
    estimatedMinutes: 60,
    prescriptions: [
      {
        exerciseId: 'barbell-bench-press',
        order: 0,
        workingSets: 3,
        minReps: 6,
        maxReps: 10,
        targetRir: 1,
        restSeconds: 180,
        selectionReason: 'test',
      },
      {
        exerciseId: 'pull-up',
        order: 1,
        workingSets: 4,
        minReps: 6,
        maxReps: 10,
        targetRir: 1,
        restSeconds: 180,
        selectionReason: 'test',
      },
    ],
  };
}

describe('muscle intelligence', () => {
  it('extracts primary and secondary program exercises for a selected muscle', () => {
    const chestExercises = buildProgramExercisesForMuscle([programDay()], 'chest');
    const tricepsExercises = buildProgramExercisesForMuscle([programDay()], 'triceps');

    expect(chestExercises[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      role: 'primary',
      workingSets: 3,
      repRangeLabel: '6-10 reps',
    });
    expect(tricepsExercises[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      role: 'secondary',
    });
  });

  it('summarizes records and last-session set count by muscle', () => {
    const history = [
      makeSession('new', '2026-09-14T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [
          makeSet('a', { loadKg: 105, reps: 7 }),
          makeSet('b', { loadKg: 100, reps: 8 }),
        ]),
      ]),
      makeSession('old', '2026-09-07T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [
          makeSet('c', { loadKg: 100, reps: 8 }),
        ]),
      ]),
    ];

    const records = buildExerciseRecordsForMuscle('chest', history);

    expect(records[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      totalSets: 3,
      lastSessionSets: 2,
      bestLoadKg: 105,
    });
    expect(records[0].bestE1rmKg).toBeGreaterThan(120);
  });

  it('computes fatigue and strength rank from completed workout data', () => {
    const history = [
      makeSession('upper', '2026-09-14T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [
          makeSet('a', { loadKg: 105, reps: 7, rir: 1 }),
          makeSet('b', { loadKg: 100, reps: 8, rir: 1 }),
        ]),
      ]),
      makeSession('lower', '2026-09-13T10:00:00.000Z', [
        makeExercise('barbell-back-squat', [
          makeSet('c', { loadKg: 140, reps: 5, rir: 2 }),
        ]),
      ]),
    ];

    const intelligence = buildMuscleIntelligence(
      [programDay()],
      history,
      new Date('2026-09-14T12:00:00.000Z'),
    );
    const chest = intelligence.find((item) => item.muscle === 'chest');
    const quads = intelligence.find((item) => item.muscle === 'quadriceps');

    expect(chest?.fatigue.weeklySets).toBe(2);
    expect(chest?.fatigue.lastSessionSets).toBe(2);
    expect(chest?.fatigue.label).not.toBe('Fresh');
    expect(quads?.rank.rank).toBe(1);
    expect(chest?.rank.rank).toBe(2);
  });
});
