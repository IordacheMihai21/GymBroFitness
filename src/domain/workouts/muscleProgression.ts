import { getExercise } from '@/domain/exercises/catalog';
import { completedWorkingSets } from '@/domain/progression/engine';
import { MUSCLE_GROUPS, type MuscleGroup, type WorkoutSession } from '@/types';

export type MuscleRank = 'Unranked' | 'C' | 'B' | 'A' | 'S';

export type MuscleRankRule = {
  rank: MuscleRank;
  minDirectSets: number;
  minSessions: number;
};

export const MUSCLE_RANK_RULES: MuscleRankRule[] = [
  { rank: 'Unranked', minDirectSets: 0, minSessions: 0 },
  { rank: 'C', minDirectSets: 8, minSessions: 2 },
  { rank: 'B', minDirectSets: 30, minSessions: 6 },
  { rank: 'A', minDirectSets: 75, minSessions: 15 },
  { rank: 'S', minDirectSets: 160, minSessions: 30 },
];

export type MuscleRankProgress = {
  muscle: MuscleGroup;
  rank: MuscleRank;
  directSets: number;
  sessionCount: number;
  nextRank: MuscleRank | null;
  progress: number;
  setsRemaining: number;
  sessionsRemaining: number;
};

export type BodyBadgeId =
  | 'first_workout'
  | 'ten_workouts'
  | 'century_sets'
  | 'full_body_base'
  | 'form_aware'
  | 'four_week_rhythm'
  | 'muscle_specialist';

export type BodyBadge = {
  id: BodyBadgeId;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  current: number;
  target: number;
  unit: string;
};

export type BodyProgression = {
  muscles: MuscleRankProgress[];
  badges: BodyBadge[];
  unlockedBadgeCount: number;
};

type MutableMuscleEvidence = {
  directSets: number;
  sessionIds: Set<string>;
};

/**
 * Ranks represent logged training evidence for each muscle, never muscle size,
 * recovery, or a comparison of loads between unrelated exercises.
 */
export function buildBodyProgression(history: WorkoutSession[]): BodyProgression {
  const completed = history.filter((session) => session.status === 'completed');
  const evidence = new Map<MuscleGroup, MutableMuscleEvidence>(
    MUSCLE_GROUPS.map((muscle) => [muscle, { directSets: 0, sessionIds: new Set<string>() }]),
  );
  let completedSetCount = 0;
  let analyzedSetCount = 0;
  const activeWeeks = new Set<string>();

  for (const session of completed) {
    activeWeeks.add(localWeekKey(session.finishedAt ?? session.startedAt));
    const touchedInSession = new Set<MuscleGroup>();

    for (const performed of session.exercises) {
      const workingSets = completedWorkingSets(performed.sets);
      completedSetCount += workingSets.length;
      analyzedSetCount += workingSets.filter((set) => set.formAnalysis != null).length;
      if (workingSets.length === 0) continue;

      const exercise = getExercise(performed.exerciseId);
      if (!exercise) continue;
      for (const muscle of exercise.primaryMuscles) {
        const muscleEvidence = evidence.get(muscle);
        if (!muscleEvidence) continue;
        muscleEvidence.directSets += workingSets.length;
        touchedInSession.add(muscle);
      }
    }

    for (const muscle of touchedInSession) evidence.get(muscle)?.sessionIds.add(session.id);
  }

  const muscles = MUSCLE_GROUPS.map((muscle) => {
    const muscleEvidence = evidence.get(muscle) ?? { directSets: 0, sessionIds: new Set<string>() };
    return rankProgress(muscle, muscleEvidence.directSets, muscleEvidence.sessionIds.size);
  });
  const trainedMuscleCount = muscles.filter((muscle) => muscle.directSets > 0).length;
  const bestRankIndex = Math.max(
    ...muscles.map((muscle) => MUSCLE_RANK_RULES.findIndex((rule) => rule.rank === muscle.rank)),
  );
  const specialistTarget = MUSCLE_RANK_RULES.find((rule) => rule.rank === 'B')!;
  const specialistCurrent = Math.max(
    ...muscles.map((muscle) =>
      Math.floor(
        Math.min(
          muscle.directSets / specialistTarget.minDirectSets,
          muscle.sessionCount / specialistTarget.minSessions,
        ) * 100,
      ),
    ),
  );

  const badges: BodyBadge[] = [
    badge(
      'first_workout',
      'First rep',
      'Complete your first workout.',
      'flag-checkered',
      completed.length,
      1,
      'workout',
    ),
    badge(
      'ten_workouts',
      'Built a habit',
      'Complete ten workouts.',
      'calendar-check',
      completed.length,
      10,
      'workouts',
    ),
    badge(
      'century_sets',
      'Century club',
      'Log 100 completed working sets.',
      'counter',
      completedSetCount,
      100,
      'sets',
    ),
    badge(
      'full_body_base',
      'Full-body base',
      'Log direct work for six muscle groups.',
      'human-handsup',
      trainedMuscleCount,
      6,
      'muscles',
    ),
    badge(
      'form_aware',
      'Form aware',
      'Analyze five completed sets with Form AI.',
      'camera-outline',
      analyzedSetCount,
      5,
      'sets',
    ),
    badge(
      'four_week_rhythm',
      'Four-week rhythm',
      'Train in four distinct calendar weeks.',
      'calendar-sync',
      activeWeeks.size,
      4,
      'weeks',
    ),
    badge(
      'muscle_specialist',
      'Muscle specialist',
      'Reach Rank B for one muscle group.',
      'shield-star-outline',
      bestRankIndex >= 2 ? 100 : specialistCurrent,
      100,
      '%',
    ),
  ];

  return {
    muscles,
    badges,
    unlockedBadgeCount: badges.filter((item) => item.unlocked).length,
  };
}

function rankProgress(
  muscle: MuscleGroup,
  directSets: number,
  sessionCount: number,
): MuscleRankProgress {
  let rankIndex = 0;
  for (let index = 1; index < MUSCLE_RANK_RULES.length; index += 1) {
    const rule = MUSCLE_RANK_RULES[index];
    if (directSets >= rule.minDirectSets && sessionCount >= rule.minSessions) rankIndex = index;
  }

  const current = MUSCLE_RANK_RULES[rankIndex];
  const next = MUSCLE_RANK_RULES[rankIndex + 1] ?? null;
  if (!next) {
    return {
      muscle,
      rank: current.rank,
      directSets,
      sessionCount,
      nextRank: null,
      progress: 1,
      setsRemaining: 0,
      sessionsRemaining: 0,
    };
  }

  const setSpan = Math.max(1, next.minDirectSets - current.minDirectSets);
  const sessionSpan = Math.max(1, next.minSessions - current.minSessions);
  const setProgress = (directSets - current.minDirectSets) / setSpan;
  const sessionProgress = (sessionCount - current.minSessions) / sessionSpan;

  return {
    muscle,
    rank: current.rank,
    directSets,
    sessionCount,
    nextRank: next.rank,
    progress: clamp01(Math.min(setProgress, sessionProgress)),
    setsRemaining: Math.max(0, next.minDirectSets - directSets),
    sessionsRemaining: Math.max(0, next.minSessions - sessionCount),
  };
}

function badge(
  id: BodyBadgeId,
  name: string,
  description: string,
  icon: string,
  current: number,
  target: number,
  unit: string,
): BodyBadge {
  return {
    id,
    name,
    description,
    icon,
    unlocked: current >= target,
    progress: clamp01(current / target),
    current,
    target,
    unit,
  };
}

function localWeekKey(iso: string): string {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
