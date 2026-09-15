import { buildExerciseTrend } from '../exerciseTrend';
import type { PerformedExercise, WorkoutSession } from '@/types';

function makeSession(id: string, startedAt: string, exercises: PerformedExercise[]): WorkoutSession {
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

function makeExercise(exerciseId: string, sets: Partial<PerformedExercise['sets'][number]>[]): PerformedExercise {
  return {
    id: `performed-${exerciseId}`,
    exerciseId,
    order: 0,
    markedDiscomfort: false,
    markedUnavailable: false,
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
    sets: sets.map((s, i) => ({
      id: `set-${i}`,
      setNumber: i + 1,
      kind: 'working',
      loadKg: null,
      reps: null,
      durationSeconds: null,
      rir: null,
      completed: true,
      skipped: false,
      completedAt: null,
      ...s,
    })),
  };
}

describe('buildExerciseTrend', () => {
  it('returns an empty trend when the exercise was never trained', () => {
    const history = [makeSession('s1', '2026-09-01T00:00:00.000Z', [makeExercise('squat', [])])];
    expect(buildExerciseTrend(history, 'bench')).toEqual([]);
  });

  it('skips sessions with no completed sets for the exercise', () => {
    const history = [
      makeSession('s1', '2026-09-01T00:00:00.000Z', [
        makeExercise('bench', [{ loadKg: 100, reps: 5, completed: false }]),
      ]),
    ];
    expect(buildExerciseTrend(history, 'bench')).toEqual([]);
  });

  it('sorts oldest-first regardless of input order', () => {
    const history = [
      makeSession('newer', '2026-09-10T00:00:00.000Z', [makeExercise('bench', [{ loadKg: 100, reps: 8 }])]),
      makeSession('older', '2026-09-01T00:00:00.000Z', [makeExercise('bench', [{ loadKg: 90, reps: 8 }])]),
    ];
    const trend = buildExerciseTrend(history, 'bench');
    expect(trend.map((p) => p.sessionId)).toEqual(['older', 'newer']);
  });

  it('computes e1RM and volume per session', () => {
    const history = [
      makeSession('s1', '2026-09-01T00:00:00.000Z', [
        makeExercise('bench', [
          { loadKg: 100, reps: 8 },
          { loadKg: 100, reps: 6 },
        ]),
      ]),
    ];
    const [point] = buildExerciseTrend(history, 'bench');
    expect(point.completedSets).toBe(2);
    expect(point.volumeKg).toBe(100 * 8 + 100 * 6);
    expect(point.e1rmKg).toBeCloseTo(126.7, 1);
  });
});
