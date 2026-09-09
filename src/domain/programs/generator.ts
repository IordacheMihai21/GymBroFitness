import type {
  Exercise,
  ExercisePrescription,
  MuscleGroup,
  ProgramDay,
  TrainingPreferences,
  TrainingProgram,
} from '@/types';
import { uuid } from '@/utils/ids';

import { availableExercises } from '../exercises/catalog';
import {
  DEFAULT_SETS,
  estimateExerciseMinutes,
  HIGH_REP_MUSCLES,
  HIGH_REP_RANGE,
  MAX_WEEKLY_SETS,
  MAX_WORKING_SETS_PER_EXERCISE,
  PRIORITY_EXTRA_WEEKLY_SETS,
  REP_RANGES,
  REST_SECONDS,
  TARGET_RIR,
  TIME_MODEL,
  TIME_RANGE_SECONDS,
} from './config';
import { selectSplit, Slot } from './splits';

export class ProgramGenerationError extends Error {}

type Candidate = { exercise: Exercise; score: number };

function scoreCandidate(
  exercise: Exercise,
  slot: Slot,
  prefs: TrainingPreferences,
  weeklyUsage: Map<string, number>,
): number {
  let score = 0;
  if (slot.patterns?.includes(exercise.movementPattern)) {
    // Earlier patterns in the slot list are the preferred ones.
    score += 30 - slot.patterns.indexOf(exercise.movementPattern) * 5;
  }
  if (slot.type && exercise.exerciseType === slot.type) score += 15;
  if (prefs.preferredExerciseSlugs.includes(exercise.slug)) score += 25;
  if (prefs.dislikedExerciseSlugs.includes(exercise.slug)) score -= 40;

  // Difficulty fit
  const { experience } = prefs;
  if (experience === 'beginner') {
    if (exercise.difficulty === 'beginner') score += 10;
    if (exercise.difficulty === 'advanced') score -= 100;
  } else if (experience === 'intermediate') {
    if (exercise.difficulty === 'advanced') score -= 10;
  } else {
    if (exercise.difficulty !== 'beginner') score += 5;
  }

  // Variety: penalize exercises already programmed this week.
  score -= (weeklyUsage.get(exercise.id) ?? 0) * 20;
  return score;
}

function pickExercise(
  slot: Slot,
  pool: Exercise[],
  prefs: TrainingPreferences,
  usedToday: Set<string>,
  weeklyUsage: Map<string, number>,
): Exercise | null {
  let candidates = pool.filter(
    (e) => e.primaryMuscles.includes(slot.muscle) && !usedToday.has(e.id),
  );
  if (slot.patterns) {
    const patternMatched = candidates.filter((e) => slot.patterns!.includes(e.movementPattern));
    if (patternMatched.length > 0) candidates = patternMatched;
  }
  if (candidates.length === 0) return null;

  const scored: Candidate[] = candidates.map((exercise) => ({
    exercise,
    score: scoreCandidate(exercise, slot, prefs, weeklyUsage),
  }));
  // Deterministic: score desc, then slug asc.
  scored.sort(
    (a, b) => b.score - a.score || a.exercise.slug.localeCompare(b.exercise.slug),
  );
  return scored[0].exercise;
}

function repRangeFor(exercise: Exercise, muscle: MuscleGroup) {
  if (exercise.trackingType === 'time') return TIME_RANGE_SECONDS;
  if (HIGH_REP_MUSCLES.includes(muscle) && exercise.exerciseType === 'isolation') {
    return HIGH_REP_RANGE;
  }
  return REP_RANGES[exercise.exerciseType];
}

function buildSelectionReason(
  exercise: Exercise,
  slot: Slot,
  prefs: TrainingPreferences,
): string {
  const parts: string[] = [];
  const muscleLabel = slot.muscle.replace('_', ' ');
  parts.push(`Covers ${muscleLabel} with a ${exercise.movementPattern.replace(/_/g, ' ')} movement you have equipment for.`);
  if (prefs.musclePriorities.includes(slot.muscle)) {
    parts.push(`${muscleLabel[0].toUpperCase()}${muscleLabel.slice(1)} is one of your priority muscles, so it gets extra weekly volume.`);
  }
  if (prefs.preferredExerciseSlugs.includes(exercise.slug)) {
    parts.push('You marked this as a preferred exercise.');
  }
  parts.push(exercise.scienceExplanation);
  return parts.join(' ');
}

function buildPrescription(
  exercise: Exercise,
  slot: Slot,
  order: number,
  prefs: TrainingPreferences,
): ExercisePrescription {
  const range = repRangeFor(exercise, slot.muscle);
  const sets = DEFAULT_SETS[prefs.experience][exercise.exerciseType];
  return {
    exerciseId: exercise.id,
    order,
    workingSets: sets,
    minReps: range.min,
    maxReps: range.max,
    targetRir: TARGET_RIR[prefs.experience],
    restSeconds: REST_SECONDS[exercise.exerciseType],
    selectionReason: buildSelectionReason(exercise, slot, prefs),
  };
}

function estimateDayMinutes(prescriptions: ExercisePrescription[]): number {
  return (
    TIME_MODEL.sessionOverheadMinutes +
    prescriptions.reduce(
      (total, p) => total + estimateExerciseMinutes(p.workingSets, p.restSeconds),
      0,
    )
  );
}

/** Count weekly working sets that hit `muscle` as a primary target. */
function weeklySetsByMuscle(
  days: { prescriptions: ExercisePrescription[] }[],
  exerciseById: Map<string, Exercise>,
): Map<MuscleGroup, number> {
  const counts = new Map<MuscleGroup, number>();
  for (const day of days) {
    for (const p of day.prescriptions) {
      const exercise = exerciseById.get(p.exerciseId);
      if (!exercise) continue;
      for (const muscle of exercise.primaryMuscles) {
        counts.set(muscle, (counts.get(muscle) ?? 0) + p.workingSets);
      }
    }
  }
  return counts;
}

export function generateProgram(prefs: TrainingPreferences, userId: string): TrainingProgram {
  const excluded = [
    ...prefs.excludedExerciseSlugs,
    ...prefs.discomfortExerciseSlugs,
  ];
  const pool = availableExercises(prefs.equipment, excluded);
  if (pool.length === 0) {
    throw new ProgramGenerationError(
      'No exercises match your equipment. Add at least bodyweight training in your equipment settings.',
    );
  }

  const split = selectSplit(prefs.daysPerWeek, prefs.experience);
  const weeklyUsage = new Map<string, number>();
  const exerciseById = new Map(pool.map((e) => [e.id, e]));

  type WorkingDay = {
    template: (typeof split.days)[number];
    prescriptions: ExercisePrescription[];
    slotByPrescription: Map<string, Slot>;
  };

  const workingDays: WorkingDay[] = split.days.map((template) => {
    const usedToday = new Set<string>();
    const prescriptions: ExercisePrescription[] = [];
    const slotByPrescription = new Map<string, Slot>();

    // Fill slots in trim order so essential movements are chosen first and
    // keep first pick of the candidate pool.
    const orderedSlots = [...template.slots].sort((a, b) => a.trimOrder - b.trimOrder);
    for (const slot of orderedSlots) {
      const exercise = pickExercise(slot, pool, prefs, usedToday, weeklyUsage);
      if (!exercise) continue;
      usedToday.add(exercise.id);
      weeklyUsage.set(exercise.id, (weeklyUsage.get(exercise.id) ?? 0) + 1);
      const prescription = buildPrescription(exercise, slot, prescriptions.length, prefs);
      prescriptions.push(prescription);
      slotByPrescription.set(prescription.exerciseId, slot);
    }

    // Fit the session into the time budget: drop the most optional slots first.
    while (
      prescriptions.length > 1 &&
      estimateDayMinutes(prescriptions) > prefs.sessionMinutes
    ) {
      let dropIndex = -1;
      let maxTrim = -1;
      prescriptions.forEach((p, i) => {
        const slot = slotByPrescription.get(p.exerciseId);
        const trim = slot?.trimOrder ?? 0;
        if (trim >= maxTrim) {
          maxTrim = trim;
          dropIndex = i;
        }
      });
      const [dropped] = prescriptions.splice(dropIndex, 1);
      const usage = weeklyUsage.get(dropped.exerciseId) ?? 1;
      weeklyUsage.set(dropped.exerciseId, usage - 1);
    }

    prescriptions.forEach((p, i) => (p.order = i));
    return { template, prescriptions, slotByPrescription };
  });

  if (workingDays.every((d) => d.prescriptions.length === 0)) {
    throw new ProgramGenerationError(
      'Could not build any training day from your equipment and exclusions. Review your excluded exercises.',
    );
  }

  // Priority volume: add sets for priority muscles, spread across the week.
  const setCounts = weeklySetsByMuscle(workingDays, exerciseById);
  for (const muscle of prefs.musclePriorities) {
    let remaining = PRIORITY_EXTRA_WEEKLY_SETS;
    const cap = MAX_WEEKLY_SETS[prefs.experience];
    const targets = workingDays
      .flatMap((d) => d.prescriptions)
      .filter((p) => exerciseById.get(p.exerciseId)?.primaryMuscles.includes(muscle))
      .sort((a, b) => a.workingSets - b.workingSets);
    for (const p of targets) {
      if (remaining <= 0) break;
      const current = setCounts.get(muscle) ?? 0;
      if (current >= cap) break;
      if (p.workingSets >= MAX_WORKING_SETS_PER_EXERCISE) continue;
      p.workingSets += 1;
      setCounts.set(muscle, current + 1);
      remaining -= 1;
    }
  }

  // Enforce weekly ceilings (defensive: priorities respect them already).
  for (const [muscle, count] of setCounts) {
    let over = count - MAX_WEEKLY_SETS[prefs.experience];
    if (over <= 0) continue;
    const targets = workingDays
      .flatMap((d) => d.prescriptions)
      .filter((p) => exerciseById.get(p.exerciseId)?.primaryMuscles.includes(muscle))
      .sort((a, b) => b.workingSets - a.workingSets);
    for (const p of targets) {
      while (over > 0 && p.workingSets > 2) {
        p.workingSets -= 1;
        over -= 1;
      }
    }
  }

  const days: ProgramDay[] = workingDays
    .filter((d) => d.prescriptions.length > 0)
    .map((d, i) => ({
      id: uuid(),
      name: d.template.name,
      order: i,
      focus: d.template.focus,
      prescriptions: d.prescriptions,
      estimatedMinutes: Math.round(estimateDayMinutes(d.prescriptions)),
    }));

  const priorityNote =
    prefs.musclePriorities.length > 0
      ? ` Extra weekly sets go to ${prefs.musclePriorities.map((m) => m.replace('_', ' ')).join(', ')}.`
      : '';

  return {
    id: uuid(),
    userId,
    name: split.name,
    splitType: split.splitType,
    daysPerWeek: prefs.daysPerWeek,
    days,
    createdAt: new Date().toISOString(),
    active: true,
    rationale:
      `A ${split.name} split fits ${prefs.daysPerWeek} training days of about ` +
      `${prefs.sessionMinutes} minutes. Each muscle is trained with enough weekly sets to grow ` +
      `at your ${prefs.experience} level, using only equipment you selected.${priorityNote} ` +
      'Loads start conservative; the progression engine tightens recommendations from your logged sets.',
  };
}
