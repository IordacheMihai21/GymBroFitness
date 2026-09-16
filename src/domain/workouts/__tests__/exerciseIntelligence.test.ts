import { buildExerciseIntelligence } from '../exerciseIntelligence';
import type { PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

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

function exercise(exerciseId: string, sets: PerformedSet[]): PerformedExercise {
  return {
    id: `${exerciseId}-performed`,
    exerciseId,
    order: 0,
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
    sets,
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

function session(id: string, startedAt: string, exercises: PerformedExercise[]): WorkoutSession {
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

describe('exercise intelligence', () => {
  it('summarizes records, latest session, RIR, and form analysis for one exercise', () => {
    const history = [
      session('new', '2026-09-14T10:00:00.000Z', [
        exercise('barbell-bench-press', [
          set('a', {
            loadKg: 105,
            reps: 7,
            rir: 1,
            formAnalysis: {
              id: 'analysis-1',
              exerciseId: 'barbell-bench-press',
              capturedAt: '2026-09-14T10:10:00.000Z',
              repCount: 7,
              averageScore: 82,
              averageRomScore: 84,
              averageTempoScore: 80,
              bestRepScore: 91,
              worstRepScore: 72,
              mostCommonIssue: 'Control the eccentric.',
              recommendations: ['Lower with control.'],
            },
          }),
          set('b', { loadKg: 100, reps: 8, rir: 1.5 }),
        ]),
      ]),
      session('old', '2026-09-07T10:00:00.000Z', [
        exercise('barbell-bench-press', [set('c', { loadKg: 100, reps: 8 })]),
      ]),
    ];

    const summary = buildExerciseIntelligence(history, 'barbell-bench-press');

    expect(summary.totalSessions).toBe(2);
    expect(summary.totalSets).toBe(3);
    expect(summary.totalVolumeKg).toBe(2335);
    expect(summary.bestLoadKg).toBe(105);
    expect(summary.repsAtBestLoad).toBe(7);
    expect(summary.bestE1rmKg).toBeGreaterThan(120);
    expect(summary.latestSession).toMatchObject({
      sessionId: 'new',
      completedSets: 2,
      volumeKg: 1535,
      bestSetLabel: '105kg x 7',
      averageRir: 1.3,
      averageTargetRir: 1,
      averageFormScore: 82,
      mostCommonIssue: 'Control the eccentric.',
    });
    expect(summary.form).toMatchObject({
      analyzedSetCount: 1,
      analyzedRepCount: 7,
      averageScore: 82,
      mostCommonIssue: 'Control the eccentric.',
    });
  });

  it('gives a baseline action for untrained exercises', () => {
    const summary = buildExerciseIntelligence([], 'barbell-bench-press');

    expect(summary.totalSessions).toBe(0);
    expect(summary.latestSession).toBeNull();
    expect(summary.nextAction).toContain('baseline');
  });
});
