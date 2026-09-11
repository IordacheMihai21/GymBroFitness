const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDayKey(iso: string): number {
  const d = new Date(iso);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY);
}

/**
 * Consecutive-day streak of completed workouts, ending today or yesterday
 * (a missed day since the last session breaks it; today not yet trained
 * doesn't).
 */
export function computeStreak(completedAtDates: string[], now: Date = new Date()): number {
  if (completedAtDates.length === 0) return 0;
  const days = Array.from(new Set(completedAtDates.map(toDayKey))).sort((a, b) => b - a);
  const today = toDayKey(now.toISOString());

  if (days[0] !== today && days[0] !== today - 1) return 0;

  let streak = 1;
  let cursor = days[0];
  for (const day of days.slice(1)) {
    if (day === cursor - 1) {
      streak += 1;
      cursor = day;
    } else {
      break;
    }
  }
  return streak;
}

export type LevelTier = {
  name: string;
  minWorkouts: number;
};

/** Named by total completed workouts — simple, explainable, not gameable by load. */
export const LEVEL_TIERS: LevelTier[] = [
  { name: 'Rookie', minWorkouts: 0 },
  { name: 'Grinder', minWorkouts: 10 },
  { name: 'Beast', minWorkouts: 30 },
  { name: 'Titan', minWorkouts: 75 },
  { name: 'Legend', minWorkouts: 150 },
];

export type LevelProgress = {
  tier: LevelTier;
  tierIndex: number;
  nextTier: LevelTier | null;
  progress: number; // 0-1 toward next tier, 1 if at max tier
};

export function computeLevel(totalWorkouts: number): LevelProgress {
  let tierIndex = 0;
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (totalWorkouts >= LEVEL_TIERS[i].minWorkouts) tierIndex = i;
  }
  const tier = LEVEL_TIERS[tierIndex];
  const nextTier = LEVEL_TIERS[tierIndex + 1] ?? null;
  const progress = nextTier
    ? (totalWorkouts - tier.minWorkouts) / (nextTier.minWorkouts - tier.minWorkouts)
    : 1;
  return { tier, tierIndex, nextTier, progress: Math.max(0, Math.min(1, progress)) };
}
