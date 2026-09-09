import type { EquipmentType, Exercise, ReplacementReason, TrainingPreferences } from '@/types';

import { EXERCISE_CATALOG, isExerciseAvailable } from './catalog';

export type ReplacementContext = {
  original: Exercise;
  reason: ReplacementReason;
  equipment: EquipmentType[];
  prefs: Pick<
    TrainingPreferences,
    | 'preferredExerciseSlugs'
    | 'dislikedExerciseSlugs'
    | 'excludedExerciseSlugs'
    | 'discomfortExerciseSlugs'
  >;
  /** Exercise ids already used in the current session. */
  usedExerciseIds: string[];
};

export type RankedReplacement = {
  exercise: Exercise;
  score: number;
  rationale: string;
};

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/**
 * Deterministic substitution ranking. Higher score = better substitute.
 * Ordering of concerns mirrors the product spec: primary muscle first,
 * then movement pattern, availability, similarity, preference.
 */
export function rankReplacements(ctx: ReplacementContext): RankedReplacement[] {
  const { original, reason, equipment, prefs } = ctx;
  const used = new Set(ctx.usedExerciseIds);
  const blocked = new Set([
    ...prefs.excludedExerciseSlugs,
    ...prefs.discomfortExerciseSlugs,
  ]);

  const candidates = EXERCISE_CATALOG.filter(
    (e) =>
      e.id !== original.id &&
      !blocked.has(e.slug) &&
      isExerciseAvailable(e, equipment) &&
      e.primaryMuscles.some((mus) => original.primaryMuscles.includes(mus)),
  );

  const ranked = candidates.map((e) => {
    let score = 0;
    const notes: string[] = [];

    if (original.primaryMuscles.every((mus) => e.primaryMuscles.includes(mus))) {
      score += 40;
      notes.push('same primary muscles');
    } else {
      score += 15;
      notes.push('overlapping primary muscle');
    }
    if (e.movementPattern === original.movementPattern) {
      score += 30;
      notes.push('same movement pattern');
    }
    if (original.equivalentAlternatives.includes(e.slug)) {
      score += 25;
      notes.push('listed as a direct equivalent');
    }
    if (e.exerciseType === original.exerciseType) score += 10;

    const difficultyGap =
      DIFFICULTY_ORDER[e.difficulty] - DIFFICULTY_ORDER[original.difficulty];
    if (reason === 'easier_alternative') {
      if (original.easierAlternatives.includes(e.slug)) {
        score += 35;
        notes.push('recommended easier option');
      }
      score -= difficultyGap * 15; // reward easier
    } else if (reason === 'harder_alternative') {
      if (original.harderAlternatives.includes(e.slug)) {
        score += 35;
        notes.push('recommended harder option');
      }
      score += difficultyGap * 15; // reward harder
    } else {
      score -= Math.abs(difficultyGap) * 8; // similar difficulty preferred
    }

    if (prefs.preferredExerciseSlugs.includes(e.slug)) {
      score += 20;
      notes.push('one of your preferred exercises');
    }
    if (prefs.dislikedExerciseSlugs.includes(e.slug)) score -= 35;
    if (used.has(e.id)) {
      score -= 50;
      notes.push('already used today');
    }
    if (
      (reason === 'equipment_unavailable' || reason === 'machine_occupied') &&
      e.equipment.every((eq) => !original.equipment.includes(eq))
    ) {
      score += 10;
      notes.push('uses different equipment');
    }

    return {
      exercise: e,
      score,
      rationale: `Ranked because it shares ${notes.length > 0 ? notes.join(', ') : 'a training target'} with ${original.name}.`,
    };
  });

  return ranked.sort(
    (a, b) => b.score - a.score || a.exercise.slug.localeCompare(b.exercise.slug),
  );
}
