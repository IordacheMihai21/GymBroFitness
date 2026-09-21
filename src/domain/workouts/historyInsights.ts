import { getExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import { DAY_LABELS, dayOfWeek } from '@/utils/dates';
import type { DayOfWeek, MuscleGroup, PersonalRecord, ProgramDay, WorkoutSession } from '@/types';

import { detectPersonalRecords, sessionVolumeKg, setsByMuscle } from './analytics';
import { buildExerciseTrend, type ExerciseTrendPoint } from './exerciseTrend';
import { computeLevel, computeStreak } from './gamification';
import type { WeekLogEntry } from './demoHistory';

export type PlannedWeekDay = {
  dayOfWeek: DayOfWeek;
  splitName: string;
};

export type StrengthTrend = {
  exerciseId: string;
  exerciseName: string;
  points: (ExerciseTrendPoint & { e1rmKg: number })[];
  deltaKg: number;
  latestKg: number;
};

export type WorkoutHistoryInsights = {
  completedSessions: WorkoutSession[];
  completedDates: string[];
  totalWorkouts: number;
  streakDays: number;
  level: ReturnType<typeof computeLevel>;
  weekLog: WeekLogEntry[];
  weekVolumeKg: number;
  weeklySetsByMuscle: Partial<Record<MuscleGroup, number>>;
  intensityMatchPct: number;
  rirSetCount: number;
  personalRecords: PersonalRecord[];
  strengthTrend: StrengthTrend | null;
};

export function buildWorkoutHistoryInsights(
  history: WorkoutSession[],
  plannedWeek: PlannedWeekDay[] = [],
  now = new Date(),
): WorkoutHistoryInsights {
  const completedSessions = history
    .filter((session) => session.status === 'completed')
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const completedDates = completedSessions.map(
    (session) => session.finishedAt ?? session.startedAt,
  );
  const personalRecords = buildPersonalRecordsFromHistory(completedSessions);
  const weekLog = buildWeekLog(completedSessions, plannedWeek, now, personalRecords);
  const currentWeekSessions = sessionsInCurrentWeek(completedSessions, now);
  const weekVolumeKg = currentWeekSessions.reduce(
    (total, session) => total + sessionVolumeKg(session),
    0,
  );
  const weeklySetsByMuscle = currentWeekSessions.reduce<Partial<Record<MuscleGroup, number>>>(
    (total, session) => mergeSetMaps(total, setsByMuscle(session, getExercise)),
    {},
  );

  return {
    completedSessions,
    completedDates,
    totalWorkouts: completedSessions.length,
    streakDays: computeStreak(completedDates, now),
    level: computeLevel(completedSessions.length),
    weekLog,
    weekVolumeKg,
    weeklySetsByMuscle,
    intensityMatchPct: computeIntensityMatchPct(completedSessions),
    rirSetCount: countSetsWithRir(completedSessions),
    personalRecords,
    strengthTrend: buildPrimaryStrengthTrend(completedSessions),
  };
}

export function buildPlannedWeek(
  programDays: ProgramDay[],
  preferredDays: DayOfWeek[],
): PlannedWeekDay[] {
  return preferredDays.map((preferredDay, index) => ({
    dayOfWeek: preferredDay,
    splitName: programDays[index % Math.max(1, programDays.length)]?.name ?? 'Training',
  }));
}

export function buildPersonalRecordsFromHistory(history: WorkoutSession[]): PersonalRecord[] {
  return buildAllPersonalRecordsFromHistory(history)
    .filter((record) => record.kind === 'best_e1rm')
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function buildAllPersonalRecordsFromHistory(history: WorkoutSession[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const oldestFirst = [...history].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  );
  for (const session of oldestFirst) {
    records.push(...detectPersonalRecords(session, records, getExercise));
  }
  return records.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function buildWeekLog(
  history: WorkoutSession[],
  plannedWeek: PlannedWeekDay[],
  now = new Date(),
  personalRecords: PersonalRecord[] = buildPersonalRecordsFromHistory(history),
): WeekLogEntry[] {
  const today = dayOfWeek(now);
  const weekStart = startOfWeek(now);
  const plannedByDay = new Map(plannedWeek.map((item) => [item.dayOfWeek, item.splitName]));

  return Array.from({ length: 7 }, (_, index) => {
    const dayIndex = index as DayOfWeek;
    const dayStart = addDays(weekStart, index);
    const dayEnd = addDays(dayStart, 1);
    const sessions = history.filter((session) => {
      const started = new Date(session.startedAt);
      return started >= dayStart && started < dayEnd;
    });
    const volumeKg = sessions.reduce((total, session) => total + sessionVolumeKg(session), 0);
    const plannedSplit = plannedByDay.get(dayIndex);
    const splitName = sessions[0]?.dayName ?? plannedSplit ?? 'Rest';
    const status: WeekLogEntry['status'] =
      sessions.length > 0
        ? 'done'
        : dayIndex === today && plannedSplit
          ? 'today'
          : dayIndex > today && plannedSplit
            ? 'upcoming'
            : 'rest';
    const hasPr = personalRecords.some((record) => isSameLocalDay(record.date, dayStart));

    return {
      label: DAY_LABELS[dayIndex],
      splitName,
      volumeKg,
      note:
        status === 'done'
          ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}`
          : 'Rest & recover',
      isPr: hasPr,
      status,
    };
  });
}

export function computeIntensityMatchPct(history: WorkoutSession[]): number {
  let matched = 0;
  let total = 0;

  for (const session of history) {
    for (const exercise of session.exercises) {
      for (const set of completedWorkingSets(exercise.sets)) {
        if (set.rir == null) continue;
        total += 1;
        if (Math.abs(set.rir - exercise.prescription.targetRir) <= 0.5) matched += 1;
      }
    }
  }

  return total === 0 ? 0 : matched / total;
}

export function countSetsWithRir(history: WorkoutSession[]): number {
  return history.reduce(
    (total, session) =>
      total +
      session.exercises.reduce(
        (exerciseTotal, exercise) =>
          exerciseTotal +
          completedWorkingSets(exercise.sets).filter((set) => set.rir != null).length,
        0,
      ),
    0,
  );
}

export function buildPrimaryStrengthTrend(history: WorkoutSession[]): StrengthTrend | null {
  const exerciseIds = new Set<string>();
  for (const session of history) {
    for (const exercise of session.exercises) exerciseIds.add(exercise.exerciseId);
  }

  const candidates = [...exerciseIds]
    .map((exerciseId) => {
      const points = buildExerciseTrend(history, exerciseId).filter(
        (point): point is ExerciseTrendPoint & { e1rmKg: number } => point.e1rmKg != null,
      );
      if (points.length === 0) return null;
      const latest = points[points.length - 1];
      const first = points[0];
      return {
        exerciseId,
        exerciseName: getExercise(exerciseId)?.name ?? 'Exercise',
        points,
        deltaKg: latest.e1rmKg - first.e1rmKg,
        latestKg: latest.e1rmKg,
      };
    })
    .filter((candidate): candidate is StrengthTrend => candidate != null);

  return (
    candidates.sort(
      (a, b) =>
        b.points.length - a.points.length ||
        Date.parse(b.points[b.points.length - 1].date) -
          Date.parse(a.points[a.points.length - 1].date),
    )[0] ?? null
  );
}

export function fallbackSetsByProgram(
  days: ProgramDay[],
  completedDayNames: Set<string>,
): Partial<Record<MuscleGroup, number>> {
  const result: Partial<Record<MuscleGroup, number>> = {};
  for (const day of days) {
    const multiplier = completedDayNames.has(day.name) ? 1 : 0.55;
    for (const prescription of day.prescriptions) {
      const exercise = getExercise(prescription.exerciseId);
      if (!exercise) continue;
      for (const muscle of exercise.primaryMuscles) {
        result[muscle] = (result[muscle] ?? 0) + Math.round(prescription.workingSets * multiplier);
      }
    }
  }
  return result;
}

function sessionsInCurrentWeek(history: WorkoutSession[], now: Date): WorkoutSession[] {
  const weekStart = startOfWeek(now);
  const nextWeek = addDays(weekStart, 7);
  return history.filter((session) => {
    const started = new Date(session.startedAt);
    return started >= weekStart && started < nextWeek;
  });
}

function mergeSetMaps(
  a: Partial<Record<MuscleGroup, number>>,
  b: Partial<Record<MuscleGroup, number>>,
): Partial<Record<MuscleGroup, number>> {
  const merged = { ...a };
  for (const [muscle, sets] of Object.entries(b) as [MuscleGroup, number][]) {
    merged[muscle] = (merged[muscle] ?? 0) + sets;
  }
  return merged;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOfWeek(d));
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameLocalDay(iso: string, date: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}
