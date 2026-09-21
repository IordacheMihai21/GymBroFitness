import type { EquipmentType, Units } from '@/types';

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Convert a stored kg value into the user's display unit, rounded for UI. */
export function displayLoad(kg: number | null | undefined, units: Units): number | null {
  if (kg == null) return null;
  const value = units === 'kg' ? kg : kgToLb(kg);
  return Math.round(value * 10) / 10;
}

/** Parse a user-entered load in their unit back to canonical kg. */
export function inputToKg(value: number, units: Units): number {
  return units === 'kg' ? value : lbToKg(value);
}

/** Parse decimal user input without accepting infinities or partial garbage. */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Convert a load field from the selected display unit to canonical kg. */
export function loadInputToKg(text: string, units: Units): number | null {
  const value = parseDecimalInput(text);
  return value == null ? null : inputToKg(value, units);
}

export function unitLabel(units: Units): string {
  return units === 'kg' ? 'kg' : 'lb';
}

export function formatLoad(kg: number, units: Units): string {
  return `${displayLoad(kg, units)}${unitLabel(units)}`;
}

export function formatVolumeLoad(volumeKg: number, units: Units): string {
  const value = units === 'kg' ? volumeKg : kgToLb(volumeKg);
  if (units === 'kg' && value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${Math.round(value)}${unitLabel(units)}`;
}

/**
 * Smallest realistic load increments in kg per equipment class.
 * Dumbbells usually jump 2 kg per pair step; machines have ~5 kg stacks;
 * barbells can take 1.25 kg microplates on each side.
 */
export const LOAD_INCREMENTS_KG: Partial<Record<EquipmentType, number>> = {
  barbell: 2.5,
  ez_bar: 2.5,
  smith_machine: 2.5,
  dumbbell: 2.0,
  adjustable_dumbbell: 2.0,
  kettlebell: 4.0,
  cable_machine: 2.5,
  selectorized_machine: 5.0,
  plate_loaded_machine: 2.5,
  leg_press: 5.0,
  hack_squat: 5.0,
  resistance_band: 0,
};

export const DEFAULT_INCREMENT_KG = 2.5;

/** Pick the smallest increment across an exercise's usable equipment. */
export function smallestIncrementKg(equipment: EquipmentType[]): number {
  const increments = equipment
    .map((eq) => LOAD_INCREMENTS_KG[eq])
    .filter((v): v is number => v != null && v > 0);
  if (increments.length === 0) return DEFAULT_INCREMENT_KG;
  return Math.min(...increments);
}

/** Round a kg load to the nearest achievable increment for the equipment. */
export function roundToIncrement(kg: number, incrementKg: number): number {
  if (incrementKg <= 0) return Math.round(kg * 10) / 10;
  return Math.round(kg / incrementKg) * incrementKg;
}
