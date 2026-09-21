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
    expect(target?.decision.action).toBe('maintain');
    expect(target?.decision.reasonCode).toBe('INCOMPLETE_PRESCRIPTION');
    expect(formatProgressionSignal(target?.lastSignal ?? null)).toContain('100 kg');
  });

  it('holds an incomplete prescription instead of treating it as achieved', () => {
    const target = buildProgressionTarget({
      prescription,
      history: [
        session('partial', '2026-09-08T10:00:00.000Z', [
          set('a', { reps: 8 }),
          set('b', { reps: 8 }),
        ]),
      ],
      userExperience: 'intermediate',
    });

    expect(target.decision).toMatchObject({
      action: 'maintain',
      reasonCode: 'INCOMPLETE_PRESCRIPTION',
      confidence: 'low',
    });
    expect(target.decision.supportingMetrics.completedPrescription).toBe('no');
  });

  it('holds when RIR is missing instead of assuming effort was acceptable', () => {
    const target = buildProgressionTarget({
      prescription,
      history: [
        session('no-rir', '2026-09-08T10:00:00.000Z', [
          set('a', { rir: null }),
          set('b', { rir: null }),
          set('c', { rir: null }),
        ]),
      ],
      userExperience: 'intermediate',
    });

    expect(target.decision).toMatchObject({
      action: 'maintain',
      reasonCode: 'MISSING_RIR_HOLD',
      ruleVersion: 2,
    });
    expect(target.decision.supportingMetrics.rirCoverage).toBe('0/3');
  });

  it('uses the saved check-in as context for the session that produced the data', () => {
    const painful = session('pain', '2026-09-08T10:00:00.000Z', [set('a'), set('b'), set('c')]);
    painful.readiness = {
      energy: 3,
      sleepQuality: 3,
      recovery: 3,
      soreness: {},
      hasPain: true,
    };
    const target = buildProgressionTarget({
      prescription,
      history: [painful],
      userExperience: 'intermediate',
    });

    expect(target.decision).toMatchObject({ action: 'maintain', reasonCode: 'PAIN_HOLD' });
  });

  it('does not add volume when the user reports a calorie deficit', () => {
    const history = ['2026-08-25', '2026-09-01', '2026-09-08'].map((date, index) =>
      session(`session-${index}`, `${date}T10:00:00.000Z`, [
        set(`${index}-a`, { reps: 7 }),
        set(`${index}-b`, { reps: 7 }),
        set(`${index}-c`, { reps: 7 }),
      ]),
    );
    const normal = buildProgressionTarget({
      prescription,
      history,
      userExperience: 'intermediate',
      isPriorityMuscle: true,
      weeklySetsForPrimaryMuscle: 10,
      nutritionContext: 'maintenance',
    });
    const deficit = buildProgressionTarget({
      prescription,
      history,
      userExperience: 'intermediate',
      isPriorityMuscle: true,
      weeklySetsForPrimaryMuscle: 10,
      nutritionContext: 'deficit',
    });

    expect(normal.decision).toMatchObject({
      action: 'add_set',
      reasonCode: 'PRIORITY_VOLUME_HEADROOM',
      nextWorkingSets: 4,
    });
    expect(deficit.decision.action).toBe('increase_reps');
    expect(deficit.decision.supportingMetrics.nutritionContext).toBe('deficit');
  });
});
