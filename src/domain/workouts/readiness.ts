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
        message: `Your check-in was low today. Consider one fewer set of ${name}; this is optional and based only on your self-report.`,
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
        message: `${exercise.name} hits a muscle you rated very sore. Consider an equivalent swap or lighter load, and use your own symptoms to decide.`,
      });
    }
  }

  return adjustments;
}

export function painMessage(readiness: ReadinessCheckIn): string | null {
  if (!readiness.hasPain) return null;
  return (
    'You reported pain. GymBro will not increase any loads today. ' +
    'Avoid movements that reproduce it; if you are unsure or it persists, seek advice from a qualified professional.'
  );
}
