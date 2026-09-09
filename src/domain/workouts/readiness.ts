import type { Exercise, ExercisePrescription, ReadinessCheckIn } from '@/types';

export type ReadinessAdjustment = {
  exerciseId: string;
  kind: 'reduce_set' | 'suggest_swap';
  message: string;
};

/**
 * Conservative, ignorable pre-workout adjustments from the readiness check-in.
 * These are suggestions only — the user can dismiss every one of them, and
 * nothing here interprets pain medically.
 */
export function readinessAdjustments(
  readiness: ReadinessCheckIn,
  prescriptions: ExercisePrescription[],
  exerciseLookup: (id: string) => Exercise | undefined,
): ReadinessAdjustment[] {
  const adjustments: ReadinessAdjustment[] = [];
  const readinessScore = readiness.energy + readiness.sleepQuality + readiness.recovery;
  const lowReadiness = readinessScore <= 7;

  // Low readiness: trim one set from the last accessory (isolation) exercise.
  if (lowReadiness) {
    const lastAccessory = [...prescriptions]
      .reverse()
      .find((p) => exerciseLookup(p.exerciseId)?.exerciseType === 'isolation' && p.workingSets > 1);
    if (lastAccessory) {
      const name = exerciseLookup(lastAccessory.exerciseId)?.name ?? 'the last accessory';
      adjustments.push({
        exerciseId: lastAccessory.exerciseId,
        kind: 'reduce_set',
        message: `Low readiness today — dropping one set of ${name} keeps quality high without losing the session. You can ignore this.`,
      });
    }
  }

  // Severe soreness: suggest swapping or lightening exercises hitting that muscle.
  for (const p of prescriptions) {
    const exercise = exerciseLookup(p.exerciseId);
    if (!exercise) continue;
    const severelySore = exercise.primaryMuscles.some(
      (muscle) => (readiness.soreness[muscle] ?? 0) >= 3,
    );
    if (severelySore) {
      adjustments.push({
        exerciseId: p.exerciseId,
        kind: 'suggest_swap',
        message: `${exercise.name} hits a muscle you rated very sore. Consider an equivalent swap or lighter loads — training through severe soreness usually just borrows recovery from later sessions.`,
      });
    }
  }

  return adjustments;
}

export function painMessage(readiness: ReadinessCheckIn): string | null {
  if (!readiness.hasPain) return null;
  return (
    'You reported pain. GymBro will not increase any loads today. ' +
    'Skip movements that hurt — soreness is normal, sharp pain is not — and if it persists, see a qualified professional.'
  );
}
