import { findLastPerformedExercise, formatPreviousSet, previousSetAtIndex } from '../lastPerformance';
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

describe('findLastPerformedExercise', () => {
  it('returns null when no session trained the exercise', () => {
    const history = [makeSession('s1', '2026-09-01T00:00:00.000Z', [makeExercise('squat', [])])];
    expect(findLastPerformedExercise(history, 'bench')).toBeNull();
  });

  it('returns the first (newest) match given pre-sorted history', () => {
    const history = [
      makeSession('s1', '2026-09-10T00:00:00.000Z', [makeExercise('bench', [{ loadKg: 100, reps: 8 }])]),
      makeSession('s2', '2026-09-03T00:00:00.000Z', [makeExercise('bench', [{ loadKg: 90, reps: 8 }])]),
    ];
    const result = findLastPerformedExercise(history, 'bench');
    expect(result?.sets[0].loadKg).toBe(100);
  });
});

describe('previousSetAtIndex + formatPreviousSet', () => {
  it('formats a loaded set with RIR', () => {
    const exercise = makeExercise('bench', [{ loadKg: 100, reps: 8, rir: 2 }]);
    const set = previousSetAtIndex(exercise, 0);
    expect(formatPreviousSet(set)).toBe('Last: 100 kg × 8 @ RIR 2');
  });

  it('formats a time-tracked set', () => {
    const exercise = makeExercise('plank', [{ durationSeconds: 45 }]);
    expect(formatPreviousSet(previousSetAtIndex(exercise, 0))).toBe('Last: 45s');
  });

  it('returns null when there is no previous exercise or set index', () => {
    expect(previousSetAtIndex(null, 0)).toBeNull();
    const exercise = makeExercise('bench', [{ loadKg: 100, reps: 8 }]);
    expect(previousSetAtIndex(exercise, 5)).toBeNull();
  });
});
