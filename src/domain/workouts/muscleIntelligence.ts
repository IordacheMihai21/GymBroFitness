import { getExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import { dayOfWeek } from '@/utils/dates';
import {
  MUSCLE_GROUPS,
  type MuscleGroup,
  type ProgramDay,
  type Units,
  type WorkoutSession,
} from '@/types';
import { formatLoad } from '@/utils/units';

import { estimateOneRepMax, setEfforts, volumeLoadKg } from './analytics';
import { muscleSetContributions } from './muscleContributions';
import {
  classifyWeeklyVolume,
  volumeZoneLabel,
  type VolumeClassification,
} from './volumeLandmarks';

export type MuscleProgramExercise = {
  exerciseId: string;
  name: string;
  dayName: string;
  workingSets: number;
  repRangeLabel: string;
  targetRir: number;
  restSeconds: number;
  role: 'primary' | 'secondary';
};

export type MuscleExerciseRecord = {
  exerciseId: string;
  name: string;
  totalSets: number;
  lastSessionSets: number;
  lastPerformedAt: string | null;
  bestLoadKg: number | null;
  repsAtBestLoad: number | null;
  bestE1rmKg: number | null;
  bestSessionVolumeKg: number;
};

export type MuscleTrainingLoadLabel =
  | 'No direct history'
  | 'Indirect exposure'
  | 'Recent exposure'
  | 'Moderate weekly dose'
  | 'High weekly dose';

export type MuscleTrainingLoad = {
  label: MuscleTrainingLoadLabel;
  /** Kept for existing consumers; always identical to directSets. */
  weeklySets: number;
  directSets: number;
  indirectExposures: number;
  estimatedSecondarySets: number;
  weightedEstimate: number;
  unmappedIndirectExposures: number;
  contributionModelVersion: number;
  volume: VolumeClassification;
  volumeLabel: string;
  lastSessionSets: number;
  lastSessionName: string | null;
  lastTrainedAt: string | null;
  lastTrainedDaysAgo: number | null;
  averageRir: number | null;
};

export type MuscleRecentExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  volumeKg: number;
  bestSetLabel: string;
  averageFormScore: number | null;
};

export type MuscleRecentSession = {
  sessionId: string;
  dayName: string;
  performedAt: string;
  sets: number;
  volumeKg: number;
  averageRir: number | null;
  averageFormScore: number | null;
  exercises: MuscleRecentExercise[];
};

export type MuscleFormQuality = {
  analyzedSetCount: number;
  analyzedRepCount: number;
  averageScore: number | null;
  coveragePct: number;
  mostCommonIssue: string | null;
};

export type MuscleTrainingSignal = {
  kind: 'train' | 'maintain' | 'recover' | 'build_baseline';
  label: string;
  detail: string;
};

export type MuscleIntelligence = {
  muscle: MuscleGroup;
  programExercises: MuscleProgramExercise[];
  records: MuscleExerciseRecord[];
  trainingLoad: MuscleTrainingLoad;
  recentSessions: MuscleRecentSession[];
  formQuality: MuscleFormQuality;
  signal: MuscleTrainingSignal;
};

type MuscleSessionTouch = {
  session: WorkoutSession;
  sets: number;
  rirValues: number[];
};

type MutableExerciseRecord = MuscleExerciseRecord;

export function buildMuscleIntelligence(
  programDays: ProgramDay[],
  history: WorkoutSession[],
  now = new Date(),
  units: Units = 'kg',
): MuscleIntelligence[] {
  const completedSessions = history
    .filter((session) => session.status === 'completed')
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const recordsByMuscle = new Map<MuscleGroup, MuscleExerciseRecord[]>();

  for (const muscle of MUSCLE_GROUPS) {
    recordsByMuscle.set(muscle, buildExerciseRecordsForMuscle(muscle, completedSessions));
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const records = recordsByMuscle.get(muscle) ?? [];
    const trainingLoad = buildMuscleTrainingLoad(muscle, completedSessions, now);
    const recentSessions = buildRecentSessionsForMuscle(muscle, completedSessions, units);
    const formQuality = buildFormQualityForMuscle(muscle, completedSessions);
    return {
      muscle,
      programExercises: buildProgramExercisesForMuscle(programDays, muscle),
      records,
      trainingLoad,
      recentSessions,
      formQuality,
      signal: trainingSignal({ records, trainingLoad, formQuality }),
    };
  });
}

export function buildProgramExercisesForMuscle(
  programDays: ProgramDay[],
  muscle: MuscleGroup,
): MuscleProgramExercise[] {
  return programDays
    .flatMap((day) =>
      day.prescriptions.flatMap((prescription) => {
        const exercise = getExercise(prescription.exerciseId);
        if (!exercise) return [];
        let role: MuscleProgramExercise['role'] | null = null;
        if (exercise.primaryMuscles.includes(muscle)) role = 'primary';
        else if (exercise.secondaryMuscles.includes(muscle)) role = 'secondary';
        if (!role) return [];

        return [
          {
            exerciseId: exercise.id,
            name: exercise.name,
            dayName: day.name,
            workingSets: prescription.workingSets,
            repRangeLabel:
              exercise.trackingType === 'time'
                ? `${prescription.minReps}-${prescription.maxReps}s`
                : `${prescription.minReps}-${prescription.maxReps} reps`,
            targetRir: prescription.targetRir,
            restSeconds: prescription.restSeconds,
            role,
          },
        ];
      }),
    )
    .sort(
      (a, b) =>
        roleWeight(a.role) - roleWeight(b.role) ||
        a.dayName.localeCompare(b.dayName) ||
        a.name.localeCompare(b.name),
    );
}

export function buildExerciseRecordsForMuscle(
  muscle: MuscleGroup,
  completedSessions: WorkoutSession[],
): MuscleExerciseRecord[] {
  const records = new Map<string, MutableExerciseRecord>();

  for (const session of completedSessions) {
    for (const performed of session.exercises) {
      const exercise = getExercise(performed.exerciseId);
      if (!exercise?.primaryMuscles.includes(muscle)) continue;
      const workingSets = completedWorkingSets(performed.sets);
      if (workingSets.length === 0) continue;

      const record = records.get(exercise.id) ?? {
        exerciseId: exercise.id,
        name: exercise.name,
        totalSets: 0,
        lastSessionSets: 0,
        lastPerformedAt: null,
        bestLoadKg: null,
        repsAtBestLoad: null,
        bestE1rmKg: null,
        bestSessionVolumeKg: 0,
      };

      const sessionDate = session.finishedAt ?? session.startedAt;
      const isLatestForExercise =
        record.lastPerformedAt == null ||
        Date.parse(sessionDate) > Date.parse(record.lastPerformedAt);
      if (isLatestForExercise) {
        record.lastPerformedAt = sessionDate;
        record.lastSessionSets = workingSets.length;
      }

      record.totalSets += workingSets.length;
      record.bestSessionVolumeKg = Math.max(
        record.bestSessionVolumeKg,
        Math.round(volumeLoadKg(performed.sets)),
      );

      for (const effort of workingSets.flatMap(setEfforts)) {
        const load = effort.loadKg ?? 0;
        const reps = effort.reps ?? 0;
        if (load > 0 && (record.bestLoadKg == null || load > record.bestLoadKg)) {
          record.bestLoadKg = load;
          record.repsAtBestLoad = reps;
        }

        const e1rm = estimateOneRepMax(load, reps);
        if (e1rm != null && (record.bestE1rmKg == null || e1rm > record.bestE1rmKg)) {
          record.bestE1rmKg = e1rm;
        }
      }

      records.set(exercise.id, record);
    }
  }

  return [...records.values()].sort(
    (a, b) =>
      (b.bestE1rmKg ?? 0) - (a.bestE1rmKg ?? 0) ||
      (b.bestLoadKg ?? 0) - (a.bestLoadKg ?? 0) ||
      b.totalSets - a.totalSets ||
      a.name.localeCompare(b.name),
  );
}

function buildMuscleTrainingLoad(
  muscle: MuscleGroup,
  completedSessions: WorkoutSession[],
  now: Date,
): MuscleTrainingLoad {
  const weekStart = startOfWeek(now);
  const currentWeekSessions = completedSessions.filter((session) => {
    const startedAt = new Date(session.startedAt);
    return startedAt >= weekStart && startedAt <= now;
  });
  const contributions = muscleSetContributions(currentWeekSessions, muscle);
  const weeklySets = contributions.directSets;
  const volume = classifyWeeklyVolume(muscle, weeklySets);
  const lastTouch = completedSessions
    .map((session) => muscleSessionTouch(session, muscle))
    .find((touch): touch is MuscleSessionTouch => touch != null && touch.sets > 0);
  const lastTrainedAt = lastTouch?.session.finishedAt ?? lastTouch?.session.startedAt ?? null;
  const lastTrainedDaysAgo = lastTrainedAt ? daysSince(lastTrainedAt, now) : null;
  const averageRir = lastTouch?.rirValues.length
    ? round1(lastTouch.rirValues.reduce((sum, rir) => sum + rir, 0) / lastTouch.rirValues.length)
    : null;
  return {
    label: trainingLoadLabel(volume, lastTrainedAt, contributions.indirectExposures),
    weeklySets,
    directSets: contributions.directSets,
    indirectExposures: contributions.indirectExposures,
    estimatedSecondarySets: contributions.estimatedSecondarySets,
    weightedEstimate: contributions.weightedEstimate,
    unmappedIndirectExposures: contributions.unmappedIndirectExposures,
    contributionModelVersion: contributions.modelVersion,
    volume,
    volumeLabel: volumeZoneLabel(volume.zone),
    lastSessionSets: lastTouch?.sets ?? 0,
    lastSessionName: lastTouch?.session.dayName ?? null,
    lastTrainedAt,
    lastTrainedDaysAgo,
    averageRir,
  };
}

function buildRecentSessionsForMuscle(
  muscle: MuscleGroup,
  completedSessions: WorkoutSession[],
  units: Units,
): MuscleRecentSession[] {
  return completedSessions
    .flatMap((session) => {
      const exercises = session.exercises.flatMap((performed) => {
        const exercise = getExercise(performed.exerciseId);
        if (!exercise?.primaryMuscles.includes(muscle)) return [];
        const working = completedWorkingSets(performed.sets);
        if (working.length === 0) return [];

        return [
          {
            exerciseId: exercise.id,
            name: exercise.name,
            sets: working.length,
            volumeKg: Math.round(volumeLoadKg(performed.sets)),
            bestSetLabel: bestSetLabel(working, units),
            averageFormScore: averageFormScore(working),
          },
        ];
      });
      if (exercises.length === 0) return [];

      const rirValues = session.exercises.flatMap((performed) => {
        const exercise = getExercise(performed.exerciseId);
        if (!exercise?.primaryMuscles.includes(muscle)) return [];
        return completedWorkingSets(performed.sets)
          .map((set) => set.rir)
          .filter((rir): rir is number => rir != null);
      });
      const formScores = exercises
        .map((exercise) => exercise.averageFormScore)
        .filter((score): score is number => score != null);

      return [
        {
          sessionId: session.id,
          dayName: session.dayName,
          performedAt: session.finishedAt ?? session.startedAt,
          sets: exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
          volumeKg: exercises.reduce((sum, exercise) => sum + exercise.volumeKg, 0),
          averageRir: rirValues.length
            ? round1(rirValues.reduce((sum, rir) => sum + rir, 0) / rirValues.length)
            : null,
          averageFormScore: formScores.length
            ? Math.round(formScores.reduce((sum, score) => sum + score, 0) / formScores.length)
            : null,
          exercises,
        },
      ];
    })
    .slice(0, 4);
}

function buildFormQualityForMuscle(
  muscle: MuscleGroup,
  completedSessions: WorkoutSession[],
): MuscleFormQuality {
  let completedSetCount = 0;
  let analyzedRepCount = 0;
  const scores: number[] = [];
  const issues = new Map<string, number>();

  for (const session of completedSessions) {
    for (const performed of session.exercises) {
      const exercise = getExercise(performed.exerciseId);
      if (!exercise?.primaryMuscles.includes(muscle)) continue;
      const working = completedWorkingSets(performed.sets);
      completedSetCount += working.length;
      for (const set of working) {
        const analysis = set.formAnalysis;
        if (!analysis) continue;
        scores.push(analysis.averageScore);
        analyzedRepCount += analysis.repCount;
        if (analysis.mostCommonIssue) {
          issues.set(analysis.mostCommonIssue, (issues.get(analysis.mostCommonIssue) ?? 0) + 1);
        }
      }
    }
  }

  return {
    analyzedSetCount: scores.length,
    analyzedRepCount,
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    coveragePct: completedSetCount > 0 ? Math.round((scores.length / completedSetCount) * 100) : 0,
    mostCommonIssue: [...issues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

function trainingSignal({
  records,
  trainingLoad,
  formQuality,
}: {
  records: MuscleExerciseRecord[];
  trainingLoad: MuscleTrainingLoad;
  formQuality: MuscleFormQuality;
}): MuscleTrainingSignal {
  if (records.length === 0 && trainingLoad.weeklySets === 0) {
    if (trainingLoad.indirectExposures > 0) {
      return {
        kind: 'maintain',
        label: 'Indirect exposure logged',
        detail:
          'This muscle assisted other lifts. Direct sets and indirect exposures stay separate because they are not equivalent.',
      };
    }
    return {
      kind: 'build_baseline',
      label: 'Build baseline',
      detail: 'Log direct work here to establish recent exposure and exercise-specific records.',
    };
  }
  if (trainingLoad.volume.zone === 'excessive') {
    return {
      kind: 'recover',
      label: 'Review weekly dose',
      detail:
        'Direct sets are above the general reference; use performance and recovery feedback before adding more.',
    };
  }
  if (formQuality.averageScore != null && formQuality.averageScore < 80) {
    return {
      kind: 'maintain',
      label: 'Clean execution first',
      detail: formQuality.mostCommonIssue ?? 'Technique quality is limiting the signal.',
    };
  }
  if (trainingLoad.volume.zone === 'below_mv' || trainingLoad.volume.zone === 'maintenance') {
    return {
      kind: 'train',
      label: 'Low direct-set count',
      detail:
        'Direct sets are below the general weekly reference; add work only when it fits the plan and performance trend.',
    };
  }
  return {
    kind: 'maintain',
    label: 'Weekly dose logged',
    detail:
      'This is a reference range, not a recovery measurement. Let exercise performance guide progression.',
  };
}

function bestSetLabel(sets: ReturnType<typeof completedWorkingSets>, units: Units): string {
  const efforts = sets.flatMap(setEfforts);
  if (efforts.length === 0) return 'No sets';
  const best = efforts.reduce((current, effort) => {
    const currentLoad = current.loadKg ?? 0;
    const effortLoad = effort.loadKg ?? 0;
    if (effortLoad !== currentLoad) return effortLoad > currentLoad ? effort : current;
    return (effort.reps ?? 0) > (current.reps ?? 0) ? effort : current;
  });
  if (best.loadKg != null && best.loadKg > 0) {
    return `${formatLoad(best.loadKg, units)} x ${best.reps ?? 0}`;
  }
  return `${best.reps ?? 0} reps`;
}

function averageFormScore(sets: ReturnType<typeof completedWorkingSets>): number | null {
  const scores = sets
    .map((set) => set.formAnalysis?.averageScore)
    .filter((score): score is number => score != null);
  return scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null;
}

function muscleSessionTouch(
  session: WorkoutSession,
  muscle: MuscleGroup,
): MuscleSessionTouch | null {
  let sets = 0;
  const rirValues: number[] = [];

  for (const performed of session.exercises) {
    const exercise = getExercise(performed.exerciseId);
    if (!exercise?.primaryMuscles.includes(muscle)) continue;
    const working = completedWorkingSets(performed.sets);
    sets += working.length;
    rirValues.push(...working.map((set) => set.rir).filter((rir): rir is number => rir != null));
  }

  return sets > 0 ? { session, sets, rirValues } : null;
}

function trainingLoadLabel(
  volume: VolumeClassification,
  lastTrainedAt: string | null,
  indirectExposures: number,
): MuscleTrainingLoadLabel {
  if (!lastTrainedAt) return indirectExposures > 0 ? 'Indirect exposure' : 'No direct history';
  if (volume.zone === 'excessive' || volume.zone === 'frontier') return 'High weekly dose';
  if (volume.zone === 'growth') return 'Moderate weekly dose';
  return 'Recent exposure';
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOfWeek(d));
  return d;
}

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

function roleWeight(role: MuscleProgramExercise['role']): number {
  return role === 'primary' ? 0 : 1;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
