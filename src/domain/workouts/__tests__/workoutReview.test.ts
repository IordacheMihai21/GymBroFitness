import { buildWorkoutSessionReview } from '../workoutReview';
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
    completedAt: '2026-09-14T10:10:00.000Z',
    ...patch,
  };
}

function session(sets: PerformedSet[]): WorkoutSession {
  return {
    id: 'review-session',
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Push A',
    status: 'completed',
    startedAt: '2026-09-14T10:00:00.000Z',
    finishedAt: '2026-09-14T11:00:00.000Z',
    totalPausedSeconds: 0,
    exercises: [
      {
        id: 'bench',
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

describe('workout session review', () => {
  it('builds post-workout review cards from completed session data', () => {
    const review = buildWorkoutSessionReview(
      session([
        set('a', {
          formAnalysis: {
            id: 'analysis-1',
            exerciseId: 'barbell-bench-press',
            capturedAt: '2026-09-14T10:10:00.000Z',
            repCount: 8,
            averageScore: 86,
            averageRomScore: 88,
            averageTempoScore: 84,
            bestRepScore: 94,
            worstRepScore: 75,
            mostCommonIssue: 'Control the eccentric.',
            recommendations: ['Slow the lowering phase.'],
          },
        }),
        set('b', { loadKg: 95, reps: 9, rir: 1.5 }),
        set('c', { completed: false, rir: null }),
      ]),
    );

    expect(review.summary.completedSets).toBe(2);
    expect(review.topExercises[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      completedSets: 2,
    });
    expect(review.muscleDose[0]).toMatchObject({ muscle: 'chest', sets: 2 });
    expect(review.rir).toMatchObject({
      loggedSets: 2,
      matchedSets: 2,
      accuracyPct: 100,
      label: 'Intensity on target',
    });
    expect(review.form).toMatchObject({
      analyzedSetCount: 1,
      averageScore: 86,
      coveragePct: 50,
      cue: 'Control the eccentric.',
    });
    expect(review.progression[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      actionLabel: 'Repeat',
    });
    expect(review.nextAction).toContain('repeat this setup');
  });

  it('calls out high RIR sessions as room to push', () => {
    const review = buildWorkoutSessionReview(session([set('a', { rir: 3 }), set('b', { rir: 3 })]));

    expect(review.rir?.label).toBe('Room to push');
    expect(review.nextAction).toContain('closer to the planned RIR');
  });
});
