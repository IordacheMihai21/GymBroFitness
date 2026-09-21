import type { ExercisePrescription, PerformedSet, TrackingType, Units } from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

export type SetValidationResult = { valid: true } | { valid: false; message: string };

export function validateSetForTracking(
  set: PerformedSet,
  trackingType: TrackingType,
): SetValidationResult {
  if (set.skipped) return { valid: true };

  if (set.rir != null && (!Number.isFinite(set.rir) || set.rir < 0 || set.rir > 10)) {
    return { valid: false, message: 'RIR must be between 0 and 10.' };
  }

  if (trackingType === 'time') {
    if (!isPositiveInteger(set.durationSeconds)) {
      return { valid: false, message: 'Enter a whole number of seconds greater than zero.' };
    }
    return { valid: true };
  }

  if (!isPositiveInteger(set.reps)) {
    return { valid: false, message: 'Enter a whole number of reps greater than zero.' };
  }

  if (trackingType === 'weight_reps') {
    if (!isFiniteNumber(set.loadKg) || set.loadKg <= 0) {
      return { valid: false, message: 'Enter a load greater than zero.' };
    }
  }

  if (
    trackingType === 'weighted_bodyweight' &&
    set.loadKg != null &&
    (!Number.isFinite(set.loadKg) || set.loadKg < 0)
  ) {
    return { valid: false, message: 'Additional load cannot be negative.' };
  }

  return { valid: true };
}

/** Clear fields that do not belong to this exercise's tracking contract. */
export function normalizeSetForTracking(
  set: PerformedSet,
  trackingType: TrackingType,
): PerformedSet {
  switch (trackingType) {
    case 'time':
      return { ...set, loadKg: null, reps: null, subEfforts: [] };
    case 'bodyweight_reps':
      return { ...set, loadKg: null, durationSeconds: null, subEfforts: [] };
    case 'weighted_bodyweight':
    case 'weight_reps':
      return { ...set, durationSeconds: null };
  }
}

export function formatTrackingTarget(
  prescription: ExercisePrescription,
  trackingType: TrackingType,
  units: Units,
): string {
  const rir = `@ RIR ${prescription.targetRir}`;
  if (trackingType === 'time') {
    return `${prescription.minReps}-${prescription.maxReps}s ${rir}`;
  }
  const reps = `${prescription.minReps}-${prescription.maxReps} reps`;
  if (prescription.recommendedLoad == null || trackingType === 'bodyweight_reps') {
    return `${reps} ${rir}`;
  }
  const load = displayLoad(prescription.recommendedLoad, units);
  const prefix = trackingType === 'weighted_bodyweight' ? 'extra ' : '';
  return `${prefix}${load} ${unitLabel(units)} · ${reps} ${rir}`;
}

function isPositiveInteger(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}
