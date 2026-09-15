import { buildActivityHeatmap } from '../activityHeatmap';
import type { PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

function makeSet(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
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
    ...patch,
  };
}

function makeExercise(patch: Partial<PerformedExercise> = {}): PerformedExercise {
  return {
    id: 'performed-a',
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
    sets: [makeSet()],
    ...patch,
  };
}

function makeSession(patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: 'upper-a',
    dayName: 'Upper A',
    status: 'completed',
    startedAt: '2026-09-10T10:00:00.000Z',
    finishedAt: '2026-09-10T11:00:00.000Z',
    exercises: [makeExercise()],
    totalPausedSeconds: 0,
    ...patch,
  };
}

const NOW = new Date('2026-09-14T12:00:00.000Z');

describe('buildActivityHeatmap', () => {
  it('produces one entry per calendar day in the trailing window, oldest first', () => {
    const heatmap = buildActivityHeatmap([], 1, NOW);
    expect(heatmap.days).toHaveLength(7);
    expect(heatmap.days[0].date).toBe('2026-09-08');
    expect(heatmap.days[6].date).toBe('2026-09-14');
    expect(heatmap.days.every((d) => d.level === 0)).toBe(true);
  });

  it('buckets a finished session into its calendar day with real volume', () => {
    const heatmap = buildActivityHeatmap([makeSession()], 2, NOW);
    const day = heatmap.days.find((d) => d.date === '2026-09-10');
    expect(day?.completedSets).toBe(1);
    expect(day?.volumeKg).toBe(800); // 100kg x 8 reps
    expect(day?.level).toBe(4); // the only trained day is the window's busiest
    expect(heatmap.totalWorkouts).toBe(1);
    expect(heatmap.totalVolumeKg).toBe(800);
  });

  it('ignores sessions with no finishedAt (in-progress/discarded)', () => {
    const heatmap = buildActivityHeatmap(
      [makeSession({ finishedAt: null, status: 'in_progress' })],
      2,
      NOW,
    );
    expect(heatmap.totalWorkouts).toBe(0);
    expect(heatmap.days.every((d) => d.level === 0)).toBe(true);
  });

  it('ignores sessions with zero completed working sets', () => {
    const heatmap = buildActivityHeatmap(
      [makeSession({ exercises: [makeExercise({ sets: [makeSet({ completed: false })] })] })],
      2,
      NOW,
    );
    expect(heatmap.totalWorkouts).toBe(0);
  });

  it('merges two same-day sessions into one day', () => {
    const heatmap = buildActivityHeatmap(
      [
        makeSession({ id: 'a', finishedAt: '2026-09-10T09:00:00.000Z' }),
        makeSession({ id: 'b', finishedAt: '2026-09-10T18:00:00.000Z' }),
      ],
      2,
      NOW,
    );
    const day = heatmap.days.find((d) => d.date === '2026-09-10');
    expect(day?.completedSets).toBe(2);
    expect(day?.volumeKg).toBe(1600);
    expect(heatmap.totalWorkouts).toBe(1);
  });

  it('scales levels relative to the busiest day in the window', () => {
    const heavy = makeSession({
      id: 'heavy',
      finishedAt: '2026-09-12T10:00:00.000Z',
      exercises: [makeExercise({ sets: [makeSet({ loadKg: 100, reps: 10 })] })], // 1000kg
    });
    const light = makeSession({
      id: 'light',
      finishedAt: '2026-09-13T10:00:00.000Z',
      exercises: [makeExercise({ sets: [makeSet({ loadKg: 100, reps: 2 })] })], // 200kg, 20% of max
    });
    const heatmap = buildActivityHeatmap([heavy, light], 2, NOW);
    expect(heatmap.days.find((d) => d.date === '2026-09-12')?.level).toBe(4);
    expect(heatmap.days.find((d) => d.date === '2026-09-13')?.level).toBe(1);
  });

  it('drops sessions outside the trailing window', () => {
    const heatmap = buildActivityHeatmap(
      [makeSession({ finishedAt: '2026-01-01T10:00:00.000Z' })],
      2,
      NOW,
    );
    expect(heatmap.totalWorkouts).toBe(0);
  });
});
