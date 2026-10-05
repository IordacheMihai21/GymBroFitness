import { requireExercise } from '@/domain/exercises/catalog';
import type { ExercisePerformanceHistory, ExercisePrescription, PerformedSet } from '@/types';

import { runProgression } from '../engine';
import { findLoadBumps, learnBumpProfile } from '../learning';

const prescription: ExercisePrescription = {
  exerciseId: 'barbell-bench-press',
  order: 0,
  workingSets: 2,
  minReps: 6,
  maxReps: 10,
  targetRir: 1,
  restSeconds: 180,
  selectionReason: 'test',
};

function sets(loadKg: number, reps: number[]): PerformedSet[] {
  return reps.map((count, index) => ({
    id: `s${index}`,
    setNumber: index + 1,
    kind: 'working',
    loadKg,
    reps: count,
    durationSeconds: null,
    rir: 1,
    completed: true,
    skipped: false,
    completedAt: '2026-10-01T10:00:00.000Z',
  }));
}

function history(...sessions: PerformedSet[][]): ExercisePerformanceHistory[] {
  return sessions.map((performed, index) => ({
    sessionId: `h${index}`,
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    prescription,
    sets: performed,
  }));
}

function bumpSessions(...sessions: PerformedSet[][]) {
  return sessions.map((performed) => ({ sets: performed, minReps: 6, expectedSets: 2 }));
}

describe('learning from past load jumps', () => {
  it('records each jump and whether it held', () => {
    const bumps = findLoadBumps(
      bumpSessions(sets(80, [10, 10]), sets(82.5, [8, 7]), sets(85, [5, 6])),
    );
    expect(bumps).toEqual([
      { fromLoadKg: 80, toLoadKg: 82.5, held: true, repsMargin: 1 },
      { fromLoadKg: 82.5, toLoadKg: 85, held: false, repsMargin: -1 },
    ]);
  });

  it('jumps early after two comfortable jumps, waits after a costly one', () => {
    const comfortable = { fromLoadKg: 80, toLoadKg: 82.5, held: true, repsMargin: 2 };
    const costly = { fromLoadKg: 85, toLoadKg: 87.5, held: false, repsMargin: -1 };
    expect(learnBumpProfile([]).mode).toBe('standard');
    expect(learnBumpProfile([comfortable, comfortable]).mode).toBe('early');
    expect(learnBumpProfile([comfortable, comfortable, costly]).mode).toBe('patient');
    expect(learnBumpProfile([comfortable, { ...comfortable, repsMargin: 1 }]).mode).toBe(
      'standard',
    );
  });
});

describe('the engine uses what it learned', () => {
  const bench = requireExercise('barbell-bench-press');
  const run = (previous: ExercisePerformanceHistory[], today: PerformedSet[]) =>
    runProgression({
      prescription,
      performedSets: today,
      previousSessions: previous,
      exercise: bench,
      userExperience: 'intermediate',
    });

  it('adds load a rep early on a lift whose jumps keep holding', () => {
    const past = history(
      sets(80, [10, 10]),
      sets(82.5, [9, 8]),
      sets(82.5, [10, 10]),
      sets(85, [9, 8]),
    );
    const decision = run(past, sets(85, [10, 9]));
    expect(decision).toMatchObject({
      action: 'increase_load',
      reasonCode: 'TOP_OF_RANGE_LEARNED_EARLY',
      nextLoad: 87.5,
    });
    expect(decision.supportingMetrics).toMatchObject({
      loadJumpsHeld: '2/2',
      loadJumpMode: 'early',
    });
  });

  it('keeps the standard rule without that evidence', () => {
    expect(run(history(sets(80, [8, 8])), sets(80, [10, 9])).action).toBe('increase_reps');
    expect(run(history(sets(80, [8, 8])), sets(80, [10, 10])).reasonCode).toBe(
      'TOP_OF_RANGE_ALL_SETS',
    );
  });

  it('asks for a confirming session after a jump that cost reps', () => {
    const past = history(sets(80, [10, 10]), sets(82.5, [6, 5]), sets(82.5, [9, 8]));
    expect(run(past, sets(82.5, [10, 10]))).toMatchObject({
      action: 'maintain',
      reasonCode: 'CONFIRM_BEFORE_LOAD',
      nextLoad: 82.5,
    });
    const confirmed = history(...past.map((item) => item.sets), sets(82.5, [10, 10]));
    expect(run(confirmed, sets(82.5, [10, 10])).reasonCode).toBe('TOP_OF_RANGE_ALL_SETS');
  });
});
