import type { Exercise, MuscleGroup, PerformedSet, PersonalRecord, WorkoutSession } from '@/types';
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

export type SetEffort = { loadKg: number | null; reps: number | null };

/**
 * A set's primary effort plus any logged sub-efforts, flattened. Drop sets,
 * rest-pause, myo-reps, cluster sets, and top-set-plus-backoff all store
 * their follow-on work as `subEfforts` on the same `PerformedSet` — this is
 * the one place that unpacks them so volume/e1RM/PR logic doesn't need to
 * know which technique produced them.
 */
export function setEfforts(set: PerformedSet): SetEffort[] {
  const primary: SetEffort = { loadKg: set.loadKg, reps: set.reps };
  const extra = (set.subEfforts ?? []).map((e) => ({ loadKg: e.loadKg, reps: e.reps }));
  return [primary, ...extra];
}

/** Volume load: sum of load × reps across completed working sets and their sub-efforts. */
export function volumeLoadKg(sets: PerformedSet[]): number {
  return completedWorkingSets(sets).reduce(
    (total, s) =>
      total + setEfforts(s).reduce((sum, e) => sum + (e.loadKg ?? 0) * (e.reps ?? 0), 0),
    0,
  );
}

export function totalWorkingSets(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => total + completedWorkingSets(ex.sets).length, 0);
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
      .filter(
        (record) =>
          (exerciseLookup(record.exerciseId)?.id ?? record.exerciseId) === exerciseId &&
          record.kind === kind,
      )
      .reduce<number>((max, r) => Math.max(max, r.value), 0);

  for (const ex of session.exercises) {
    const exercise = exerciseLookup(ex.exerciseId);
    if (!exercise) continue;
    const working = completedWorkingSets(ex.sets);
    if (working.length === 0) continue;
    const loaded =
      exercise.trackingType === 'weight_reps' || exercise.trackingType === 'weighted_bodyweight';

    if (loaded) {
      const allEfforts = working.flatMap(setEfforts);
      const topEffort = allEfforts.reduce((a, b) => ((b.loadKg ?? 0) > (a.loadKg ?? 0) ? b : a));
      const topLoad = topEffort.loadKg ?? 0;
      if (topLoad > best(exercise.id, 'max_load')) {
        newRecords.push({
          id: uuid(),
          exerciseId: exercise.id,
          kind: 'max_load',
          value: topLoad,
          loadKg: topLoad,
          reps: topEffort.reps ?? undefined,
          date: session.startedAt,
          sessionId: session.id,
        });
      }
      const e1rms = allEfforts
        .map((e) => estimateOneRepMax(e.loadKg ?? 0, e.reps ?? 0))
        .filter((v): v is number => v != null);
      if (e1rms.length > 0) {
        const bestE1rm = Math.max(...e1rms);
        if (bestE1rm > best(exercise.id, 'best_e1rm')) {
          newRecords.push({
            id: uuid(),
            exerciseId: exercise.id,
            kind: 'best_e1rm',
            value: bestE1rm,
            date: session.startedAt,
            sessionId: session.id,
          });
        }
      }
      const volume = volumeLoadKg(ex.sets);
      if (volume > 0 && volume > best(exercise.id, 'max_volume')) {
        newRecords.push({
          id: uuid(),
          exerciseId: exercise.id,
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
      if (bestEffort > best(exercise.id, 'max_reps_at_load')) {
        newRecords.push({
          id: uuid(),
          exerciseId: exercise.id,
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
