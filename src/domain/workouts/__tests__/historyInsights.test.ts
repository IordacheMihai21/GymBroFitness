import {
  buildPersonalRecordsFromHistory,
  buildWeekLog,
  buildWorkoutHistoryInsights,
  countSetsWithRir,
  computeIntensityMatchPct,
} from '../historyInsights';
import { buildMuscleIntelligence } from '../muscleIntelligence';
import type { PerformedSet, WorkoutSession } from '@/types';

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
    completedAt: null,
    ...patch,
  };
}

function session(id: string, startedAt: string, sets: PerformedSet[]): WorkoutSession {
  return {
    id,
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Upper A',
    status: 'completed',
    startedAt,
    finishedAt: startedAt,
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
          minReps: 6,
          maxReps: 10,
          targetRir: 1,
          restSeconds: 180,
          selectionReason: 'test',
        },
        sets,
      },
    ],
  };
}

describe('history insights', () => {
  it('builds current-week log, streak, level, intensity, and strength trend from saved sessions', () => {
    const history = [
      session('newer', '2026-09-14T10:00:00.000Z', [
        set('a', { loadKg: 105, reps: 8, rir: 1 }),
        set('b', { loadKg: 105, reps: 7, rir: 1.5 }),
      ]),
      session('older', '2026-09-13T10:00:00.000Z', [set('c', { loadKg: 100, reps: 8, rir: 1 })]),
    ];

    const insights = buildWorkoutHistoryInsights(
      history,
      [
        { dayOfWeek: 0, splitName: 'Upper A' },
        { dayOfWeek: 1, splitName: 'Lower A' },
      ],
      new Date('2026-09-14T12:00:00.000Z'),
    );

    expect(insights.totalWorkouts).toBe(2);
    expect(insights.streakDays).toBe(2);
    expect(insights.level.tier.name).toBe('Rookie');
    expect(insights.weekLog[0]).toMatchObject({
      label: 'Mon',
      splitName: 'Upper A',
      status: 'done',
      volumeKg: 1575,
    });
    expect(insights.weekLog[1]).toMatchObject({
      label: 'Tue',
      splitName: 'Lower A',
      status: 'upcoming',
    });
    expect(insights.weekVolumeKg).toBe(1575);
    expect(insights.intensityMatchPct).toBe(1);
    expect(insights.rirSetCount).toBe(3);
    expect(
      insights.personalRecords.some((record) => record.exerciseId === 'barbell-bench-press'),
    ).toBe(true);
    expect(insights.strengthTrend?.exerciseName).toBe('Barbell Bench Press');
    expect(insights.strengthTrend?.deltaKg).toBeGreaterThan(0);
  });

  it('computes RIR discipline only from sets with logged RIR', () => {
    const history = [
      session('rir', '2026-09-14T10:00:00.000Z', [
        set('match', { rir: 1 }),
        set('miss', { rir: 3 }),
        set('unset', { rir: null }),
      ]),
    ];

    expect(computeIntensityMatchPct(history)).toBe(0.5);
    expect(countSetsWithRir(history)).toBe(2);
  });

  it('uses the same current-week direct-set total as Body', () => {
    const history = [
      session('shared', '2026-09-14T10:00:00.000Z', [set('a'), set('b', { rir: null })]),
    ];
    const now = new Date('2026-09-14T12:00:00.000Z');
    const progress = buildWorkoutHistoryInsights(history, [], now);
    const body = buildMuscleIntelligence([], history, now).find((item) => item.muscle === 'chest');

    expect(progress.weeklySetsByMuscle.chest).toBe(2);
    expect(body?.trainingLoad.directSets).toBe(progress.weeklySetsByMuscle.chest);
  });

  it('builds week log without requiring planned training days', () => {
    const history = [session('done', '2026-09-14T10:00:00.000Z', [set('a')])];
    const weekLog = buildWeekLog(history, [], new Date('2026-09-14T12:00:00.000Z'));

    expect(weekLog[0].status).toBe('done');
    expect(weekLog[1].status).toBe('rest');
  });

  it('returns only e1RM records for UI record cards', () => {
    const records = buildPersonalRecordsFromHistory([
      session('pr', '2026-09-14T10:00:00.000Z', [set('a')]),
    ]);

    expect(records).not.toHaveLength(0);
    expect(records.every((record) => record.kind === 'best_e1rm')).toBe(true);
  });
});
