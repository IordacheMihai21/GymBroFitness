import type { EquipmentType, Exercise, PerformedSet, WorkoutSession } from '@/types';
import { uuid } from '@/utils/ids';
import { roundToIncrement, smallestIncrementKg } from '@/utils/units';

/**
 * Warm-up ramps sized for hypertrophy work: enough to groove the movement and
 * get the joints ready, low enough in reps that they cost no growth stimulus
 * from the working sets. Warm-up sets never count toward weekly volume or
 * progression (they are `kind: 'warmup'`).
 *
 * - First heavy compound for a muscle: 50% x 8, 70% x 5, 85% x 2.
 * - Compound after that muscle is already warm: 60% x 6, 80% x 3.
 * - First isolation for a muscle: 50% x 10, 75% x 5.
 * - Isolation for an already-warm muscle: one feeler set, 60% x 8.
 */
export type WarmupStep = { percent: number; reps: number };

export function warmupScheme(
  exercise: Pick<Exercise, 'exerciseType'>,
  firstForMuscle: boolean,
): WarmupStep[] {
  if (exercise.exerciseType === 'compound') {
    return firstForMuscle
      ? [
          { percent: 0.5, reps: 8 },
          { percent: 0.7, reps: 5 },
          { percent: 0.85, reps: 2 },
        ]
      : [
          { percent: 0.6, reps: 6 },
          { percent: 0.8, reps: 3 },
        ];
  }
  return firstForMuscle
    ? [
        { percent: 0.5, reps: 10 },
        { percent: 0.75, reps: 5 },
      ]
    : [{ percent: 0.6, reps: 8 }];
}

/** The lightest load the implement allows: an empty bar, the smallest dumbbell, one plate. */
function minimumLoadKg(equipment: EquipmentType[], increment: number): number {
  if (equipment.includes('barbell')) return 20;
  if (equipment.includes('ez_bar')) return 10;
  if (equipment.includes('dumbbell') || equipment.includes('adjustable_dumbbell')) return 2;
  return increment > 0 ? increment : 1;
}

/** True when no earlier exercise in the session already trained this exercise's main muscle. */
export function isFirstForMuscle(
  session: WorkoutSession,
  exerciseIndex: number,
  lookup: (id: string) => Exercise | undefined,
): boolean {
  const current = lookup(session.exercises[exerciseIndex]?.exerciseId ?? '');
  if (!current) return true;
  return !session.exercises.slice(0, exerciseIndex).some((performed) => {
    const earlier = lookup(performed.exerciseId);
    return earlier?.primaryMuscles.some((muscle) => current.primaryMuscles.includes(muscle));
  });
}

/**
 * Warm-up sets ramping to `workingLoadKg`, rounded to loads the equipment can
 * actually make. Steps that round to the empty bar twice, or reach the working
 * load, are dropped, so light lifts get fewer warm-ups instead of silly ones.
 */
export function buildWarmupSets(
  workingLoadKg: number,
  exercise: Pick<Exercise, 'exerciseType' | 'equipment'>,
  firstForMuscle: boolean,
): PerformedSet[] {
  const increment = smallestIncrementKg(exercise.equipment);
  const floor = minimumLoadKg(exercise.equipment, increment);
  if (!(workingLoadKg > floor)) return [];

  const sets: PerformedSet[] = [];
  let previousLoad = -1;
  for (const step of warmupScheme(exercise, firstForMuscle)) {
    const load = Math.max(floor, roundToIncrement(workingLoadKg * step.percent, increment));
    if (load >= workingLoadKg || load <= previousLoad) continue;
    previousLoad = load;
    sets.push({
      id: uuid(),
      setNumber: 0,
      kind: 'warmup',
      loadKg: load,
      reps: step.reps,
      durationSeconds: null,
      rir: null,
      completed: false,
      skipped: false,
      completedAt: null,
      technique: 'standard',
      subEfforts: [],
    });
  }
  return sets;
}

/** Puts the warm-ups in front of the working sets, replacing any unlogged earlier ones. */
export function insertWarmupSets(
  session: WorkoutSession,
  exerciseIndex: number,
  warmups: PerformedSet[],
): WorkoutSession {
  const exercise = session.exercises[exerciseIndex];
  if (!exercise || warmups.length === 0 || session.status === 'paused') return session;
  const kept = exercise.sets.filter((set) => set.kind !== 'warmup' || set.completed);
  const sets = renumberSets([...warmups, ...kept]);
  const exercises = [...session.exercises];
  exercises[exerciseIndex] = { ...exercise, sets };
  return { ...session, exercises };
}

/** How many non-warm-up sets come before `setIndex`: the index that history and plans use. */
export function workingIndexOf(sets: Pick<PerformedSet, 'kind'>[], setIndex: number): number {
  return sets.slice(0, setIndex).filter((set) => set.kind !== 'warmup').length;
}

/** Numbers warm-ups and working sets separately, so working set 1 is still "1". */
export function renumberSets<T extends Pick<PerformedSet, 'kind' | 'setNumber'>>(sets: T[]): T[] {
  let warmup = 0;
  let working = 0;
  return sets.map((set) => ({
    ...set,
    setNumber: set.kind === 'warmup' ? ++warmup : ++working,
  }));
}
