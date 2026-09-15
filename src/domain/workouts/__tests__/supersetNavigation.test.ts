import { navigateAfterSetCompletion, supersetChainBounds } from '../supersetNavigation';
import type { PerformedExercise, PerformedSet } from '@/types';

function makeSet(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: 'set-1',
    setNumber: 1,
    kind: 'working',
    loadKg: null,
    reps: null,
    durationSeconds: null,
    rir: null,
    completed: false,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function makeExercise(
  exerciseId: string,
  setCount: number,
  patch: { supersetWithNext?: boolean; completedCount?: number } = {},
): PerformedExercise {
  const completedCount = patch.completedCount ?? 0;
  return {
    id: `performed-${exerciseId}`,
    exerciseId,
    order: 0,
    markedDiscomfort: false,
    markedUnavailable: false,
    prescription: {
      exerciseId,
      order: 0,
      workingSets: setCount,
      minReps: 6,
      maxReps: 10,
      targetRir: 2,
      restSeconds: 120,
      selectionReason: 'test',
      supersetWithNext: patch.supersetWithNext,
    },
    sets: Array.from({ length: setCount }, (_, i) =>
      makeSet({ id: `${exerciseId}-set-${i}`, setNumber: i + 1, completed: i < completedCount }),
    ),
  };
}

describe('supersetChainBounds', () => {
  it('is a single-exercise chain when nothing is flagged', () => {
    const exercises = [makeExercise('a', 3), makeExercise('b', 3)];
    expect(supersetChainBounds(exercises, 0)).toEqual([0, 0]);
    expect(supersetChainBounds(exercises, 1)).toEqual([1, 1]);
  });

  it('spans a run of chained exercises regardless of which member is queried', () => {
    const exercises = [
      makeExercise('a', 3, { supersetWithNext: true }),
      makeExercise('b', 3, { supersetWithNext: true }),
      makeExercise('c', 3),
      makeExercise('d', 3),
    ];
    expect(supersetChainBounds(exercises, 0)).toEqual([0, 2]);
    expect(supersetChainBounds(exercises, 1)).toEqual([0, 2]);
    expect(supersetChainBounds(exercises, 2)).toEqual([0, 2]);
    expect(supersetChainBounds(exercises, 3)).toEqual([3, 3]);
  });
});

describe('navigateAfterSetCompletion', () => {
  it('outside a chain, stays put until the exercise itself is fully done', () => {
    const exercises = [makeExercise('a', 3, { completedCount: 1 }), makeExercise('b', 3)];
    expect(navigateAfterSetCompletion(exercises, 0)).toEqual({ nextExerciseIndex: null, skipRest: false });
  });

  it('outside a chain, advances to the next open exercise once done, with rest', () => {
    const exercises = [makeExercise('a', 1, { completedCount: 1 }), makeExercise('b', 3)];
    expect(navigateAfterSetCompletion(exercises, 0)).toEqual({ nextExerciseIndex: 1, skipRest: false });
  });

  it('inside a chain, jumps to the paired exercise after any set with no rest', () => {
    const exercises = [
      makeExercise('a', 3, { supersetWithNext: true, completedCount: 1 }),
      makeExercise('b', 3, { supersetWithNext: false }),
    ];
    expect(navigateAfterSetCompletion(exercises, 0)).toEqual({ nextExerciseIndex: 1, skipRest: true });
  });

  it('cycles back to the first exercise once the paired one catches up', () => {
    const exercises = [
      makeExercise('a', 3, { supersetWithNext: true, completedCount: 1 }),
      makeExercise('b', 3, { completedCount: 1 }),
    ];
    // Just completed a set on b (index 1); a still has open sets.
    expect(navigateAfterSetCompletion(exercises, 1)).toEqual({ nextExerciseIndex: 0, skipRest: true });
  });

  it('once the whole chain is done, moves on to the next exercise with real rest', () => {
    const exercises = [
      makeExercise('a', 3, { supersetWithNext: true, completedCount: 3 }),
      makeExercise('b', 3, { completedCount: 3 }),
      makeExercise('c', 3),
    ];
    expect(navigateAfterSetCompletion(exercises, 1)).toEqual({ nextExerciseIndex: 2, skipRest: false });
  });

  it('handles a three-exercise chain', () => {
    const exercises = [
      makeExercise('a', 2, { supersetWithNext: true, completedCount: 2 }),
      makeExercise('b', 2, { supersetWithNext: true, completedCount: 1 }),
      makeExercise('c', 2, { completedCount: 0 }),
    ];
    // a is fully done, b just had a set completed but has one open set left before c.
    expect(navigateAfterSetCompletion(exercises, 1)).toEqual({ nextExerciseIndex: 2, skipRest: true });
  });
});
