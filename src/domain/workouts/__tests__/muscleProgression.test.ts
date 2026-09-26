import { buildBodyProgression } from '../muscleProgression';
import type { PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

function makeSets(count: number, withAnalysis = false): PerformedSet[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `set-${index}`,
    setNumber: index + 1,
    kind: 'working' as const,
    loadKg: 80,
    reps: 8,
    durationSeconds: null,
    rir: 2,
    completed: true,
    skipped: false,
    completedAt: null,
    formAnalysis: withAnalysis
      ? {
          id: `analysis-${index}`,
          exerciseId: 'barbell-bench-press',
          capturedAt: '2026-09-01T10:00:00.000Z',
          repCount: 8,
          averageScore: 85,
          averageRomScore: 85,
          averageTempoScore: 85,
          bestRepScore: 90,
          worstRepScore: 80,
          mostCommonIssue: null,
          recommendations: [],
          velocityLossPct: null,
        }
      : undefined,
  }));
}

function makeExercise(
  exerciseId: string,
  setCount: number,
  withAnalysis = false,
): PerformedExercise {
  return {
    id: `${exerciseId}-performed`,
    exerciseId,
    order: 0,
    prescription: {
      exerciseId,
      order: 0,
      workingSets: setCount,
      minReps: 6,
      maxReps: 10,
      targetRir: 2,
      restSeconds: 120,
      selectionReason: 'test',
    },
    sets: makeSets(setCount, withAnalysis),
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

function makeSession(id: string, date: string, exercises: PerformedExercise[]): WorkoutSession {
  return {
    id,
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Training',
    status: 'completed',
    startedAt: date,
    finishedAt: date,
    exercises,
    totalPausedSeconds: 0,
  };
}

describe('body progression', () => {
  it('keeps ranks tied to direct training evidence instead of incomparable loads', () => {
    const history = [
      makeSession('one', '2026-09-01T10:00:00.000Z', [makeExercise('barbell-bench-press', 4)]),
      makeSession('two', '2026-09-08T10:00:00.000Z', [makeExercise('barbell-bench-press', 4)]),
    ];

    const progression = buildBodyProgression(history);
    const chest = progression.muscles.find((item) => item.muscle === 'chest');
    const triceps = progression.muscles.find((item) => item.muscle === 'triceps');

    expect(chest).toMatchObject({ rank: 'C', directSets: 8, sessionCount: 2, nextRank: 'B' });
    expect(triceps).toMatchObject({ rank: 'Unranked', directSets: 0, sessionCount: 0 });
  });

  it('derives badge progress only from completed history', () => {
    const history = [
      makeSession('one', '2026-08-03T10:00:00.000Z', [
        makeExercise('barbell-bench-press', 3, true),
      ]),
      makeSession('two', '2026-08-10T10:00:00.000Z', [makeExercise('barbell-back-squat', 3, true)]),
      makeSession('three', '2026-08-17T10:00:00.000Z', [makeExercise('pull-up', 3)]),
      makeSession('four', '2026-08-24T10:00:00.000Z', [makeExercise('barbell-bench-press', 3)]),
    ];
    history.push({
      ...makeSession('draft', '2026-08-31T10:00:00.000Z', [
        makeExercise('barbell-bench-press', 100),
      ]),
      status: 'in_progress',
      finishedAt: null,
    });

    const progression = buildBodyProgression(history);
    const badge = (id: string) => progression.badges.find((item) => item.id === id);

    expect(badge('first_workout')?.unlocked).toBe(true);
    expect(badge('form_aware')?.unlocked).toBe(true);
    expect(badge('four_week_rhythm')?.unlocked).toBe(true);
    expect(badge('century_sets')).toMatchObject({ current: 12, unlocked: false });
  });
});
