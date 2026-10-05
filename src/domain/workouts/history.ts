import { requireExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import type { Units, WorkoutSession } from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

import { estimateOneRepMax, performedVolumeKg, sessionVolumeKg, setEfforts } from './analytics';

/** How long before the first logged set a session is assumed to have started (warm-up, setup). */
const FIRST_SET_LEAD_MS = 5 * 60_000;
/** Gaps shorter than this between opening a workout and the first set are left as they are. */
const IDLE_DRAFT_THRESHOLD_MS = 30 * 60_000;

/**
 * A workout can be opened hours (or a day) before the first set is logged.
 * Dating it by when the screen opened puts it on the wrong day and in the
 * wrong week, so every per-week view misses it. When the first logged set is
 * far after `startedAt`, start the session just before that set instead, and
 * drop pause time that can no longer fall inside the shorter window.
 */
export function normalizeSessionTiming(session: WorkoutSession): WorkoutSession {
  const stamps = session.exercises
    .flatMap((exercise) => exercise.sets)
    .map((set) => (set.completedAt ? Date.parse(set.completedAt) : Number.NaN))
    .filter(Number.isFinite);
  const opened = Date.parse(session.startedAt);
  if (stamps.length === 0 || !Number.isFinite(opened)) return session;

  const firstSet = Math.min(...stamps);
  if (firstSet - opened <= IDLE_DRAFT_THRESHOLD_MS) return session;

  const start = firstSet - FIRST_SET_LEAD_MS;
  const end = session.finishedAt ? Date.parse(session.finishedAt) : Math.max(...stamps);
  const window = Math.max(0, (end - start) / 1000);
  return {
    ...session,
    startedAt: new Date(start).toISOString(),
    totalPausedSeconds: Math.min(session.totalPausedSeconds, Math.floor(window / 2)),
  };
}

export type WorkoutExerciseSummary = {
  exerciseId: string;
  name: string;
  completedSets: number;
  volumeKg: number;
  bestSetLabel: string;
  /** Best Epley-estimated 1RM across completed sets, kg. Null when not a loaded lift. */
  bestE1rmKg: number | null;
};

export type WorkoutHistorySummary = {
  sessionId: string;
  dayName: string;
  startedAt: string;
  finishedAt: string | null;
  durationMinutes: number;
  completedSets: number;
  exerciseCount: number;
  volumeKg: number;
  analyzedSetCount: number;
  averageFormScore: number | null;
  exerciseSummaries: WorkoutExerciseSummary[];
  /** From Health Connect, when a watch recorded the workout. */
  averageHeartRate: number | null;
};

export function summarizeWorkoutSession(
  session: WorkoutSession,
  units: Units = 'kg',
): WorkoutHistorySummary {
  const exerciseSummaries = session.exercises.map((exercise) => {
    const meta = requireExercise(exercise.exerciseId);
    const completed = completedWorkingSets(exercise.sets);
    return {
      exerciseId: exercise.exerciseId,
      name: meta.name,
      completedSets: completed.length,
      volumeKg: performedVolumeKg(exercise),
      bestSetLabel: bestSetLabel(completed, units),
      bestE1rmKg: bestEstimatedOneRepMax(completed),
    };
  });
  const formAnalyses = session.exercises.flatMap((exercise) =>
    exercise.sets.flatMap((set) => (set.formAnalysis ? [set.formAnalysis] : [])),
  );

  return {
    sessionId: session.id,
    dayName: session.dayName,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    durationMinutes: sessionDurationMinutes(session),
    averageHeartRate: session.heartRate?.averageBpm ?? null,
    completedSets: exerciseSummaries.reduce((total, item) => total + item.completedSets, 0),
    exerciseCount: exerciseSummaries.filter((item) => item.completedSets > 0).length,
    volumeKg: sessionVolumeKg(session),
    analyzedSetCount: formAnalyses.length,
    averageFormScore:
      formAnalyses.length > 0
        ? Math.round(
            formAnalyses.reduce((sum, analysis) => sum + analysis.averageScore, 0) /
              formAnalyses.length,
          )
        : null,
    exerciseSummaries,
  };
}

export function sessionDurationMinutes(session: WorkoutSession, now = new Date()): number {
  const start = new Date(session.startedAt).getTime();
  const end = session.finishedAt ? new Date(session.finishedAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const elapsedMs = end - start - session.totalPausedSeconds * 1000;
  return Math.max(0, Math.round(elapsedMs / 60000));
}

function bestEstimatedOneRepMax(sets: ReturnType<typeof completedWorkingSets>): number | null {
  const estimates = sets
    .flatMap(setEfforts)
    .map((e) => estimateOneRepMax(e.loadKg ?? 0, e.reps ?? 0))
    .filter((v): v is number => v != null);
  return estimates.length > 0 ? Math.max(...estimates) : null;
}

type LabelCandidate = {
  loadKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
};

function bestSetLabel(sets: ReturnType<typeof completedWorkingSets>, units: Units): string {
  const candidates: LabelCandidate[] = sets.flatMap((s) => [
    { loadKg: s.loadKg, reps: s.reps, durationSeconds: s.durationSeconds },
    ...(s.subEfforts ?? []).map((e) => ({ loadKg: e.loadKg, reps: e.reps, durationSeconds: null })),
  ]);
  if (candidates.length === 0) return 'No completed sets';
  const best = candidates.reduce((current, candidate) => {
    const currentScore = (current.loadKg ?? 0) * (current.reps ?? current.durationSeconds ?? 0);
    const candidateScore =
      (candidate.loadKg ?? 0) * (candidate.reps ?? candidate.durationSeconds ?? 0);
    return candidateScore > currentScore ? candidate : current;
  });
  if (best.durationSeconds != null && best.durationSeconds > 0) return `${best.durationSeconds}s`;
  if (best.loadKg != null && best.loadKg > 0) {
    return `${displayLoad(best.loadKg, units)} ${unitLabel(units)} x ${best.reps ?? 0}`;
  }
  return `${best.reps ?? 0} reps`;
}
