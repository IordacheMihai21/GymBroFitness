import {
  buildExerciseRecordsForMuscle,
  buildMuscleIntelligence,
  buildProgramExercisesForMuscle,
} from '../muscleIntelligence';
import type { PerformedExercise, PerformedSet, ProgramDay, WorkoutSession } from '@/types';

function makeSet(id: string, patch: Partial<PerformedSet> = {}): PerformedSet {
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

function makeExercise(exerciseId: string, sets: PerformedSet[]): PerformedExercise {
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

function makeSession(
  id: string,
  startedAt: string,
  exercises: PerformedExercise[],
): WorkoutSession {
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

function programDay(): ProgramDay {
  return {
    id: 'upper-a',
    name: 'Upper A',
    order: 0,
    focus: ['chest', 'back'],
    estimatedMinutes: 60,
    prescriptions: [
      {
        exerciseId: 'barbell-bench-press',
        order: 0,
        workingSets: 3,
        minReps: 6,
        maxReps: 10,
        targetRir: 1,
        restSeconds: 180,
        selectionReason: 'test',
      },
      {
        exerciseId: 'pull-up',
        order: 1,
        workingSets: 4,
        minReps: 6,
        maxReps: 10,
        targetRir: 1,
        restSeconds: 180,
        selectionReason: 'test',
      },
    ],
  };
}

describe('muscle intelligence', () => {
  it('extracts primary and secondary program exercises for a selected muscle', () => {
    const chestExercises = buildProgramExercisesForMuscle([programDay()], 'chest');
    const tricepsExercises = buildProgramExercisesForMuscle([programDay()], 'triceps');

    expect(chestExercises[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      role: 'primary',
      workingSets: 3,
      repRangeLabel: '6-10 reps',
    });
    expect(tricepsExercises[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      role: 'secondary',
    });
  });

  it('summarizes records and last-session set count by muscle', () => {
    const history = [
      makeSession('new', '2026-09-14T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [
          makeSet('a', { loadKg: 105, reps: 7 }),
          makeSet('b', { loadKg: 100, reps: 8 }),
        ]),
      ]),
      makeSession('old', '2026-09-07T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [makeSet('c', { loadKg: 100, reps: 8 })]),
      ]),
    ];

    const records = buildExerciseRecordsForMuscle('chest', history);

    expect(records[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      totalSets: 3,
      lastSessionSets: 2,
      bestLoadKg: 105,
    });
    expect(records[0].bestE1rmKg).toBeGreaterThan(120);
  });

  it('summarizes recent exposure without ranking incomparable muscle loads', () => {
    const history = [
      makeSession('upper', '2026-09-14T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [
          makeSet('a', { loadKg: 105, reps: 7, rir: 1 }),
          makeSet('b', { loadKg: 100, reps: 8, rir: 1 }),
        ]),
      ]),
      makeSession('lower', '2026-09-13T10:00:00.000Z', [
        makeExercise('barbell-back-squat', [makeSet('c', { loadKg: 140, reps: 5, rir: 2 })]),
      ]),
    ];

    const intelligence = buildMuscleIntelligence(
      [programDay()],
      history,
      new Date('2026-09-14T12:00:00.000Z'),
    );
    const chest = intelligence.find((item) => item.muscle === 'chest');

    expect(chest?.trainingLoad.weeklySets).toBe(2);
    expect(chest?.trainingLoad.lastSessionSets).toBe(2);
    expect(chest?.trainingLoad.label).toBe('Recent exposure');
    expect(chest?.trainingLoad).toMatchObject({
      directSets: 2,
      indirectExposures: 0,
      weightedEstimate: 2,
      contributionModelVersion: 1,
    });
    const triceps = intelligence.find((item) => item.muscle === 'triceps');
    expect(triceps?.trainingLoad).toMatchObject({
      directSets: 0,
      indirectExposures: 2,
      estimatedSecondarySets: 1,
      weightedEstimate: 1,
      label: 'Indirect exposure',
    });
    expect(triceps?.signal.label).toBe('Indirect exposure logged');
    expect(intelligence.every((item) => !('rank' in item))).toBe(true);
  });

  it('keeps unmapped secondary work visible without assigning a global half-set', () => {
    const history = [
      makeSession('upper', '2026-09-14T10:00:00.000Z', [
        makeExercise('machine-chest-press', [makeSet('a'), makeSet('b'), makeSet('c')]),
      ]),
    ];
    const intelligence = buildMuscleIntelligence(
      [programDay()],
      history,
      new Date('2026-09-14T12:00:00.000Z'),
    );
    const triceps = intelligence.find((item) => item.muscle === 'triceps');

    expect(triceps?.trainingLoad).toMatchObject({
      directSets: 0,
      indirectExposures: 3,
      estimatedSecondarySets: 0,
      weightedEstimate: 0,
      unmappedIndirectExposures: 3,
    });
  });

  it('builds recent work, form quality, and training signal for each muscle', () => {
    const history = [
      makeSession('upper', '2026-09-14T10:00:00.000Z', [
        makeExercise('barbell-bench-press', [
          makeSet('a', {
            loadKg: 105,
            reps: 7,
            rir: 1,
            formAnalysis: {
              id: 'analysis-1',
              exerciseId: 'barbell-bench-press',
              capturedAt: '2026-09-14T10:10:00.000Z',
              repCount: 7,
              averageScore: 78,
              averageRomScore: 80,
              averageTempoScore: 75,
              bestRepScore: 88,
              worstRepScore: 68,
              mostCommonIssue: 'Control the eccentric.',
              recommendations: ['Lower with control.'],
            },
          }),
          makeSet('b', { loadKg: 100, reps: 8, rir: 1 }),
        ]),
      ]),
    ];

    const intelligence = buildMuscleIntelligence(
      [programDay()],
      history,
      new Date('2026-09-14T12:00:00.000Z'),
    );
    const chest = intelligence.find((item) => item.muscle === 'chest');
    const calves = intelligence.find((item) => item.muscle === 'calves');

    expect(chest?.recentSessions[0]).toMatchObject({
      dayName: 'Upper A',
      sets: 2,
      volumeKg: 1535,
      averageRir: 1,
      averageFormScore: 78,
    });
    expect(chest?.recentSessions[0].exercises[0]).toMatchObject({
      name: 'Barbell Bench Press',
      bestSetLabel: '105kg x 7',
    });
    expect(chest?.formQuality).toMatchObject({
      analyzedSetCount: 1,
      analyzedRepCount: 7,
      averageScore: 78,
      coveragePct: 50,
      mostCommonIssue: 'Control the eccentric.',
    });
    expect(chest?.signal.label).toBe('Clean execution first');
    expect(calves?.signal.label).toBe('Build baseline');
  });
});
