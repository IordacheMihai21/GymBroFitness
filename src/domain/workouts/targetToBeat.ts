import { requireExercise } from '@/domain/exercises/catalog';
import { runProgression } from '@/domain/progression/engine';
import { uuid } from '@/utils/ids';
import type { ExercisePrescription, ExperienceLevel, PerformedSet, ProgressionDecision } from '@/types';

export type TargetToBeat = {
  exerciseName: string;
  decision: ProgressionDecision;
  lastSession: { loadKg: number; reps: number; rir: number };
};

function fabricatedSets(loadKg: number, reps: number, rir: number, count: number): PerformedSet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    setNumber: i + 1,
    kind: 'working',
    loadKg,
    reps,
    durationSeconds: null,
    rir,
    completed: true,
    skipped: false,
    completedAt: null,
  }));
}

/**
 * Runs the real progression engine against a fabricated "last session" for
 * today's first (priority) exercise, so the Home hero card's overload target
 * is genuine engine output, not a hardcoded number.
 */
export function computeTargetToBeat(
  topPrescription: ExercisePrescription,
  userExperience: ExperienceLevel,
  lastSession: { loadKg: number; reps: number; rir: number },
): TargetToBeat {
  const exercise = requireExercise(topPrescription.exerciseId);
  const performedSets = fabricatedSets(
    lastSession.loadKg,
    lastSession.reps,
    lastSession.rir,
    topPrescription.workingSets,
  );

  const decision = runProgression({
    prescription: topPrescription,
    performedSets,
    previousSessions: [],
    exercise,
    userExperience,
  });

  return { exerciseName: exercise.name, decision, lastSession };
}
