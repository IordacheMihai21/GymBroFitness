import { getExercise } from '@/domain/exercises/catalog';
import type { EquipmentType, Exercise, PerformedExercise, Units } from '@/types';

/**
 * One-sided ("per side") logging.
 *
 * A per-side set means the lifter did the set on each side with the same load
 * and reps, e.g. 2 sets of Bayesian curls on the left and 2 on the right are
 * logged as 2 per-side sets. For weekly hypertrophy volume that is 2 sets for
 * the muscle (each side got two sets of stimulus), while tonnage counts both
 * sides. Load and reps are always what ONE side did, so progression compares
 * like with like from session to session.
 */

type SideSource = Pick<PerformedExercise, 'exerciseId' | 'prescription'> & { perSide?: boolean };

/** Session choice first, then the plan's default, then the exercise's nature. */
export function isPerSide(performed: SideSource): boolean {
  if (typeof performed.perSide === 'boolean') return performed.perSide;
  if (typeof performed.prescription.perSide === 'boolean') return performed.prescription.perSide;
  return getExercise(performed.exerciseId)?.laterality === 'unilateral';
}

/** 2 for per-side work (both sides were trained), otherwise 1. Tonnage only. */
export function sideFactor(performed: SideSource): number {
  return isPerSide(performed) ? 2 : 1;
}

const PER_IMPLEMENT: EquipmentType[] = ['dumbbell', 'adjustable_dumbbell', 'kettlebell'];
const WHOLE_BAR: EquipmentType[] = ['barbell', 'ez_bar', 'smith_machine'];

export type LoadMeaning = 'per_side' | 'each' | 'total' | 'stack';

/** What the number in the load field means for this exercise. */
export function loadMeaning(exercise: Pick<Exercise, 'equipment'>, perSide: boolean): LoadMeaning {
  if (perSide) return 'per_side';
  const lead = exercise.equipment.find((item) => item !== 'bench' && item !== 'incline_bench');
  if (lead && PER_IMPLEMENT.includes(lead)) return 'each';
  if (lead && WHOLE_BAR.includes(lead)) return 'total';
  return 'stack';
}

/** Short field label: "kg/side", "kg each", "kg total" or plain "kg" for machines and cables. */
export function loadFieldLabel(meaning: LoadMeaning, units: Units): string {
  const unit = units === 'lb' ? 'lb' : 'kg';
  if (meaning === 'per_side') return `${unit}/side`;
  if (meaning === 'each') return `${unit} each`;
  if (meaning === 'total') return `${unit} total`;
  return unit;
}

/** One-line explanation shown once per exercise so nobody has to guess. */
export function loadHint(meaning: LoadMeaning): string {
  if (meaning === 'per_side') return 'One side at a time. Log the weight and reps for one side.';
  if (meaning === 'each') return 'Log the weight of one dumbbell.';
  if (meaning === 'total') return 'Log the total weight on the bar.';
  return 'Log the weight shown on the machine or stack.';
}
