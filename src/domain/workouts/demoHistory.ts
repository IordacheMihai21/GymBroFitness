import type { MesocycleBlock } from '@/domain/programs/mesocycle';
import type { PersonalRecord } from '@/types';
import { dayOfWeek } from '@/utils/dates';

import { estimateOneRepMax } from './analytics';
import type { PreWorkoutLog } from './preRoutine';

/**
 * Stand-in for logged history until real persistence exists (Phase 3/4).
 * Mirrors the shape `detectPersonalRecords`/`WorkoutSession` produce so this
 * swaps out cleanly once workouts are actually saved.
 */
export const DEMO_USER_ID = 'demo-user';

function record(
  exerciseId: string,
  loadKg: number,
  reps: number,
  daysAgo: number,
): PersonalRecord {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return {
    id: `${exerciseId}-${daysAgo}`,
    exerciseId,
    kind: 'best_e1rm',
    value: estimateOneRepMax(loadKg, reps) ?? loadKg,
    loadKg,
    reps,
    date: date.toISOString(),
    sessionId: `demo-session-${daysAgo}`,
  };
}

export const DEMO_PERSONAL_RECORDS: PersonalRecord[] = [
  record('barbell-bench-press', 100, 3, 6),
  record('barbell-back-squat', 140, 4, 13),
  record('romanian-deadlift', 120, 5, 20),
  record('overhead-press', 62.5, 4, 27),
];

/** Completed-workout dates for streak/level math — a visible demo streak plus older history. */
export const DEMO_COMPLETED_AT: string[] = (() => {
  const dates: string[] = [];
  const today = new Date();
  const recentDaysAgo = [
    ...Array.from({ length: 19 }, (_, i) => i),
    21,
    22,
    25,
  ];
  for (const daysAgo of recentDaysAgo) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    dates.push(d.toISOString());
  }
  return dates;
})();

export const DEMO_TOTAL_WORKOUTS = 34;

/**
 * Mon-Sun working-set volume for the current week (kg), rest days at 0.
 * Placeholder until sessions are persisted — becomes a real weekly rollup
 * from `sessionVolumeKg` over the week's saved `WorkoutSession`s.
 */
export const DEMO_WEEKLY_VOLUME_SERIES: number[] = [4200, 3800, 0, 5100, 4600, 0, 0];
export const DEMO_WEEKLY_VOLUME_KG = DEMO_WEEKLY_VOLUME_SERIES.reduce((a, b) => a + b, 0);

/**
 * Share of this week's planned sessions completed. Placeholder until session
 * persistence exists — becomes `completedThisWeek / program.daysPerWeek`.
 */
export const DEMO_WEEKLY_PROGRESS = 0.78;

export type WeekLogStatus = 'done' | 'today' | 'upcoming' | 'rest';

export type WeekLogEntry = {
  label: string;
  splitName: string;
  volumeKg: number;
  note?: string;
  isPr?: boolean;
  status: WeekLogStatus;
};

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** index into WEEK_LABELS -> plan; matches the demo 4-day upper/lower x2 split. */
const WEEK_PLAN: { splitName: string; volumeKg: number; note?: string; isPr?: boolean }[] = [
  { splitName: 'Upper A', volumeKg: 11200, note: 'PR: Incline Press', isPr: true },
  { splitName: 'Lower A', volumeKg: 14500, note: 'Matched target' },
  { splitName: 'Rest', volumeKg: 0, note: 'Rest & refuel' },
  { splitName: 'Upper B', volumeKg: 9800, note: 'Session in progress' },
  { splitName: 'Lower B', volumeKg: 13100, note: 'Matched target' },
  { splitName: 'Rest', volumeKg: 0, note: 'Rest & refuel' },
  { splitName: 'Rest', volumeKg: 0, note: 'Rest & refuel' },
];

/** This week's day-by-day log, `today` computed live so it always lines up. */
export const DEMO_WEEK_LOG: WeekLogEntry[] = (() => {
  const todayIndex = dayOfWeek(new Date());
  return WEEK_PLAN.map((plan, i) => {
    const isRestDay = plan.splitName === 'Rest';
    let status: WeekLogStatus = isRestDay ? 'rest' : 'upcoming';
    if (i < todayIndex) status = isRestDay ? 'rest' : 'done';
    else if (i === todayIndex) status = isRestDay ? 'rest' : 'today';
    return { label: WEEK_LABELS[i], ...plan, status };
  });
})();

export const DEMO_WEEK_VOLUME_KG = DEMO_WEEK_LOG.filter((d) => d.status === 'done').reduce(
  (total, d) => total + d.volumeKg,
  0,
);

/** Share of completed working sets logged within ~0.5 RIR of their target. Placeholder. */
export const DEMO_INTENSITY_RIR_MATCH = 0.94;

export const DEMO_MESOCYCLE_BLOCK: MesocycleBlock = {
  name: 'Hypertrophy Phase II',
  totalWeeks: 6,
  startDate: (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 3 * 7 - dayOfWeek(d)); // ~3 full weeks ago, week-aligned
    return d.toISOString();
  })(),
};

export const DEMO_PRE_WORKOUT_LOG: PreWorkoutLog = {
  substance: 'Caffeine',
  doseMg: 300,
  takenAt: (() => {
    const d = new Date();
    d.setUTCMinutes(d.getUTCMinutes() - 25);
    return d.toISOString();
  })(),
  peakWindowMinutes: 45,
  carbsLoadedG: 60,
};

/** A plausible prior session for today's top exercise, feeding the real progression engine. */
export const DEMO_LAST_TOP_SET_SESSION = {
  loadKg: 40,
  reps: 10,
  rir: 2,
  daysAgo: 4,
};
