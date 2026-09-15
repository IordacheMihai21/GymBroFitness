import { completedWorkingSets } from '@/domain/progression/engine';
import type { WorkoutSession } from '@/types';

import { estimateOneRepMax, volumeLoadKg } from './analytics';

export type ExerciseTrendPoint = {
  sessionId: string;
  date: string;
  /** Best Epley-estimated 1RM across the session's completed sets, kg. Null when not a loaded lift. */
  e1rmKg: number | null;
  volumeKg: number;
  completedSets: number;
};

/**
 * Session-by-session e1RM and volume trend for one exercise, oldest first
 * (the natural order for a trend line chart). `history` may be in any order
 * — this sorts rather than assuming `listWorkoutHistory`'s newest-first order.
 */
export function buildExerciseTrend(
  history: WorkoutSession[],
  exerciseId: string,
): ExerciseTrendPoint[] {
  const points: ExerciseTrendPoint[] = [];

  for (const session of history) {
    const performed = session.exercises.find((ex) => ex.exerciseId === exerciseId);
    if (!performed) continue;
    const completed = completedWorkingSets(performed.sets);
    if (completed.length === 0) continue;

    const e1rms = completed
      .map((s) => estimateOneRepMax(s.loadKg ?? 0, s.reps ?? 0))
      .filter((v): v is number => v != null);

    points.push({
      sessionId: session.id,
      date: session.startedAt,
      e1rmKg: e1rms.length > 0 ? Math.max(...e1rms) : null,
      volumeKg: volumeLoadKg(performed.sets),
      completedSets: completed.length,
    });
  }

  return points.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
