import { completedWorkingSets } from '@/domain/progression/engine';
import type { PerformedSet, WorkoutSession } from '@/types';

import { estimateOneRepMax, setEfforts, volumeLoadKg } from './analytics';

export type ExerciseSetSnapshot = {
  setNumber: number;
  label: string;
  rir: number | null;
  formScore: number | null;
};

export type ExerciseSessionSummary = {
  sessionId: string;
  dayName: string;
  performedAt: string;
  completedSets: number;
  volumeKg: number;
  bestSetLabel: string;
  bestLoadKg: number | null;
  bestE1rmKg: number | null;
  averageRir: number | null;
  averageTargetRir: number | null;
  averageFormScore: number | null;
  mostCommonIssue: string | null;
  sets: ExerciseSetSnapshot[];
};

export type ExerciseFormSummary = {
  analyzedSetCount: number;
  analyzedRepCount: number;
  averageScore: number | null;
  mostCommonIssue: string | null;
};

export type ExerciseIntelligence = {
  exerciseId: string;
  sessions: ExerciseSessionSummary[];
  totalSessions: number;
  totalSets: number;
  totalVolumeKg: number;
  bestLoadKg: number | null;
  repsAtBestLoad: number | null;
  bestE1rmKg: number | null;
  bestSessionVolumeKg: number;
  latestSession: ExerciseSessionSummary | null;
  form: ExerciseFormSummary;
  nextAction: string;
};

export function buildExerciseIntelligence(
  history: WorkoutSession[],
  exerciseId: string,
): ExerciseIntelligence {
  const sessions = history
    .filter((session) => session.status === 'completed')
    .flatMap((session) => buildSessionSummary(session, exerciseId))
    .sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));
  const formScores = sessions
    .map((session) => session.averageFormScore)
    .filter((score): score is number => score != null);
  const issueCounts = new Map<string, number>();
  for (const session of sessions) {
    if (session.mostCommonIssue) {
      issueCounts.set(session.mostCommonIssue, (issueCounts.get(session.mostCommonIssue) ?? 0) + 1);
    }
  }
  const bestLoad = bestLoadedEffort(history, exerciseId);
  const bestE1rmKg = Math.max(...sessions.map((session) => session.bestE1rmKg ?? 0), 0);

  return {
    exerciseId,
    sessions,
    totalSessions: sessions.length,
    totalSets: sessions.reduce((sum, session) => sum + session.completedSets, 0),
    totalVolumeKg: sessions.reduce((sum, session) => sum + session.volumeKg, 0),
    bestLoadKg: bestLoad?.loadKg ?? null,
    repsAtBestLoad: bestLoad?.reps ?? null,
    bestE1rmKg: bestE1rmKg > 0 ? bestE1rmKg : null,
    bestSessionVolumeKg: Math.max(...sessions.map((session) => session.volumeKg), 0),
    latestSession: sessions[0] ?? null,
    form: {
      analyzedSetCount: formScores.length,
      analyzedRepCount: analyzedRepCount(history, exerciseId),
      averageScore: formScores.length
        ? Math.round(formScores.reduce((sum, score) => sum + score, 0) / formScores.length)
        : null,
      mostCommonIssue: [...issueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    },
    nextAction: nextActionForExercise(sessions[0] ?? null),
  };
}

function buildSessionSummary(
  session: WorkoutSession,
  exerciseId: string,
): ExerciseSessionSummary[] {
  const performed = session.exercises.filter((exercise) => exercise.exerciseId === exerciseId);
  if (performed.length === 0) return [];
  const workingSets = performed.flatMap((exercise) => completedWorkingSets(exercise.sets));
  if (workingSets.length === 0) return [];
  const rirValues = workingSets.map((set) => set.rir).filter((rir): rir is number => rir != null);
  const targetRirs = performed.flatMap((exercise) =>
    completedWorkingSets(exercise.sets).map(() => exercise.prescription.targetRir),
  );
  const formScores = workingSets
    .map((set) => set.formAnalysis?.averageScore)
    .filter((score): score is number => score != null);

  return [{
    sessionId: session.id,
    dayName: session.dayName,
    performedAt: session.finishedAt ?? session.startedAt,
    completedSets: workingSets.length,
    volumeKg: performed.reduce((sum, exercise) => sum + Math.round(volumeLoadKg(exercise.sets)), 0),
    bestSetLabel: bestSetLabel(workingSets),
    bestLoadKg: bestLoadedSet(workingSets)?.loadKg ?? null,
    bestE1rmKg: bestEstimatedOneRepMax(workingSets),
    averageRir: average(rirValues),
    averageTargetRir: average(targetRirs),
    averageFormScore: average(formScores, true),
    mostCommonIssue: mostCommonIssue(workingSets),
    sets: workingSets.map((set) => ({
      setNumber: set.setNumber,
      label: setLabel(set),
      rir: set.rir,
      formScore: set.formAnalysis?.averageScore ?? null,
    })),
  }];
}

function nextActionForExercise(latest: ExerciseSessionSummary | null): string {
  if (!latest) return 'Log this lift once to establish your baseline.';
  if (latest.averageFormScore != null && latest.averageFormScore < 80) {
    return `Keep load stable and fix "${latest.mostCommonIssue ?? 'execution quality'}" first.`;
  }
  if (
    latest.averageRir != null &&
    latest.averageTargetRir != null &&
    latest.averageRir > latest.averageTargetRir + 1
  ) {
    return 'Push the next working sets closer to target RIR before adding load.';
  }
  if (
    latest.averageRir != null &&
    latest.averageTargetRir != null &&
    latest.averageRir < latest.averageTargetRir - 1
  ) {
    return 'Repeat the load after recovery; the last run overshot planned effort.';
  }
  return 'Beat the first working set by load or reps while staying near target RIR.';
}

function bestEstimatedOneRepMax(sets: PerformedSet[]): number | null {
  const estimates = sets
    .flatMap(setEfforts)
    .map((effort) => estimateOneRepMax(effort.loadKg ?? 0, effort.reps ?? 0))
    .filter((value): value is number => value != null);
  return estimates.length > 0 ? Math.max(...estimates) : null;
}

function bestLoadedEffort(history: WorkoutSession[], exerciseId: string) {
  const efforts = history.flatMap((session) =>
    session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .flatMap((exercise) => completedWorkingSets(exercise.sets).flatMap(setEfforts)),
  );
  return efforts.reduce<(typeof efforts)[number] | null>((best, effort) => {
    const load = effort.loadKg ?? 0;
    if (load <= 0) return best;
    if (!best || load > (best.loadKg ?? 0)) return effort;
    if (load === (best.loadKg ?? 0) && (effort.reps ?? 0) > (best.reps ?? 0)) return effort;
    return best;
  }, null);
}

function bestLoadedSet(sets: PerformedSet[]): { loadKg: number; reps: number | null } | null {
  const effort = sets.flatMap(setEfforts).reduce<{ loadKg: number; reps: number | null } | null>(
    (best, item) => {
      const load = item.loadKg ?? 0;
      if (load <= 0) return best;
      if (!best || load > best.loadKg) return { loadKg: load, reps: item.reps };
      if (load === best.loadKg && (item.reps ?? 0) > (best.reps ?? 0)) {
        return { loadKg: load, reps: item.reps };
      }
      return best;
    },
    null,
  );
  return effort;
}

function bestSetLabel(sets: PerformedSet[]): string {
  const loaded = bestLoadedSet(sets);
  if (loaded) return `${loaded.loadKg}kg x ${loaded.reps ?? 0}`;
  const bestReps = Math.max(...sets.map((set) => set.reps ?? 0), 0);
  const bestDuration = Math.max(...sets.map((set) => set.durationSeconds ?? 0), 0);
  if (bestDuration > bestReps) return `${bestDuration}s`;
  return `${bestReps} reps`;
}

function setLabel(set: PerformedSet): string {
  if (set.durationSeconds != null && set.durationSeconds > 0) return `${set.durationSeconds}s`;
  if (set.loadKg != null && set.loadKg > 0) return `${set.loadKg}kg x ${set.reps ?? 0}`;
  return `${set.reps ?? 0} reps`;
}

function mostCommonIssue(sets: PerformedSet[]): string | null {
  const counts = new Map<string, number>();
  for (const set of sets) {
    const issue = set.formAnalysis?.mostCommonIssue;
    if (!issue) continue;
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function analyzedRepCount(history: WorkoutSession[], exerciseId: string): number {
  return history.reduce(
    (sum, session) =>
      sum +
      session.exercises
        .filter((exercise) => exercise.exerciseId === exerciseId)
        .flatMap((exercise) => exercise.sets)
        .reduce((setSum, set) => setSum + (set.formAnalysis?.repCount ?? 0), 0),
    0,
  );
}

function average(values: number[], integer = false): number | null {
  if (values.length === 0) return null;
  const value = values.reduce((sum, item) => sum + item, 0) / values.length;
  return integer ? Math.round(value) : Math.round(value * 10) / 10;
}
