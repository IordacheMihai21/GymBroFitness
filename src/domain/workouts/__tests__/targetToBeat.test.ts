import type {
  ExercisePrescription,
  PerformedExercise,
  PerformedSet,
  WorkoutSession,
} from '@/types';

import {
  buildLatestExerciseProgressionTarget,
  buildProgressionTarget,
  formatProgressionSignal,
} from '../targetToBeat';

const prescription: ExercisePrescription = {
  exerciseId: 'barbell-bench-press',
  order: 0,
  workingSets: 3,
  minReps: 6,
  maxReps: 8,
  targetRir: 1,
  restSeconds: 180,
  selectionReason: 'test',
};

function set(id: string, patch: Partial<PerformedSet> = {}): PerformedSet {
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
    completedAt: '2026-09-14T10:10:00.000Z',
    ...patch,
  };
}

function exercise(sets: PerformedSet[]): PerformedExercise {
  return {
    id: 'bench-performed',
    exerciseId: 'barbell-bench-press',
    order: 0,
    prescription,
    sets,
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

function session(id: string, date: string, sets: PerformedSet[]): WorkoutSession {
  return {
    id,
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Push A',
    status: 'completed',
    startedAt: date,
    finishedAt: date,
    totalPausedSeconds: 0,
    exercises: [exercise(sets)],
  };
}

describe('progression targets', () => {
  it('calibrates when no history exists for the prescription', () => {
    const target = buildProgressionTarget({
      prescription,
      history: [],
      userExperience: 'intermediate',
    });

    expect(target.decision.action).toBe('needs_more_data');
    expect(target.lastSignal).toBeNull();
    expect(target.targetText).toContain('Calibrate');
  });

  it('uses the latest completed session to recommend the next load', () => {
    const target = buildProgressionTarget({
      prescription,
      history: [
        session('old', '2026-09-01T10:00:00.000Z', [
          set('a', { loadKg: 95, reps: 8 }),
          set('b', { loadKg: 95, reps: 8 }),
          set('c', { loadKg: 95, reps: 8 }),
        ]),
        session('new', '2026-09-08T10:00:00.000Z', [
          set('d', { loadKg: 100, reps: 8 }),
          set('e', { loadKg: 100, reps: 8 }),
          set('f', { loadKg: 100, reps: 8 }),
        ]),
      ],
      userExperience: 'intermediate',
    });

    expect(target.decision.action).toBe('increase_load');
    expect(target.decision.nextLoad).toBeGreaterThan(100);
    expect(target.lastSignal).toMatchObject({ sessionId: 'new', loadKg: 100, reps: 8 });
    expect(target.targetSummary).toContain('Add load');
  });

  it('builds an exercise detail target from the latest saved prescription', () => {
    const target = buildLatestExerciseProgressionTarget({
      exerciseId: 'barbell-bench-press',
      history: [
        session('new', '2026-09-08T10:00:00.000Z', [
          set('d', { loadKg: 100, reps: 7 }),
          set('e', { loadKg: 100, reps: 7 }),
        ]),
      ],
      userExperience: 'intermediate',
    });

    expect(target?.exerciseName).toBe('Barbell Bench Press');
    expect(target?.decision.action).toBe('increase_reps');
    expect(formatProgressionSignal(target?.lastSignal ?? null)).toContain('100 kg');
  });
});
