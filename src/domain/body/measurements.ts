import { uuid } from '@/utils/ids';

/**
 * Circumference sites tracked alongside body weight. Kept intentionally small
 * — the common set every measurement guide agrees on — rather than an
 * exhaustive anatomical list nobody measures weekly.
 */
export type MeasurementSite =
  'neck' | 'chest' | 'waist' | 'hips' | 'leftBicep' | 'rightBicep' | 'leftThigh' | 'rightThigh';

export const MEASUREMENT_SITES: readonly MeasurementSite[] = [
  'neck',
  'chest',
  'waist',
  'hips',
  'leftBicep',
  'rightBicep',
  'leftThigh',
  'rightThigh',
];

export const MEASUREMENT_SITE_LABELS: Record<MeasurementSite, string> = {
  neck: 'Neck',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  leftBicep: 'Left bicep',
  rightBicep: 'Right bicep',
  leftThigh: 'Left thigh',
  rightThigh: 'Right thigh',
};

export type BodyMeasurementEntry = {
  id: string;
  userId: string;
  /** Calendar date this entry represents, `YYYY-MM-DD` — not a timestamp, so a
   * user can log "today" once regardless of what time they open the app. */
  date: string;
  bodyWeightKg: number | null;
  measurementsCm: Partial<Record<MeasurementSite, number>>;
  note?: string;
  createdAt: string;
};

export function createBodyMeasurementEntry(input: {
  userId: string;
  date: string;
  bodyWeightKg?: number | null;
  measurementsCm?: Partial<Record<MeasurementSite, number>>;
  note?: string;
  now?: () => string;
}): BodyMeasurementEntry {
  const now = input.now ?? (() => new Date().toISOString());
  return {
    id: uuid(),
    userId: input.userId,
    date: input.date,
    bodyWeightKg: input.bodyWeightKg ?? null,
    measurementsCm: input.measurementsCm ?? {},
    note: input.note,
    createdAt: now(),
  };
}

export function sortMeasurementsByDateDesc(
  entries: BodyMeasurementEntry[],
): BodyMeasurementEntry[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

export type MeasurementDelta = {
  site: MeasurementSite | 'bodyWeight';
  currentValue: number;
  previousValue: number;
  deltaValue: number;
};

/**
 * Compares the two most recent entries (by date) and returns the change for
 * every site present in both. A single entry, or a site only logged once,
 * has nothing to compare against and is silently omitted rather than shown
 * as a fabricated zero.
 */
export function latestMeasurementDeltas(entries: BodyMeasurementEntry[]): MeasurementDelta[] {
  const sorted = sortMeasurementsByDateDesc(entries);
  const [current, previous] = sorted;
  if (!current || !previous) return [];

  const deltas: MeasurementDelta[] = [];
  if (current.bodyWeightKg != null && previous.bodyWeightKg != null) {
    deltas.push({
      site: 'bodyWeight',
      currentValue: current.bodyWeightKg,
      previousValue: previous.bodyWeightKg,
      deltaValue: current.bodyWeightKg - previous.bodyWeightKg,
    });
  }
  for (const site of MEASUREMENT_SITES) {
    const currentValue = current.measurementsCm[site];
    const previousValue = previous.measurementsCm[site];
    if (currentValue == null || previousValue == null) continue;
    deltas.push({
      site,
      currentValue,
      previousValue,
      deltaValue: currentValue - previousValue,
    });
  }
  return deltas;
}
