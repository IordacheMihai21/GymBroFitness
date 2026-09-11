import type { PerformedExercise, PerformedSet, ProgramDay, WorkoutSession } from '@/types';
import { uuid } from '@/utils/ids';

function buildEmptySets(count: number): PerformedSet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    setNumber: i + 1,
    kind: 'working',
    loadKg: null,
    reps: null,
    durationSeconds: null,
    rir: null,
    completed: false,
    skipped: false,
    completedAt: null,
  }));
}

export function startWorkoutSession(day: ProgramDay, userId: string): WorkoutSession {
  const exercises: PerformedExercise[] = day.prescriptions.map((prescription, i) => ({
    id: uuid(),
    exerciseId: prescription.exerciseId,
    order: i,
    prescription,
    sets: buildEmptySets(prescription.workingSets),
    markedDiscomfort: false,
    markedUnavailable: false,
  }));

  return {
    id: uuid(),
    userId,
    programId: null,
    programDayId: day.id,
    dayName: day.name,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises,
    totalPausedSeconds: 0,
  };
}
