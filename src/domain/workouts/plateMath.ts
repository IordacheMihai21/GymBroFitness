import type { Units } from '@/types';

/**
 * Plate math for barbell-loaded work: given a target weight, work out which
 * plates go on each side of the bar. This is plain arithmetic (no package
 * on npm does this well for React Native — see docs/PLAN.md), so it is
 * intentionally hand-written rather than pulled from a dependency.
 */

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_BAR_LB = 45;

/** Standard Olympic plate set, heaviest first, one plate = one physical plate. */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

export type PlateStack = { plate: number; count: number };

export type PlateBreakdown = {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: PlateStack[];
  /** Total weight actually achievable with this plate inventory. */
  achievedWeight: number;
  /** True when achievedWeight exactly matches the requested target. */
  exact: boolean;
  barWeight: number;
  units: Units;
};

export type PlateMathOptions = {
  barWeight?: number;
  availablePlates?: number[];
};

/**
 * Greedy plate breakdown for one side of the bar. Assumes an unlimited
 * supply of each plate size (true for almost every commercial gym rack);
 * always rounds DOWN to the nearest achievable weight so the suggested load
 * is never heavier than what was asked for.
 */
export function plateBreakdown(
  targetWeight: number,
  units: Units,
  options: PlateMathOptions = {},
): PlateBreakdown {
  const barWeight = options.barWeight ?? (units === 'kg' ? DEFAULT_BAR_KG : DEFAULT_BAR_LB);
  const plates = [...(options.availablePlates ?? (units === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB))].sort(
    (a, b) => b - a,
  );

  let perSideRemaining = Math.max(0, (targetWeight - barWeight) / 2);
  const perSide: PlateStack[] = [];
  const EPSILON = 1e-6;

  for (const plate of plates) {
    if (plate <= 0) continue;
    let count = 0;
    while (perSideRemaining + EPSILON >= plate) {
      perSideRemaining -= plate;
      count += 1;
    }
    if (count > 0) perSide.push({ plate, count });
  }

  const usedPerSide = perSide.reduce((total, stack) => total + stack.plate * stack.count, 0);
  const achievedWeight = barWeight + usedPerSide * 2;

  return {
    perSide,
    achievedWeight: Math.round(achievedWeight * 100) / 100,
    exact: Math.abs(achievedWeight - targetWeight) < EPSILON,
    barWeight,
    units,
  };
}

/** Human-readable per-side plate string, e.g. "20 + 10 + 2.5". */
export function formatPlateBreakdown(breakdown: PlateBreakdown): string {
  if (breakdown.perSide.length === 0) return 'Bar only';
  return breakdown.perSide
    .flatMap((stack) => Array(stack.count).fill(stack.plate))
    .join(' + ');
}
