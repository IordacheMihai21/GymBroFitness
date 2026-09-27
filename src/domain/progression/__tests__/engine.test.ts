import { requireExercise } from '@/domain/exercises/catalog';
import type { ExercisePrescription, PerformedSet } from '@/types';

import { runProgression } from '../engine';

const prescription: ExercisePrescription = {
  exerciseId: 'barbell-bench-press',
  order: 0,
  workingSets: 1,
  minReps: 8,
  maxReps: 12,
  targetRir: 2,
  restSeconds: 180,
  selectionReason: 'test',
};

function completedSet(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: 'set-1',
    setNumber: 1,
    kind: 'working',
    loadKg: 100,
    reps: 8,
    durationSeconds: null,
    rir: 2,
    completed: true,
    skipped: false,
    completedAt: '2026-09-27T10:00:00.000Z',
    ...patch,
  };
}

describe('progression set kinds', () => {
  it('treats an explicit failure set as RIR 0 even when imported without RIR', () => {
    const decision = runProgression({
      prescription,
      performedSets: [completedSet({ kind: 'failure', reps: 5, rir: null })],
      previousSessions: [],
      exercise: requireExercise('barbell-bench-press'),
      userExperience: 'intermediate',
    });

    expect(decision.reasonCode).toBe('EXTREME_MISS');
    expect(decision.supportingMetrics).toMatchObject({ avgRir: 0, rirCoverage: '1/1' });
  });

  it('ignores completed warm-up sets when deciding progression', () => {
    const decision = runProgression({
      prescription,
      performedSets: [completedSet({ kind: 'warmup', loadKg: 60, reps: 10, rir: null })],
      previousSessions: [],
      exercise: requireExercise('barbell-bench-press'),
      userExperience: 'intermediate',
    });

    expect(decision.reasonCode).toBe('NO_COMPLETED_SETS');
  });
});
