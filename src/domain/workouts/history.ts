import { requireExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import type { WorkoutSession } from '@/types';

import { sessionVolumeKg, volumeLoadKg } from './analytics';

export type WorkoutExerciseSummary = {
  exerciseId: string;
  name: string;
  completedSets: number;
  volumeKg: number;
  bestSetLabel: string;
};

export type WorkoutHistorySummary = {
  sessionId: string;
  dayName: string;
  startedAt: string;
  finishedAt: string | null;
  durationMinutes: number;
  completedSets: number;
  exerciseCount: number;
  volumeKg: number;
  exerciseSummaries: WorkoutExerciseSummary[];
};

export function summarizeWorkoutSession(session: WorkoutSession): WorkoutHistorySummary {
  const exerciseSummaries = session.exercises.map((exercise) => {
    const meta = requireExercise(exercise.exerciseId);
    const completed = completedWorkingSets(exercise.sets);
    return {
      exerciseId: exercise.exerciseId,
      name: meta.name,
      completedSets: completed.length,
      volumeKg: volumeLoadKg(exercise.sets),
      bestSetLabel: bestSetLabel(completed),
    };
  });

  return {
    sessionId: session.id,
    dayName: session.dayName,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    durationMinutes: sessionDurationMinutes(session),
    completedSets: exerciseSummaries.reduce((total, item) => total + item.completedSets, 0),
    exerciseCount: exerciseSummaries.filter((item) => item.completedSets > 0).length,
    volumeKg: sessionVolumeKg(session),
    exerciseSummaries,
  };
}

export function sessionDurationMinutes(session: WorkoutSession, now = new Date()): number {
  const start = new Date(session.startedAt).getTime();
  const end = session.finishedAt ? new Date(session.finishedAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const elapsedMs = end - start - session.totalPausedSeconds * 1000;
  return Math.max(0, Math.round(elapsedMs / 60000));
}

function bestSetLabel(sets: ReturnType<typeof completedWorkingSets>): string {
  if (sets.length === 0) return 'No completed sets';
  const best = sets.reduce((current, candidate) => {
    const currentScore = (current.loadKg ?? 0) * (current.reps ?? current.durationSeconds ?? 0);
    const candidateScore = (candidate.loadKg ?? 0) * (candidate.reps ?? candidate.durationSeconds ?? 0);
    return candidateScore > currentScore ? candidate : current;
  });
  if (best.durationSeconds != null && best.durationSeconds > 0) return `${best.durationSeconds}s`;
  if (best.loadKg != null && best.loadKg > 0) return `${best.loadKg} kg x ${best.reps ?? 0}`;
  return `${best.reps ?? 0} reps`;
}
