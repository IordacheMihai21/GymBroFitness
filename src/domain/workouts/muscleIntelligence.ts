import { getExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import { dayOfWeek } from '@/utils/dates';
import { MUSCLE_GROUPS, type MuscleGroup, type ProgramDay, type WorkoutSession } from '@/types';

import { estimateOneRepMax, setEfforts, volumeLoadKg } from './analytics';
import { classifyWeeklyVolume, volumeZoneLabel, type VolumeClassification } from './volumeLandmarks';

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

export type MuscleFatigueLabel = 'Fresh' | 'Ready' | 'Loaded' | 'Fatigued';

export type MuscleFatigue = {
  score: number;
  label: MuscleFatigueLabel;
  weeklySets: number;
  volume: VolumeClassification;
  volumeLabel: string;
  lastSessionSets: number;
  lastSessionName: string | null;
  lastTrainedAt: string | null;
  lastTrainedDaysAgo: number | null;
  averageRir: number | null;
};

export type MuscleStrengthRank = {
  rank: number | null;
  totalRanked: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'Unranked';
  topLoadKg: number | null;
  bestE1rmKg: number | null;
  leaderMuscle: MuscleGroup | null;
  leaderLoadKg: number | null;
};

export type MuscleIntelligence = {
  muscle: MuscleGroup;
  programExercises: MuscleProgramExercise[];
  records: MuscleExerciseRecord[];
  fatigue: MuscleFatigue;
  rank: MuscleStrengthRank;
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
): MuscleIntelligence[] {
  const completedSessions = history
    .filter((session) => session.status === 'completed')
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const recordsByMuscle = new Map<MuscleGroup, MuscleExerciseRecord[]>();
  const rankTable = buildStrengthRankTable(completedSessions);

  for (const muscle of MUSCLE_GROUPS) {
    recordsByMuscle.set(muscle, buildExerciseRecordsForMuscle(muscle, completedSessions));
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const records = recordsByMuscle.get(muscle) ?? [];
    return {
      muscle,
      programExercises: buildProgramExercisesForMuscle(programDays, muscle),
      records,
      fatigue: buildMuscleFatigue(muscle, completedSessions, now),
      rank: rankTable.get(muscle) ?? emptyRank(),
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

        return [{
          exerciseId: exercise.id,
          name: exercise.name,
          dayName: day.name,
          workingSets: prescription.workingSets,
          repRangeLabel: exercise.trackingType === 'time'
            ? `${prescription.minReps}-${prescription.maxReps}s`
            : `${prescription.minReps}-${prescription.maxReps} reps`,
          targetRir: prescription.targetRir,
          restSeconds: prescription.restSeconds,
          role,
        }];
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
      record.bestSessionVolumeKg = Math.max(record.bestSessionVolumeKg, Math.round(volumeLoadKg(performed.sets)));

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

function buildMuscleFatigue(
  muscle: MuscleGroup,
  completedSessions: WorkoutSession[],
  now: Date,
): MuscleFatigue {
  const weekStart = startOfWeek(now);
  const currentWeekSessions = completedSessions.filter((session) => {
    const startedAt = new Date(session.startedAt);
    return startedAt >= weekStart && startedAt <= now;
  });
  const weeklySets = currentWeekSessions.reduce(
    (total, session) => total + directSetsForMuscle(session, muscle),
    0,
  );
  const volume = classifyWeeklyVolume(muscle, weeklySets);
  const lastTouch = completedSessions
    .map((session) => muscleSessionTouch(session, muscle))
    .find((touch): touch is MuscleSessionTouch => touch != null && touch.sets > 0);
  const lastTrainedAt = lastTouch?.session.finishedAt ?? lastTouch?.session.startedAt ?? null;
  const lastTrainedDaysAgo = lastTrainedAt ? daysSince(lastTrainedAt, now) : null;
  const averageRir = lastTouch?.rirValues.length
    ? round1(lastTouch.rirValues.reduce((sum, rir) => sum + rir, 0) / lastTouch.rirValues.length)
    : null;
  const score = fatigueScore({
    weeklySets,
    volume,
    lastTrainedDaysAgo,
    averageRir,
  });

  return {
    score,
    label: fatigueLabel(score, volume),
    weeklySets,
    volume,
    volumeLabel: volumeZoneLabel(volume.zone),
    lastSessionSets: lastTouch?.sets ?? 0,
    lastSessionName: lastTouch?.session.dayName ?? null,
    lastTrainedAt,
    lastTrainedDaysAgo,
    averageRir,
  };
}

function buildStrengthRankTable(completedSessions: WorkoutSession[]): Map<MuscleGroup, MuscleStrengthRank> {
  const bestByMuscle = new Map<MuscleGroup, { topLoadKg: number; bestE1rmKg: number | null }>();

  for (const muscle of MUSCLE_GROUPS) {
    const records = buildExerciseRecordsForMuscle(muscle, completedSessions);
    const topLoadKg = Math.max(...records.map((record) => record.bestLoadKg ?? 0), 0);
    if (topLoadKg <= 0) continue;
    const bestE1rmKg = Math.max(...records.map((record) => record.bestE1rmKg ?? 0), 0);
    bestByMuscle.set(muscle, {
      topLoadKg,
      bestE1rmKg: bestE1rmKg > 0 ? bestE1rmKg : null,
    });
  }

  const leaderboard = [...bestByMuscle.entries()].sort(
    (a, b) => b[1].topLoadKg - a[1].topLoadKg || a[0].localeCompare(b[0]),
  );
  const leader = leaderboard[0];
  const result = new Map<MuscleGroup, MuscleStrengthRank>();

  for (const muscle of MUSCLE_GROUPS) {
    const entryIndex = leaderboard.findIndex(([candidate]) => candidate === muscle);
    if (entryIndex === -1) {
      result.set(muscle, {
        ...emptyRank(),
        totalRanked: leaderboard.length,
        leaderMuscle: leader?.[0] ?? null,
        leaderLoadKg: leader?.[1].topLoadKg ?? null,
      });
      continue;
    }

    const entry = leaderboard[entryIndex][1];
    const rank = entryIndex + 1;
    result.set(muscle, {
      rank,
      totalRanked: leaderboard.length,
      tier: rankTier(rank, leaderboard.length),
      topLoadKg: entry.topLoadKg,
      bestE1rmKg: entry.bestE1rmKg,
      leaderMuscle: leader?.[0] ?? null,
      leaderLoadKg: leader?.[1].topLoadKg ?? null,
    });
  }

  return result;
}

function directSetsForMuscle(session: WorkoutSession, muscle: MuscleGroup): number {
  return session.exercises.reduce((total, performed) => {
    const exercise = getExercise(performed.exerciseId);
    if (!exercise?.primaryMuscles.includes(muscle)) return total;
    return total + completedWorkingSets(performed.sets).length;
  }, 0);
}

function muscleSessionTouch(session: WorkoutSession, muscle: MuscleGroup): MuscleSessionTouch | null {
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

function fatigueScore({
  weeklySets,
  volume,
  lastTrainedDaysAgo,
  averageRir,
}: {
  weeklySets: number;
  volume: VolumeClassification;
  lastTrainedDaysAgo: number | null;
  averageRir: number | null;
}): number {
  const volumePressure = Math.min(1, weeklySets / Math.max(1, volume.landmarks.mrv)) * 58;
  const recencyPressure =
    lastTrainedDaysAgo == null
      ? 0
      : lastTrainedDaysAgo === 0
        ? 28
        : lastTrainedDaysAgo === 1
          ? 22
          : lastTrainedDaysAgo === 2
            ? 14
            : lastTrainedDaysAgo === 3
              ? 8
              : 0;
  const intensityPressure = averageRir == null ? 0 : averageRir <= 1 ? 12 : averageRir <= 2 ? 7 : 0;
  return Math.min(100, Math.round(volumePressure + recencyPressure + intensityPressure));
}

function fatigueLabel(score: number, volume: VolumeClassification): MuscleFatigueLabel {
  if (volume.zone === 'excessive' || score >= 72) return 'Fatigued';
  if (volume.zone === 'frontier' || score >= 48) return 'Loaded';
  if (score >= 18) return 'Ready';
  return 'Fresh';
}

function rankTier(rank: number, total: number): MuscleStrengthRank['tier'] {
  if (rank === 1) return 'S';
  if (total <= 1) return 'S';
  const percentile = (rank - 1) / Math.max(1, total - 1);
  if (percentile <= 0.25) return 'A';
  if (percentile <= 0.6) return 'B';
  return 'C';
}

function emptyRank(): MuscleStrengthRank {
  return {
    rank: null,
    totalRanked: 0,
    tier: 'Unranked',
    topLoadKg: null,
    bestE1rmKg: null,
    leaderMuscle: null,
    leaderLoadKg: null,
  };
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
