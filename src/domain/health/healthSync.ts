import { createBodyMeasurementEntry, type BodyMeasurementEntry } from '@/domain/body/measurements';
import type { WorkoutSession } from '@/types';
import { toDateOnly } from '@/utils/dates';

/**
 * Pure rules for exchanging data with Android Health Connect. The native
 * calls live in services/healthConnect.ts; everything that decides what to
 * import or export lives here so it can be tested without a device.
 */

export type WeightSample = { time: string; kg: number };
export type HeartRatePoint = { time: string; bpm: number };

export type HeartRateSummary = {
  averageBpm: number;
  maxBpm: number;
  sampleCount: number;
};

const PLAUSIBLE_KG = { min: 25, max: 350 };

/**
 * Body-weight entries to save from Health Connect samples. One per day (the
 * day's latest weigh-in). A weight the lifter typed in the app always wins;
 * a day that only has tape measurements gets the weight added to it.
 */
export function mergeHealthWeights(
  existing: BodyMeasurementEntry[],
  samples: WeightSample[],
  userId: string,
  now: () => string = () => new Date().toISOString(),
): BodyMeasurementEntry[] {
  const latestByDay = new Map<string, WeightSample>();
  for (const sample of samples) {
    if (!(sample.kg >= PLAUSIBLE_KG.min && sample.kg <= PLAUSIBLE_KG.max)) continue;
    const day = toDateOnly(new Date(sample.time));
    const current = latestByDay.get(day);
    if (!current || sample.time > current.time) latestByDay.set(day, sample);
  }

  const toSave: BodyMeasurementEntry[] = [];
  for (const [day, sample] of latestByDay) {
    const kg = Math.round(sample.kg * 10) / 10;
    const sameDay = existing.filter((entry) => entry.date === day);
    if (sameDay.some((entry) => entry.bodyWeightKg != null)) continue;
    const measurementsOnly = sameDay[0];
    toSave.push(
      measurementsOnly
        ? { ...measurementsOnly, bodyWeightKg: kg }
        : createBodyMeasurementEntry({
            userId,
            date: day,
            bodyWeightKg: kg,
            note: 'From Health Connect',
            now,
          }),
    );
  }
  return toSave.sort((a, b) => a.date.localeCompare(b.date));
}

/** Average and peak heart rate inside the workout window; null without enough data. */
export function summarizeHeartRate(
  points: HeartRatePoint[],
  startIso: string,
  endIso: string,
): HeartRateSummary | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const inWindow = points.filter((point) => {
    const at = new Date(point.time).getTime();
    return at >= start && at <= end && point.bpm >= 30 && point.bpm <= 240;
  });
  if (inWindow.length < 5) return null;
  const total = inWindow.reduce((sum, point) => sum + point.bpm, 0);
  return {
    averageBpm: Math.round(total / inWindow.length),
    maxBpm: Math.max(...inWindow.map((point) => point.bpm)),
    sampleCount: inWindow.length,
  };
}

export type ExerciseSessionExport = {
  startTime: string;
  endTime: string;
  title: string;
  notes: string;
  clientRecordId: string;
};

/**
 * The workout as a Health Connect exercise session. The client record id is
 * the workout id, so saving the same workout again updates it instead of
 * creating a duplicate.
 */
export function workoutToExerciseSession(
  session: WorkoutSession,
  nameOf: (exerciseId: string) => string,
): ExerciseSessionExport | null {
  if (session.status !== 'completed' || !session.finishedAt) return null;
  const end = new Date(session.finishedAt).getTime();
  const firstSet = session.exercises
    .flatMap((performed) => performed.sets)
    .map((set) => (set.completedAt ? new Date(set.completedAt).getTime() : Infinity))
    .reduce((min, at) => Math.min(min, at), Infinity);
  const started = new Date(session.startedAt).getTime();
  // Drafts opened long before training would inflate the session; start a few
  // minutes before the first set instead (see normalizeSessionTiming).
  const start = Number.isFinite(firstSet) ? Math.max(started, firstSet - 5 * 60 * 1000) : started;
  if (!(end > start)) return null;

  const lines = session.exercises
    .map((performed) => {
      const done = performed.sets.filter(
        (set) => set.completed && !set.skipped && set.kind !== 'warmup',
      ).length;
      return done > 0 ? `${nameOf(performed.exerciseId)} ${done}×` : null;
    })
    .filter((line): line is string => line != null);

  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    title: session.dayName,
    notes:
      lines.length > 0 ? `Logged in GymBroFitness: ${lines.join(', ')}` : 'Logged in GymBroFitness',
    clientRecordId: `gymbro-${session.id}`,
  };
}
