import { requireExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import type {
  ExperienceLevel,
  MuscleGroup,
  PerformedExercise,
  SetFormAnalysis,
  Units,
  WorkoutSession,
} from '@/types';

import { setsByMuscle } from './analytics';
import { summarizeWorkoutSession, type WorkoutExerciseSummary } from './history';
import {
  buildProgressionTarget,
  formatTargetSummary,
  formatTargetWinCondition,
  progressionActionLabel,
  type TargetToBeat,
} from './targetToBeat';

export type WorkoutMuscleDose = {
  muscle: MuscleGroup;
  sets: number;
  share: number;
};

export type WorkoutRirReview = {
  loggedSets: number;
  matchedSets: number;
  accuracyPct: number;
  averageRir: number;
  averageTargetRir: number;
  label: string;
  detail: string;
};

export type WorkoutFormReview = {
  analyzedSetCount: number;
  averageScore: number;
  coveragePct: number;
  label: string;
  cue: string;
};

export type WorkoutSessionReview = {
  summary: ReturnType<typeof summarizeWorkoutSession>;
  topExercises: WorkoutExerciseSummary[];
  muscleDose: WorkoutMuscleDose[];
  rir: WorkoutRirReview | null;
  form: WorkoutFormReview | null;
  progression: WorkoutProgressionReview[];
  nextAction: string;
};

export type WorkoutProgressionReview = {
  exerciseId: string;
  exerciseName: string;
  actionLabel: string;
  targetSummary: string;
  explanation: string;
  target: TargetToBeat;
};

export function buildWorkoutSessionReview(
  session: WorkoutSession,
  opts: { history?: WorkoutSession[]; userExperience?: ExperienceLevel; units?: Units } = {},
): WorkoutSessionReview {
  const summary = summarizeWorkoutSession(session);
  const topExercises = [...summary.exerciseSummaries]
    .filter((exercise) => exercise.completedSets > 0)
    .sort(
      (a, b) =>
        b.volumeKg - a.volumeKg ||
        b.completedSets - a.completedSets ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 3);

  const totalMuscleSets = Math.max(1, summary.completedSets);
  const muscleDose = Object.entries(setsByMuscle(session, (id) => requireExercise(id))).map(
    ([muscle, sets]) => ({
      muscle: muscle as MuscleGroup,
      sets: sets ?? 0,
      share: (sets ?? 0) / totalMuscleSets,
    }),
  );
  muscleDose.sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));

  const rir = buildRirReview(session.exercises);
  const form = buildFormReview(session, summary.completedSets);
  const progression = buildProgressionReview(
    session,
    opts.history ?? [session],
    opts.userExperience ?? 'intermediate',
    opts.units ?? 'kg',
  );

  return {
    summary,
    topExercises,
    muscleDose: muscleDose.slice(0, 5),
    rir,
    form,
    progression,
    nextAction: nextActionForReview({
      rir,
      form,
      summary,
      progression,
      units: opts.units ?? 'kg',
    }),
  };
}

function buildProgressionReview(
  session: WorkoutSession,
  history: WorkoutSession[],
  userExperience: ExperienceLevel,
  units: Units,
): WorkoutProgressionReview[] {
  return session.exercises
    .filter((exercise) => completedWorkingSets(exercise.sets).length > 0)
    .slice(0, 4)
    .map((exercise) => {
      const target = buildProgressionTarget({
        prescription: exercise.prescription,
        history,
        userExperience,
        reportedDiscomfort: exercise.markedDiscomfort,
      });
      return {
        exerciseId: exercise.exerciseId,
        exerciseName: target.exerciseName,
        actionLabel: progressionActionLabel(target.decision.action),
        targetSummary: formatTargetSummary(target, units),
        explanation: target.decision.explanation,
        target,
      };
    });
}

function buildRirReview(exercises: PerformedExercise[]): WorkoutRirReview | null {
  const rows = exercises.flatMap((exercise) =>
    completedWorkingSets(exercise.sets).flatMap((set) =>
      set.rir == null
        ? []
        : [
            {
              rir: set.rir,
              target: exercise.prescription.targetRir,
            },
          ],
    ),
  );
  if (rows.length === 0) return null;

  const matchedSets = rows.filter((row) => Math.abs(row.rir - row.target) <= 0.5).length;
  const averageRir = round1(rows.reduce((sum, row) => sum + row.rir, 0) / rows.length);
  const averageTargetRir = round1(rows.reduce((sum, row) => sum + row.target, 0) / rows.length);
  const accuracyPct = Math.round((matchedSets / rows.length) * 100);

  return {
    loggedSets: rows.length,
    matchedSets,
    accuracyPct,
    averageRir,
    averageTargetRir,
    label: rirLabel(accuracyPct, averageRir, averageTargetRir),
    detail: `Avg RIR ${averageRir} vs target ${averageTargetRir}. ${matchedSets}/${rows.length} sets landed on plan.`,
  };
}

function buildFormReview(
  session: WorkoutSession,
  completedSetCount: number,
): WorkoutFormReview | null {
  const analyses = session.exercises.flatMap((exercise) =>
    exercise.sets.flatMap((set) => (set.formAnalysis ? [set.formAnalysis] : [])),
  );
  if (analyses.length === 0) return null;

  const averageScore = Math.round(
    analyses.reduce((sum, analysis) => sum + analysis.averageScore, 0) / analyses.length,
  );
  return {
    analyzedSetCount: analyses.length,
    averageScore,
    coveragePct:
      completedSetCount > 0 ? Math.round((analyses.length / completedSetCount) * 100) : 0,
    label: formLabel(averageScore),
    cue: mostUsefulFormCue(analyses),
  };
}

function mostUsefulFormCue(analyses: SetFormAnalysis[]): string {
  const issueCounts = new Map<string, number>();
  for (const analysis of analyses) {
    if (analysis.mostCommonIssue) {
      issueCounts.set(
        analysis.mostCommonIssue,
        (issueCounts.get(analysis.mostCommonIssue) ?? 0) + 1,
      );
    }
  }
  const issue = [...issueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (issue) return issue;

  return (
    analyses.flatMap((analysis) => analysis.recommendations)[0] ??
    'Keep this execution as the baseline for the next session.'
  );
}

function nextActionForReview({
  rir,
  form,
  summary,
  progression,
  units,
}: {
  rir: WorkoutRirReview | null;
  form: WorkoutFormReview | null;
  summary: ReturnType<typeof summarizeWorkoutSession>;
  progression: WorkoutProgressionReview[];
  units: Units;
}): string {
  if (form && form.averageScore < 80)
    return `Next run: keep load stable and clean up "${form.cue}".`;
  const loadJump = progression.find((item) => item.target.decision.action === 'increase_load');
  if (loadJump)
    return `Next run: ${loadJump.exerciseName} is ready. ${formatTargetWinCondition(loadJump.target, units)}`;
  const deload = progression.find((item) => item.target.decision.action === 'suggest_deload');
  if (deload) return `Next run: consider a lighter pass on ${deload.exerciseName}.`;
  if (rir && rir.averageRir > rir.averageTargetRir + 1) {
    return 'Next run: push the working sets closer to the planned RIR before adding load.';
  }
  if (rir && rir.averageRir < rir.averageTargetRir - 1) {
    return 'Next run: recover hard and watch fatigue, because intensity ran past the plan.';
  }
  if (summary.completedSets >= 8 && (!rir || rir.accuracyPct >= 70)) {
    return 'Next run: progression data looks usable. Try to beat the first working set target.';
  }
  if (!rir) return 'Next run: log RIR on working sets so the progression engine can steer better.';
  if (summary.completedSets < 8) {
    return 'Next run: repeat this setup once more before reading the trend too aggressively.';
  }
  return 'Next run: log RIR on more working sets so the progression engine can steer better.';
}

function rirLabel(accuracyPct: number, averageRir: number, averageTargetRir: number): string {
  if (accuracyPct >= 80) return 'Intensity on target';
  if (averageRir > averageTargetRir + 0.75) return 'Room to push';
  if (averageRir < averageTargetRir - 0.75) return 'Overshot effort';
  return 'Mixed RIR discipline';
}

function formLabel(score: number): string {
  if (score >= 90) return 'Clean technical session';
  if (score >= 80) return 'Solid execution';
  if (score >= 70) return 'Technique needs attention';
  return 'Form limited the set';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
