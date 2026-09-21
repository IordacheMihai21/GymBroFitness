import type {
  ExperienceLevel,
  MuscleGroup,
  NutritionContext,
  ProgramDay,
  ProgressionAction,
  ProgressionConfidence,
  Units,
  WorkoutSession,
} from '@/types';

import {
  buildProgressionTarget,
  formatDecisionTarget,
  formatTargetSummary,
  progressionActionLabel,
  type TargetToBeat,
} from '../workouts/targetToBeat';

export type ProgramProgressionTarget = {
  dayId: string;
  dayName: string;
  exerciseId: string;
  exerciseName: string;
  action: ProgressionAction;
  actionLabel: string;
  targetText: string;
  targetSummary: string;
  confidence: ProgressionConfidence;
  score: number;
  target: TargetToBeat;
};

export type ProgramProgressionDay = {
  dayId: string;
  dayName: string;
  order: number;
  exerciseCount: number;
  actionCounts: Record<ProgressionAction, number>;
  primaryTarget: ProgramProgressionTarget | null;
  readinessLabel: string;
  readinessDetail: string;
  score: number;
};

export type ProgramProgressionSummary = {
  actionCounts: Record<ProgressionAction, number>;
  days: ProgramProgressionDay[];
  priorityTargets: ProgramProgressionTarget[];
  headline: string;
  detail: string;
  readyToProgressCount: number;
  calibrationCount: number;
  deloadSignalCount: number;
};

type BuildProgramProgressionInput = {
  days: ProgramDay[];
  history: WorkoutSession[];
  userExperience: ExperienceLevel;
  nutritionContext?: NutritionContext;
  priorityMuscles?: MuscleGroup[];
  units?: Units;
};

export function buildProgramProgressionSummary({
  days,
  history,
  userExperience,
  nutritionContext,
  priorityMuscles = [],
  units = 'kg',
}: BuildProgramProgressionInput): ProgramProgressionSummary {
  const actionCounts = emptyActionCounts();
  const allTargets: ProgramProgressionTarget[] = [];

  const progressionDays = days.map((day) => {
    const dayTargets = day.prescriptions.map((prescription) => {
      const target = buildProgressionTarget({
        prescription,
        history,
        userExperience,
        nutritionContext,
        isPriorityMuscle: day.focus.some((muscle) => priorityMuscles.includes(muscle)),
      });
      const item: ProgramProgressionTarget = {
        dayId: day.id,
        dayName: day.name,
        exerciseId: target.exerciseId,
        exerciseName: target.exerciseName,
        action: target.decision.action,
        actionLabel: progressionActionLabel(target.decision.action),
        targetText: formatDecisionTarget(target.decision, units),
        targetSummary: formatTargetSummary(target, units),
        confidence: target.decision.confidence,
        score: scoreTarget(target.decision.action, target.decision.confidence),
        target,
      };
      actionCounts[item.action] += 1;
      allTargets.push(item);
      return item;
    });

    const primaryTarget =
      [...dayTargets].sort(
        (a, b) => b.score - a.score || a.exerciseName.localeCompare(b.exerciseName),
      )[0] ?? null;
    const dayActionCounts = dayTargets.reduce<Record<ProgressionAction, number>>((counts, item) => {
      counts[item.action] += 1;
      return counts;
    }, emptyActionCounts());

    return {
      dayId: day.id,
      dayName: day.name,
      order: day.order,
      exerciseCount: day.prescriptions.length,
      actionCounts: dayActionCounts,
      primaryTarget,
      readinessLabel: readinessLabel(dayActionCounts),
      readinessDetail: readinessDetail(dayActionCounts, primaryTarget, units),
      score: dayTargets.reduce((sum, item) => sum + item.score, 0),
    };
  });

  const priorityTargets = allTargets
    .filter((target) => target.action !== 'maintain')
    .sort((a, b) => b.score - a.score || a.exerciseName.localeCompare(b.exerciseName))
    .slice(0, 6);
  const readyToProgressCount =
    actionCounts.increase_load + actionCounts.increase_reps + actionCounts.add_set;
  const calibrationCount = actionCounts.needs_more_data;
  const deloadSignalCount = actionCounts.suggest_deload;

  return {
    actionCounts,
    days: progressionDays.sort((a, b) => a.order - b.order),
    priorityTargets,
    headline: summaryHeadline({ actionCounts, readyToProgressCount, calibrationCount }),
    detail: summaryDetail({
      actionCounts,
      readyToProgressCount,
      calibrationCount,
      deloadSignalCount,
    }),
    readyToProgressCount,
    calibrationCount,
    deloadSignalCount,
  };
}

function emptyActionCounts(): Record<ProgressionAction, number> {
  return {
    increase_load: 0,
    increase_reps: 0,
    maintain: 0,
    decrease_load: 0,
    reduce_sets: 0,
    add_set: 0,
    suggest_deload: 0,
    needs_more_data: 0,
  };
}

function scoreTarget(action: ProgressionAction, confidence: ProgressionConfidence): number {
  const base: Record<ProgressionAction, number> = {
    suggest_deload: 120,
    increase_load: 110,
    decrease_load: 95,
    add_set: 90,
    increase_reps: 75,
    reduce_sets: 70,
    needs_more_data: 40,
    maintain: 25,
  };
  const confidenceBonus: Record<ProgressionConfidence, number> = {
    high: 12,
    medium: 6,
    low: 0,
  };
  return base[action] + confidenceBonus[confidence];
}

function readinessLabel(counts: Record<ProgressionAction, number>): string {
  if (counts.suggest_deload > 0) return 'Deload signal';
  if (counts.increase_load > 0) return 'Load jump ready';
  if (counts.add_set > 0) return 'Volume ready';
  if (counts.increase_reps > 0) return 'Rep progress';
  if (counts.decrease_load > 0 || counts.reduce_sets > 0) return 'Consolidate';
  if (counts.needs_more_data > 0) return 'Calibrate';
  return 'Hold steady';
}

function readinessDetail(
  counts: Record<ProgressionAction, number>,
  target: ProgramProgressionTarget | null,
  units: Units,
): string {
  if (!target) return 'No programmed exercises.';
  if (counts.suggest_deload > 0) return `${target.exerciseName}: manage fatigue before pushing.`;
  if (counts.increase_load > 0)
    return `${target.exerciseName}: ${formatDecisionTarget(target.target.decision, units)}.`;
  if (counts.add_set > 0) return `${target.exerciseName}: add quality volume.`;
  if (counts.increase_reps > 0) return `${target.exerciseName}: buy reps before plates.`;
  if (counts.needs_more_data > 0) return `${target.exerciseName}: log a clean benchmark.`;
  return `${target.exerciseName}: repeat and make the signal cleaner.`;
}

function summaryHeadline({
  actionCounts,
  readyToProgressCount,
  calibrationCount,
}: {
  actionCounts: Record<ProgressionAction, number>;
  readyToProgressCount: number;
  calibrationCount: number;
}): string {
  if (actionCounts.suggest_deload > 0) return 'Fatigue signals need attention';
  if (actionCounts.increase_load > 0) return `${actionCounts.increase_load} load jump ready`;
  if (readyToProgressCount > 0) return `${readyToProgressCount} progression targets active`;
  if (calibrationCount > 0) return 'Program is still calibrating';
  return 'Program is holding steady';
}

function summaryDetail({
  actionCounts,
  readyToProgressCount,
  calibrationCount,
  deloadSignalCount,
}: {
  actionCounts: Record<ProgressionAction, number>;
  readyToProgressCount: number;
  calibrationCount: number;
  deloadSignalCount: number;
}): string {
  if (deloadSignalCount > 0) {
    return `${deloadSignalCount} lift${deloadSignalCount === 1 ? '' : 's'} show deload-level strain. Keep the plan visible, but protect recovery.`;
  }
  if (actionCounts.increase_load > 0) {
    return `Prioritize the load jumps first, then chase reps on the remaining lifts.`;
  }
  if (readyToProgressCount > 0) {
    return `The week has useful forward targets without forcing every lift to move at once.`;
  }
  if (calibrationCount > 0) {
    return `${calibrationCount} lift${calibrationCount === 1 ? '' : 's'} still need a saved benchmark before the engine can steer them.`;
  }
  return 'No major load jumps flagged. This is a good week to make execution and RIR boringly consistent.';
}
