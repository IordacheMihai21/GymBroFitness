import { getExercise } from '@/domain/exercises/catalog';
import type { ExercisePrescription, ReadinessCheckIn } from '@/types';

import { painMessage, readinessAdjustments } from '../readiness';

const prescriptions: ExercisePrescription[] = [
  {
    exerciseId: 'barbell-bench-press',
    order: 0,
    workingSets: 3,
    minReps: 6,
    maxReps: 10,
    targetRir: 2,
    restSeconds: 180,
    selectionReason: 'test',
  },
  {
    exerciseId: 'lateral-raise',
    order: 1,
    workingSets: 3,
    minReps: 10,
    maxReps: 15,
    targetRir: 2,
    restSeconds: 90,
    selectionReason: 'test',
  },
];

function checkIn(patch: Partial<ReadinessCheckIn> = {}): ReadinessCheckIn {
  return {
    energy: 3,
    sleepQuality: 3,
    recovery: 3,
    soreness: {},
    hasPain: false,
    ...patch,
  };
}

describe('readiness context', () => {
  it('does not invent an adjustment from a neutral self-report', () => {
    expect(readinessAdjustments(checkIn(), prescriptions, getExercise)).toEqual([]);
  });

  it('keeps low-check-in adjustments optional and targeted to an accessory', () => {
    const adjustments = readinessAdjustments(
      checkIn({ energy: 2, sleepQuality: 2, recovery: 2 }),
      prescriptions,
      getExercise,
    );

    expect(adjustments).toEqual([
      expect.objectContaining({
        exerciseId: 'lateral-raise',
        kind: 'reduce_set',
      }),
    ]);
    expect(adjustments[0].message).toContain('optional');
  });

  it('describes pain as self-reported context rather than a diagnosis', () => {
    expect(painMessage(checkIn({ hasPain: true }))).toContain('You reported pain');
    expect(painMessage(checkIn())).toBeNull();
  });
});
