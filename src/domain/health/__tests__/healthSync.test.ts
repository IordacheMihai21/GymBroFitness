import { createBodyMeasurementEntry } from '@/domain/body/measurements';
import type { PerformedSet, WorkoutSession } from '@/types';

import { mergeHealthWeights, summarizeHeartRate, workoutToExerciseSession } from '../healthSync';

const NOW = () => '2026-10-05T10:00:00.000Z';

describe('weight from Health Connect', () => {
  it('keeps one weigh-in per day, the latest', () => {
    const saved = mergeHealthWeights(
      [],
      [
        { time: '2026-10-03T06:10:00', kg: 82.4 },
        { time: '2026-10-03T21:00:00', kg: 83.06 },
        { time: '2026-10-04T06:00:00', kg: 82.1 },
      ],
      'u',
      NOW,
    );
    expect(saved.map((entry) => [entry.date, entry.bodyWeightKg])).toEqual([
      ['2026-10-03', 83.1],
      ['2026-10-04', 82.1],
    ]);
    expect(saved[0].note).toBe('From Health Connect');
  });

  it('never overwrites a weight typed in the app, but fills a measurements-only day', () => {
    const typed = createBodyMeasurementEntry({ userId: 'u', date: '2026-10-03', bodyWeightKg: 81 });
    const tape = createBodyMeasurementEntry({
      userId: 'u',
      date: '2026-10-04',
      measurementsCm: { waist: 84 },
    });
    const saved = mergeHealthWeights(
      [typed, tape],
      [
        { time: '2026-10-03T07:00:00', kg: 82 },
        { time: '2026-10-04T07:00:00', kg: 82.5 },
      ],
      'u',
      NOW,
    );
    expect(saved).toEqual([{ ...tape, bodyWeightKg: 82.5 }]);
  });

  it('ignores implausible readings', () => {
    expect(mergeHealthWeights([], [{ time: '2026-10-03T07:00:00', kg: 4 }], 'u', NOW)).toEqual([]);
  });
});

describe('heart rate during a workout', () => {
  const points = Array.from({ length: 10 }, (_, index) => ({
    time: `2026-10-05T12:${String(index * 5).padStart(2, '0')}:00.000Z`,
    bpm: 100 + index * 5,
  }));

  it('averages the samples inside the workout window', () => {
    expect(
      summarizeHeartRate(points, '2026-10-05T12:00:00.000Z', '2026-10-05T12:30:00.000Z'),
    ).toEqual({ averageBpm: 115, maxBpm: 130, sampleCount: 7 });
  });

  it('says nothing without enough data', () => {
    expect(
      summarizeHeartRate(
        points.slice(0, 3),
        '2026-10-05T12:00:00.000Z',
        '2026-10-05T13:00:00.000Z',
      ),
    ).toBeNull();
  });
});

describe('workout export', () => {
  function set(completedAt: string | null, patch: Partial<PerformedSet> = {}): PerformedSet {
    return {
      id: Math.random().toString(36).slice(2),
      setNumber: 1,
      kind: 'working',
      loadKg: 20,
      reps: 10,
      durationSeconds: null,
      rir: 1,
      completed: completedAt != null,
      skipped: false,
      completedAt,
      ...patch,
    };
  }

  const session: WorkoutSession = {
    id: 'w1',
    userId: 'u',
    programId: null,
    programDayId: null,
    dayName: 'Arms',
    status: 'completed',
    startedAt: '2026-10-04T20:00:00.000Z',
    finishedAt: '2026-10-05T13:00:00.000Z',
    totalPausedSeconds: 0,
    exercises: [
      {
        id: 'p',
        exerciseId: 'dumbbell-curl',
        order: 0,
        markedDiscomfort: false,
        markedUnavailable: false,
        prescription: {
          exerciseId: 'dumbbell-curl',
          order: 0,
          workingSets: 2,
          minReps: 8,
          maxReps: 12,
          targetRir: 1,
          restSeconds: 90,
          selectionReason: 'test',
        },
        sets: [
          set('2026-10-05T12:10:00.000Z', { kind: 'warmup' }),
          set('2026-10-05T12:15:00.000Z'),
          set('2026-10-05T12:20:00.000Z'),
        ],
      },
    ],
  };

  it('starts shortly before the first set, not when a draft was opened the night before', () => {
    expect(workoutToExerciseSession(session, () => 'Dumbbell Curl')).toEqual({
      startTime: '2026-10-05T12:05:00.000Z',
      endTime: '2026-10-05T13:00:00.000Z',
      title: 'Arms',
      notes: 'Logged in GymBroFitness: Dumbbell Curl 2×',
      clientRecordId: 'gymbro-w1',
    });
  });

  it('only exports finished workouts', () => {
    expect(workoutToExerciseSession({ ...session, status: 'in_progress' }, () => '')).toBeNull();
  });
});
