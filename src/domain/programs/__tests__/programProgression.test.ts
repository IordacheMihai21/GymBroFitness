import type {
  ExercisePrescription,
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  WorkoutSession,
} from '@/types';

import { buildProgramProgressionSummary } from '../programProgression';

function prescription(
  exerciseId: string,
  patch: Partial<ExercisePrescription> = {},
): ExercisePrescription {
  return {
    exerciseId,
    order: 0,
    workingSets: 3,
    minReps: 6,
    maxReps: 8,
    targetRir: 1,
    restSeconds: 180,
    selectionReason: 'test',
    ...patch,
  };
}

function day(id: string, name: string, prescriptions: ExercisePrescription[]): ProgramDay {
  return {
    id,
    name,
    order: id === 'push' ? 0 : 1,
    focus: prescriptions[0]?.exerciseId === 'barbell-bench-press' ? ['chest'] : ['back'],
    prescriptions,
    estimatedMinutes: 60,
  };
}

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

function performed(
  exerciseId: string,
  sets: PerformedSet[],
  rx = prescription(exerciseId),
): PerformedExercise {
  return {
    id: `${exerciseId}-performed`,
    exerciseId,
    order: 0,
    prescription: rx,
    sets,
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

function session(id: string, date: string, exercises: PerformedExercise[]): WorkoutSession {
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
    exercises,
  };
}

describe('buildProgramProgressionSummary', () => {
  it('summarizes load jumps and calibration needs across an active program', () => {
    const bench = prescription('barbell-bench-press');
    const pulldown = prescription('lat-pulldown', { minReps: 8, maxReps: 12 });
    const days = [day('push', 'Push A', [bench]), day('pull', 'Pull A', [pulldown])];
    const history = [
      session('bench-1', '2026-09-08T10:00:00.000Z', [
        performed(
          'barbell-bench-press',
          [
            set('a', { loadKg: 100, reps: 8 }),
            set('b', { loadKg: 100, reps: 8 }),
            set('c', { loadKg: 100, reps: 8 }),
          ],
          bench,
        ),
      ]),
    ];

    const summary = buildProgramProgressionSummary({
      days,
      history,
      userExperience: 'intermediate',
      priorityMuscles: ['chest'],
    });

    expect(summary.actionCounts.increase_load).toBe(1);
    expect(summary.actionCounts.needs_more_data).toBe(1);
    expect(summary.readyToProgressCount).toBe(1);
    expect(summary.calibrationCount).toBe(1);
    expect(summary.headline).toContain('load jump');
    expect(summary.priorityTargets[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      action: 'increase_load',
      dayName: 'Push A',
    });
    expect(summary.days[0]).toMatchObject({
      dayName: 'Push A',
      readinessLabel: 'Load jump ready',
    });
    expect(summary.days[1]).toMatchObject({
      dayName: 'Pull A',
      readinessLabel: 'Calibrate',
    });
  });
});
