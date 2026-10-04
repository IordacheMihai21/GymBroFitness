import { getExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import type { BodyMeasurementEntry } from '@/domain/body/measurements';
import { dayOfWeek } from '@/utils/dates';
import { MUSCLE_GROUPS, type MuscleGroup, type WorkoutSession } from '@/types';

import { sessionVolumeKg } from './analytics';

/**
 * Daily-dashboard derivations: the numbers a lifter checks before training.
 * Pure functions over completed history so the Today screen stays a view.
 */

export type MuscleFreshnessStatus = 'fresh' | 'recovering' | 'worked';

export type MuscleFreshness = {
  muscle: MuscleGroup;
  /** Hours since the last completed working set that hit this muscle directly; null if never. */
  hoursSince: number | null;
  status: MuscleFreshnessStatus;
};

/** Under 24 h is "worked", 24 to 72 h "recovering", otherwise "fresh". Simple, not physiology. */
export function muscleFreshness(history: WorkoutSession[], now = new Date()): MuscleFreshness[] {
  const lastHit: Partial<Record<MuscleGroup, number>> = {};
  for (const session of history) {
    if (session.status !== 'completed') continue;
    const at = Date.parse(session.finishedAt ?? session.startedAt);
    if (!Number.isFinite(at)) continue;
    for (const performed of session.exercises) {
      if (completedWorkingSets(performed.sets).length === 0) continue;
      const exercise = getExercise(performed.exerciseId);
      if (!exercise) continue;
      for (const muscle of exercise.primaryMuscles) {
        lastHit[muscle] = Math.max(lastHit[muscle] ?? 0, at);
      }
    }
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const at = lastHit[muscle];
    const hoursSince = at == null ? null : Math.max(0, (now.getTime() - at) / 3_600_000);
    const status: MuscleFreshnessStatus =
      hoursSince == null || hoursSince >= 72 ? 'fresh' : hoursSince >= 24 ? 'recovering' : 'worked';
    return { muscle, hoursSince, status };
  });
}

export type WeeklyVolumePoint = {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  volumeKg: number;
  sessions: number;
};

/** Total volume per calendar week (Monday start), oldest first, current week last. */
export function weeklyVolumeSeries(
  history: WorkoutSession[],
  weeks = 8,
  now = new Date(),
): WeeklyVolumePoint[] {
  const currentStart = startOfWeek(now);
  const points: WeeklyVolumePoint[] = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(currentStart);
    start.setDate(start.getDate() - (weeks - 1 - index) * 7);
    return { weekStart: isoDate(start), volumeKg: 0, sessions: 0 };
  });
  const firstStart = new Date(currentStart);
  firstStart.setDate(firstStart.getDate() - (weeks - 1) * 7);

  for (const session of history) {
    if (session.status !== 'completed') continue;
    const at = new Date(session.finishedAt ?? session.startedAt);
    if (Number.isNaN(at.getTime()) || at < firstStart) continue;
    const index = Math.floor((startOfWeek(at).getTime() - firstStart.getTime()) / (7 * 86_400_000));
    const point = points[Math.round(index)];
    if (!point) continue;
    point.volumeKg += sessionVolumeKg(session);
    point.sessions += 1;
  }
  return points;
}

export type BodyweightSnapshot = {
  latestKg: number;
  date: string;
  /** Change versus the previous weigh-in, kg; null with a single entry. */
  deltaKg: number | null;
  /** Up to the last 10 weigh-ins, oldest first, for a sparkline. */
  series: number[];
};

export function bodyweightSnapshot(entries: BodyMeasurementEntry[]): BodyweightSnapshot | null {
  const weighed = entries
    .filter(
      (entry): entry is BodyMeasurementEntry & { bodyWeightKg: number } =>
        typeof entry.bodyWeightKg === 'number',
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = weighed.at(-1);
  if (!latest) return null;
  const previous = weighed.at(-2);
  return {
    latestKg: latest.bodyWeightKg,
    date: latest.date,
    deltaKg: previous ? latest.bodyWeightKg - previous.bodyWeightKg : null,
    series: weighed.slice(-10).map((entry) => entry.bodyWeightKg),
  };
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOfWeek(d));
  return d;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
