import type { EquipmentType, Exercise, MovementPattern, MuscleGroup } from '@/types';

import { armExercises } from './seed/arms';
import { backExercises } from './seed/back';
import { calfCoreExercises } from './seed/calves-core';
import { chestExercises } from './seed/chest';
import { legExercises } from './seed/legs';
import { shoulderExercises } from './seed/shoulders';

export const EXERCISE_CATALOG: Exercise[] = [
  ...chestExercises,
  ...backExercises,
  ...shoulderExercises,
  ...armExercises,
  ...legExercises,
  ...calfCoreExercises,
];

const byId = new Map<string, Exercise>(EXERCISE_CATALOG.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

export function requireExercise(id: string): Exercise {
  const exercise = byId.get(id);
  if (!exercise) throw new Error(`Unknown exercise id: ${id}`);
  return exercise;
}

/**
 * An exercise is available when at least one required equipment option is
 * owned. Seed data lists equipment as alternatives (any-of), with mandatory
 * pairings expressed by listing the base item (e.g. bench press needs
 * barbell + bench, so both are in the list and both must match — see below).
 */
const MANDATORY_PAIRS: Partial<Record<EquipmentType, true>> = {
  bench: true,
  incline_bench: true,
  squat_rack: true,
};

export function isExerciseAvailable(exercise: Exercise, owned: EquipmentType[]): boolean {
  const ownedSet = new Set(owned);
  // Benches/racks are supports: if listed, they are required in addition to
  // one of the load implements. Adjustable dumbbells satisfy dumbbell needs;
  // an incline bench satisfies flat-bench needs.
  if (ownedSet.has('adjustable_dumbbell')) ownedSet.add('dumbbell');
  if (ownedSet.has('incline_bench')) ownedSet.add('bench');

  const supports = exercise.equipment.filter((eq) => MANDATORY_PAIRS[eq]);
  const implementsList = exercise.equipment.filter((eq) => !MANDATORY_PAIRS[eq]);

  const supportsOk = supports.every((eq) => ownedSet.has(eq));
  const implementOk =
    implementsList.length === 0 || implementsList.some((eq) => ownedSet.has(eq));
  return supportsOk && implementOk;
}

export function availableExercises(
  owned: EquipmentType[],
  excludedSlugs: string[] = [],
): Exercise[] {
  const excluded = new Set(excludedSlugs);
  return EXERCISE_CATALOG.filter(
    (e) => !excluded.has(e.slug) && isExerciseAvailable(e, owned),
  );
}

export function exercisesForMuscle(
  pool: Exercise[],
  muscle: MuscleGroup,
  opts: { primaryOnly?: boolean } = {},
): Exercise[] {
  return pool.filter(
    (e) =>
      e.primaryMuscles.includes(muscle) ||
      (!opts.primaryOnly && e.secondaryMuscles.includes(muscle)),
  );
}

export function exercisesForPattern(pool: Exercise[], pattern: MovementPattern): Exercise[] {
  return pool.filter((e) => e.movementPattern === pattern);
}

/** Preset equipment bundles used by onboarding environments. */
export const ENVIRONMENT_EQUIPMENT: Record<string, EquipmentType[]> = {
  commercial_gym: [
    'barbell',
    'dumbbell',
    'bench',
    'incline_bench',
    'squat_rack',
    'pull_up_bar',
    'dip_station',
    'cable_machine',
    'plate_loaded_machine',
    'selectorized_machine',
    'smith_machine',
    'kettlebell',
    'leg_press',
    'hack_squat',
    'ez_bar',
    'bodyweight',
  ],
  home_gym: [
    'adjustable_dumbbell',
    'bench',
    'pull_up_bar',
    'resistance_band',
    'bodyweight',
  ],
  bodyweight: ['bodyweight', 'resistance_band'],
};
