import type {
  Exercise,
  MuscleGroup,
  PerformedSet,
  PersonalRecord,
  WorkoutSession,
} from '@/types';
import { uuid } from '@/utils/ids';

import { completedWorkingSets } from '../progression/engine';

/**
 * Epley estimated 1RM. Only meaningful for loaded, lowish-rep sets; callers
 * should skip bodyweight-only and time-tracked work.
 */
export function estimateOneRepMax(loadKg: number, reps: number): number | null {
  if (loadKg <= 0 || reps <= 0) return null;
  if (reps > 12) return null; // formula error grows too large past ~12 reps
  if (reps === 1) return loadKg;
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10;
}

/** Volume load: sum of load × reps across completed working sets. */
export function volumeLoadKg(sets: PerformedSet[]): number {
  return completedWorkingSets(sets).reduce(
    (total, s) => total + (s.loadKg ?? 0) * (s.reps ?? 0),
    0,
  );
}

export function totalWorkingSets(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, ex) => total + completedWorkingSets(ex.sets).length,
    0,
  );
}

export function sessionVolumeKg(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => total + volumeLoadKg(ex.sets), 0);
}

export function setsByMuscle(
  session: WorkoutSession,
  exerciseLookup: (id: string) => Exercise | undefined,
): Partial<Record<MuscleGroup, number>> {
  const result: Partial<Record<MuscleGroup, number>> = {};
  for (const ex of session.exercises) {
    const exercise = exerciseLookup(ex.exerciseId);
    if (!exercise) continue;
    const count = completedWorkingSets(ex.sets).length;
    for (const muscle of exercise.primaryMuscles) {
      result[muscle] = (result[muscle] ?? 0) + count;
    }
  }
  return result;
}

/**
 * Compare a finished session against existing records and return the new ones.
 * Kinds: heaviest load, most reps at any load, best estimated 1RM, best
 * single-session volume for the exercise.
 */
export function detectPersonalRecords(
  session: WorkoutSession,
  existing: PersonalRecord[],
  exerciseLookup: (id: string) => Exercise | undefined,
): PersonalRecord[] {
  const newRecords: PersonalRecord[] = [];
  const best = (exerciseId: string, kind: PersonalRecord['kind']) =>
    existing
      .concat(newRecords)
      .filter((r) => r.exerciseId === exerciseId && r.kind === kind)
      .reduce<number>((max, r) => Math.max(max, r.value), 0);

  for (const ex of session.exercises) {
    const exercise = exerciseLookup(ex.exerciseId);
    if (!exercise) continue;
    const working = completedWorkingSets(ex.sets);
    if (working.length === 0) continue;
    const loaded = exercise.trackingType === 'weight_reps' || exercise.trackingType === 'weighted_bodyweight';

    if (loaded) {
      const topLoadSet = working.reduce((a, b) => ((b.loadKg ?? 0) > (a.loadKg ?? 0) ? b : a));
      const topLoad = topLoadSet.loadKg ?? 0;
      if (topLoad > best(ex.exerciseId, 'max_load')) {
        newRecords.push({
          id: uuid(),
          exerciseId: ex.exerciseId,
          kind: 'max_load',
          value: topLoad,
          loadKg: topLoad,
          reps: topLoadSet.reps ?? undefined,
          date: session.startedAt,
          sessionId: session.id,
        });
      }
      const e1rms = working
        .map((s) => estimateOneRepMax(s.loadKg ?? 0, s.reps ?? 0))
        .filter((v): v is number => v != null);
      if (e1rms.length > 0) {
        const bestE1rm = Math.max(...e1rms);
        if (bestE1rm > best(ex.exerciseId, 'best_e1rm')) {
          newRecords.push({
            id: uuid(),
            exerciseId: ex.exerciseId,
            kind: 'best_e1rm',
            value: bestE1rm,
            date: session.startedAt,
            sessionId: session.id,
          });
        }
      }
      const volume = volumeLoadKg(ex.sets);
      if (volume > 0 && volume > best(ex.exerciseId, 'max_volume')) {
        newRecords.push({
          id: uuid(),
          exerciseId: ex.exerciseId,
          kind: 'max_volume',
          value: Math.round(volume),
          date: session.startedAt,
          sessionId: session.id,
        });
      }
    } else {
      const isTime = exercise.trackingType === 'time';
      const bestEffort = Math.max(
        ...working.map((s) => (isTime ? s.durationSeconds : s.reps) ?? 0),
      );
      if (bestEffort > best(ex.exerciseId, 'max_reps_at_load')) {
        newRecords.push({
          id: uuid(),
          exerciseId: ex.exerciseId,
          kind: 'max_reps_at_load',
          value: bestEffort,
          reps: isTime ? undefined : bestEffort,
          date: session.startedAt,
          sessionId: session.id,
        });
      }
    }
  }
  return newRecords;
}
