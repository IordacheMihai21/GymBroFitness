import type { BodyMeasurementEntry } from '@/domain/body/measurements';
import type { PerformedSet, WorkoutSession } from '@/types';

import { bodyweightSnapshot, muscleFreshness, weeklyVolumeSeries } from '../dashboard';

function set(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: Math.random().toString(36).slice(2),
    setNumber: 1,
    kind: 'working',
    loadKg: 100,
    reps: 5,
    durationSeconds: null,
    rir: 2,
    completed: true,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function session(
  id: string,
  at: string,
  sets: PerformedSet[],
  status = 'completed',
): WorkoutSession {
  return {
    id,
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Upper A',
    status: status as WorkoutSession['status'],
    startedAt: at,
    finishedAt: at,
    totalPausedSeconds: 0,
    exercises: [
      {
        id: `${id}-bench`,
        exerciseId: 'barbell-bench-press',
        order: 0,
        markedDiscomfort: false,
        markedUnavailable: false,
        prescription: {
          exerciseId: 'barbell-bench-press',
          order: 0,
          workingSets: sets.length,
          minReps: 5,
          maxReps: 8,
          targetRir: 2,
          restSeconds: 180,
          selectionReason: 'test',
        },
        sets,
      },
    ],
  };
}

describe('muscleFreshness', () => {
  const now = new Date('2026-10-04T12:00:00');

  it('marks muscles trained in the last day as worked and untrained ones as fresh', () => {
    const result = muscleFreshness([session('a', '2026-10-04T08:00:00', [set()])], now);
    const chest = result.find((item) => item.muscle === 'chest');
    const calves = result.find((item) => item.muscle === 'calves');
    expect(chest?.status).toBe('worked');
    expect(chest?.hoursSince).toBeCloseTo(4);
    expect(calves).toEqual({ muscle: 'calves', hoursSince: null, status: 'fresh' });
  });

  it('uses the most recent session and ignores sets that were not completed', () => {
    const result = muscleFreshness(
      [
        session('old', '2026-09-30T12:00:00', [set()]),
        session('skipped', '2026-10-04T10:00:00', [set({ completed: false })]),
      ],
      now,
    );
    expect(result.find((item) => item.muscle === 'chest')?.status).toBe('fresh');
  });

  it('treats 24 to 72 hours as recovering', () => {
    const result = muscleFreshness([session('a', '2026-10-02T12:00:00', [set()])], now);
    expect(result.find((item) => item.muscle === 'chest')?.status).toBe('recovering');
  });
});

describe('weeklyVolumeSeries', () => {
  it('buckets completed sessions by Monday-start week, oldest first', () => {
    const now = new Date('2026-10-04T12:00:00'); // Sunday
    const series = weeklyVolumeSeries(
      [
        session('this-week', '2026-09-29T10:00:00', [set(), set()]),
        session('last-week', '2026-09-22T10:00:00', [set()]),
        session('draft', '2026-09-30T10:00:00', [set()], 'in_progress'),
      ],
      3,
      now,
    );
    expect(series.map((point) => point.weekStart)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(series.map((point) => point.volumeKg)).toEqual([0, 500, 1000]);
    expect(series[2].sessions).toBe(1);
  });
});

describe('bodyweightSnapshot', () => {
  function entry(date: string, bodyWeightKg: number | null): BodyMeasurementEntry {
    return {
      id: date,
      userId: 'user-1',
      date,
      bodyWeightKg,
      measurementsCm: {},
      createdAt: `${date}T08:00:00Z`,
    };
  }

  it('returns null without any weigh-in', () => {
    expect(bodyweightSnapshot([entry('2026-10-01', null)])).toBeNull();
  });

  it('reports the latest weight and the change from the previous weigh-in', () => {
    const snapshot = bodyweightSnapshot([
      entry('2026-10-03', 81.2),
      entry('2026-10-01', 82),
      entry('2026-10-02', null),
    ]);
    expect(snapshot?.latestKg).toBe(81.2);
    expect(snapshot?.deltaKg).toBeCloseTo(-0.8);
    expect(snapshot?.series).toEqual([82, 81.2]);
  });
});
