import { completedWorkingSets } from '@/domain/progression/engine';
import type { WorkoutSession } from '@/types';

import { sessionVolumeKg } from './analytics';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayKey(iso: string): number {
  const d = new Date(iso);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY);
}

function dayKeyToIsoDate(key: number): string {
  return new Date(key * MS_PER_DAY).toISOString().slice(0, 10);
}

export type ActivityDay = {
  /** UTC calendar date, YYYY-MM-DD. */
  date: string;
  volumeKg: number;
  completedSets: number;
  /** 0 (no training) to 4 (this window's busiest day) — relative, not an absolute scale. */
  level: 0 | 1 | 2 | 3 | 4;
};

export type ActivityHeatmap = {
  /** Oldest to newest, one entry per calendar day in the window (gaps included). */
  days: ActivityDay[];
  totalWorkouts: number;
  totalVolumeKg: number;
};

/**
 * Buckets finished workouts into UTC calendar days over a trailing window
 * (default 18 weeks / 126 days, a GitHub-style contribution grid), for
 * calendar-heatmap rendering. Two same-day sessions merge into one day.
 */
export function buildActivityHeatmap(
  history: WorkoutSession[],
  weeks = 18,
  now: Date = new Date(),
): ActivityHeatmap {
  const totalDays = weeks * 7;
  const todayKey = dayKey(now.toISOString());
  const startKey = todayKey - totalDays + 1;

  const byDay = new Map<number, { volumeKg: number; completedSets: number }>();
  for (const session of history) {
    if (!session.finishedAt) continue;
    const key = dayKey(session.finishedAt);
    if (key < startKey || key > todayKey) continue;
    const completedSets = session.exercises.reduce(
      (total, ex) => total + completedWorkingSets(ex.sets).length,
      0,
    );
    if (completedSets === 0) continue;
    const existing = byDay.get(key) ?? { volumeKg: 0, completedSets: 0 };
    byDay.set(key, {
      volumeKg: existing.volumeKg + sessionVolumeKg(session),
      completedSets: existing.completedSets + completedSets,
    });
  }

  const maxVolume = Math.max(0, ...Array.from(byDay.values(), (d) => d.volumeKg));

  const days: ActivityDay[] = [];
  for (let key = startKey; key <= todayKey; key += 1) {
    const entry = byDay.get(key);
    days.push({
      date: dayKeyToIsoDate(key),
      volumeKg: entry?.volumeKg ?? 0,
      completedSets: entry?.completedSets ?? 0,
      level: levelFor(entry?.volumeKg ?? 0, maxVolume),
    });
  }

  return {
    days,
    totalWorkouts: byDay.size,
    totalVolumeKg: Array.from(byDay.values()).reduce((sum, d) => sum + d.volumeKg, 0),
  };
}

function levelFor(volumeKg: number, maxVolume: number): 0 | 1 | 2 | 3 | 4 {
  if (volumeKg <= 0 || maxVolume <= 0) return 0;
  const fraction = volumeKg / maxVolume;
  if (fraction > 0.75) return 4;
  if (fraction > 0.5) return 3;
  if (fraction > 0.25) return 2;
  return 1;
}
