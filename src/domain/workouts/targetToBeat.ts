import { requireExercise, sameExerciseIdentity } from '@/domain/exercises/catalog';
import { completedWorkingSets, runProgression } from '@/domain/progression/engine';
import type {
  ExercisePerformanceHistory,
  ExercisePrescription,
  ExperienceLevel,
  NutritionContext,
  PerformedSet,
  ProgressionDecision,
  WorkoutSession,
  Units,
} from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

export type ProgressionSignal = {
  sessionId: string;
  date: string;
  loadKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rir: number | null;
};

export type TargetToBeat = {
  exerciseId: string;
  exerciseName: string;
  decision: ProgressionDecision;
  lastSignal: ProgressionSignal | null;
  previousSessionCount: number;
  targetText: string;
  targetSummary: string;
  winCondition: string;
};

type BuildTargetInput = {
  prescription: ExercisePrescription;
  history: WorkoutSession[];
  userExperience: ExperienceLevel;
  nutritionContext?: NutritionContext;
  isPriorityMuscle?: boolean;
  weeklySetsForPrimaryMuscle?: number;
  reportedDiscomfort?: boolean;
};

export function buildProgressionTarget(input: BuildTargetInput): TargetToBeat {
  const exercise = requireExercise(input.prescription.exerciseId);
  const histories = exerciseHistory(input.history, input.prescription.exerciseId);
  const latest = histories.at(-1) ?? null;
  const previousSessions = latest ? histories.slice(0, -1) : [];
  const performedSets = latest?.sets ?? [];

  const decision = runProgression({
    prescription: input.prescription,
    performedSets,
    previousSessions,
    exercise,
    userExperience: input.userExperience,
    nutritionContext: input.nutritionContext,
    isPriorityMuscle: input.isPriorityMuscle,
    weeklySetsForPrimaryMuscle: input.weeklySetsForPrimaryMuscle,
    reportedDiscomfort: input.reportedDiscomfort,
    readiness: latest?.readiness,
  });
  const lastSignal = latest ? bestSignal(latest) : null;

  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    decision,
    lastSignal,
    previousSessionCount: histories.length,
    targetText: targetText(decision, input.prescription, lastSignal),
    targetSummary: targetSummary(decision, lastSignal),
    winCondition: winCondition(decision, input.prescription),
  };
}

export function buildProgramProgressionTargets({
  prescriptions,
  history,
  userExperience,
  nutritionContext,
}: {
  prescriptions: ExercisePrescription[];
  history: WorkoutSession[];
  userExperience: ExperienceLevel;
  nutritionContext?: NutritionContext;
}): Map<string, TargetToBeat> {
  return new Map(
    prescriptions.map((prescription) => [
      prescription.exerciseId,
      buildProgressionTarget({ prescription, history, userExperience, nutritionContext }),
    ]),
  );
}

export function buildLatestExerciseProgressionTarget({
  exerciseId,
  history,
  userExperience,
  nutritionContext,
}: {
  exerciseId: string;
  history: WorkoutSession[];
  userExperience: ExperienceLevel;
  nutritionContext?: NutritionContext;
}): TargetToBeat | null {
  const latest = exerciseHistory(history, exerciseId).at(-1);
  if (!latest) return null;
  return buildProgressionTarget({
    prescription: latest.prescription,
    history,
    userExperience,
    nutritionContext,
  });
}

export function progressionActionLabel(action: ProgressionDecision['action']): string {
  switch (action) {
    case 'increase_load':
      return 'Add load';
    case 'increase_reps':
      return 'Add reps';
    case 'maintain':
      return 'Repeat';
    case 'decrease_load':
      return 'Lower load';
    case 'reduce_sets':
      return 'Trim sets';
    case 'add_set':
      return 'Add set';
    case 'suggest_deload':
      return 'Deload';
    case 'needs_more_data':
      return 'Calibrate';
  }
}

export function formatProgressionSignal(
  signal: ProgressionSignal | null,
  units: Units = 'kg',
): string {
  if (!signal) return 'No saved benchmark yet';
  if (signal.durationSeconds != null && signal.durationSeconds > 0) {
    return `${signal.durationSeconds}s${signal.rir != null ? ` @ RIR ${signal.rir}` : ''}`;
  }
  if (signal.loadKg != null && signal.loadKg > 0) {
    return `${displayLoad(signal.loadKg, units)} ${unitLabel(units)} x ${signal.reps ?? 0}${signal.rir != null ? ` @ RIR ${signal.rir}` : ''}`;
  }
  return `${signal.reps ?? 0} reps${signal.rir != null ? ` @ RIR ${signal.rir}` : ''}`;
}

export function formatDecisionTarget(decision: ProgressionDecision, units: Units = 'kg'): string {
  const load =
    decision.nextLoad != null
      ? `${displayLoad(decision.nextLoad, units)} ${unitLabel(units)}`
      : null;
  const reps =
    decision.nextMinReps === decision.nextMaxReps
      ? `${decision.nextMaxReps}`
      : `${decision.nextMinReps}-${decision.nextMaxReps}`;
  return load ? `${load} x ${reps}` : `${reps} reps`;
}

export function formatTargetSummary(target: TargetToBeat, units: Units = 'kg'): string {
  const label = progressionActionLabel(target.decision.action);
  if (!target.lastSignal) return `${label}: establish a clean first benchmark.`;
  return `${label}: ${formatDecisionTarget(target.decision, units)}. Last: ${formatProgressionSignal(target.lastSignal, units)}.`;
}

export function formatTargetWinCondition(target: TargetToBeat, units: Units = 'kg'): string {
  const { decision } = target;
  if (decision.action === 'increase_load' && decision.nextLoad != null) {
    return `Own ${displayLoad(decision.nextLoad, units)} ${unitLabel(units)} inside ${decision.nextMinReps}-${decision.nextMaxReps} reps.`;
  }
  return target.winCondition;
}

function exerciseHistory(
  history: WorkoutSession[],
  exerciseId: string,
): ExercisePerformanceHistory[] {
  return history
    .filter((session) => session.status === 'completed')
    .flatMap((session) =>
      session.exercises
        .filter((exercise) => sameExerciseIdentity(exercise.exerciseId, exerciseId))
        .flatMap((exercise) => {
          const sets = completedWorkingSets(exercise.sets);
          if (sets.length === 0) return [];
          return [
            {
              sessionId: session.id,
              date: session.finishedAt ?? session.startedAt,
              prescription: exercise.prescription,
              sets,
              readiness: session.readiness,
            },
          ];
        }),
    )
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function bestSignal(history: ExercisePerformanceHistory): ProgressionSignal | null {
  const completed = completedWorkingSets(history.sets);
  if (completed.length === 0) return null;

  const best = completed.reduce((current, candidate) => {
    const currentScore = signalScore(current);
    const candidateScore = signalScore(candidate);
    return candidateScore > currentScore ? candidate : current;
  });

  return {
    sessionId: history.sessionId,
    date: history.date,
    loadKg: best.loadKg,
    reps: best.reps,
    durationSeconds: best.durationSeconds,
    rir: best.rir,
  };
}

function signalScore(set: PerformedSet): number {
  if (set.durationSeconds != null && set.durationSeconds > 0) return set.durationSeconds;
  const load = set.loadKg ?? 0;
  const reps = set.reps ?? 0;
  if (load > 0) return load * Math.max(1, reps);
  return reps;
}

function targetText(
  decision: ProgressionDecision,
  prescription: ExercisePrescription,
  signal: ProgressionSignal | null,
): string {
  if (!signal) return `Calibrate ${prescription.minReps}-${prescription.maxReps} reps`;
  if (decision.action === 'increase_load' && decision.nextLoad != null) {
    return `${decision.nextLoad} kg x ${decision.nextMinReps}-${decision.nextMaxReps}`;
  }
  if (decision.action === 'decrease_load' && decision.nextLoad != null) {
    return `${decision.nextLoad} kg x ${decision.nextMinReps}-${decision.nextMaxReps}`;
  }
  if (decision.nextLoad != null) {
    return `${decision.nextLoad} kg x ${decision.nextMaxReps}`;
  }
  return `${decision.nextMinReps}-${decision.nextMaxReps} reps`;
}

function targetSummary(decision: ProgressionDecision, signal: ProgressionSignal | null): string {
  const label = progressionActionLabel(decision.action);
  if (!signal) return `${label}: establish a clean first benchmark.`;
  return `${label}: ${formatDecisionTarget(decision)}. Last: ${formatProgressionSignal(signal)}.`;
}

function winCondition(decision: ProgressionDecision, prescription: ExercisePrescription): string {
  switch (decision.action) {
    case 'increase_load':
      return `Own ${decision.nextLoad} kg inside ${decision.nextMinReps}-${decision.nextMaxReps} reps.`;
    case 'increase_reps':
      return `Add reps while staying near RIR ${prescription.targetRir}.`;
    case 'maintain':
      return `Repeat the load with cleaner execution at RIR ${prescription.targetRir}.`;
    case 'decrease_load':
      return `Restore clean reps before chasing load again.`;
    case 'reduce_sets':
      return `Keep set quality high across ${decision.nextWorkingSets} sets.`;
    case 'add_set':
      return `Handle ${decision.nextWorkingSets} quality sets without overshooting effort.`;
    case 'suggest_deload':
      return 'Reduce strain and let fatigue clear.';
    case 'needs_more_data':
      return `Log all working sets and RIR to establish the baseline.`;
  }
}
