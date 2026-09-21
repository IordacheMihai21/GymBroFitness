import type {
  Exercise,
  ExercisePrescription,
  MuscleGroup,
  ProgramDay,
  TrainingPreferences,
  TrainingProgram,
} from '@/types';

import { availableExercises, requireExercise } from '../exercises/catalog';
import {
  DEFAULT_SETS,
  estimateExerciseMinutes,
  GOAL_REP_RANGES,
  GOAL_REST_SECONDS,
  HIGH_REP_MUSCLES,
  HIGH_REP_RANGE,
  TARGET_RIR,
  TIME_MODEL,
  TIME_RANGE_SECONDS,
} from './config';

export function updateProgramPrescription(
  program: TrainingProgram,
  dayIndex: number,
  prescriptionIndex: number,
  patch: Partial<ExercisePrescription>,
): TrainingProgram {
  return editProgramDay(program, dayIndex, (day) => {
    const prescriptions = day.prescriptions.map((prescription, index) =>
      index === prescriptionIndex ? { ...prescription, ...patch } : prescription,
    );
    return { ...day, prescriptions };
  });
}

export function moveProgramPrescription(
  program: TrainingProgram,
  dayIndex: number,
  fromIndex: number,
  toIndex: number,
): TrainingProgram {
  return editProgramDay(program, dayIndex, (day) => {
    const nextIndex = clamp(toIndex, 0, day.prescriptions.length - 1);
    if (nextIndex === fromIndex) return day;

    const prescriptions = [...day.prescriptions];
    const [moved] = prescriptions.splice(fromIndex, 1);
    if (!moved) return day;
    prescriptions.splice(nextIndex, 0, moved);
    return { ...day, prescriptions };
  });
}

export function addProgramPrescription(
  program: TrainingProgram,
  dayIndex: number,
  prescription: ExercisePrescription,
): TrainingProgram {
  return editProgramDay(program, dayIndex, (day) => ({
    ...day,
    prescriptions: [...day.prescriptions, prescription],
  }));
}

export function removeProgramPrescription(
  program: TrainingProgram,
  dayIndex: number,
  prescriptionIndex: number,
): TrainingProgram {
  return editProgramDay(program, dayIndex, (day) => {
    if (day.prescriptions.length <= 1) return day;
    const prescriptions = day.prescriptions.filter((_, index) => index !== prescriptionIndex);
    const previousIndex = prescriptionIndex - 1;
    const previous = prescriptions[previousIndex];
    if (previous?.supersetWithNext) {
      prescriptions[previousIndex] = { ...previous, supersetWithNext: false };
    }
    return { ...day, prescriptions };
  });
}

export function buildManualPrescription(
  exercise: Exercise,
  order: number,
  preferences: TrainingPreferences,
): ExercisePrescription {
  const muscle = exercise.primaryMuscles[0] ?? 'chest';
  const repRange = repRangeFor(exercise, muscle, preferences);

  return {
    exerciseId: exercise.id,
    order,
    workingSets: DEFAULT_SETS[preferences.experience][exercise.exerciseType],
    minReps: repRange.min,
    maxReps: repRange.max,
    targetRir: TARGET_RIR[preferences.experience],
    restSeconds: GOAL_REST_SECONDS[preferences.goal][exercise.exerciseType],
    selectionReason: `Added manually for ${muscle.replace(/_/g, ' ')} work. ${exercise.scienceExplanation}`,
  };
}

export function exerciseCandidatesForProgramDay(
  day: ProgramDay,
  preferences: TrainingPreferences,
  query = '',
): Exercise[] {
  const excludedSlugs = [
    ...preferences.excludedExerciseSlugs,
    ...preferences.discomfortExerciseSlugs,
  ];
  const usedExerciseIds = new Set(day.prescriptions.map((prescription) => prescription.exerciseId));
  const normalizedQuery = query.trim().toLowerCase();
  const focus = new Set(day.focus);

  return availableExercises(preferences.equipment, excludedSlugs)
    .filter((exercise) => !usedExerciseIds.has(exercise.id))
    .filter((exercise) => matchesQuery(exercise, normalizedQuery))
    .sort(
      (a, b) =>
        scoreCandidate(b, focus, preferences) - scoreCandidate(a, focus, preferences) ||
        a.name.localeCompare(b.name),
    );
}

export function recalculateProgramDay(day: ProgramDay): ProgramDay {
  const prescriptions = day.prescriptions.map((prescription, index, all) => {
    const normalized = { ...prescription, order: index };
    if (index === all.length - 1 && normalized.supersetWithNext) {
      return { ...normalized, supersetWithNext: false };
    }
    return normalized;
  });

  return {
    ...day,
    focus: focusFromPrescriptions(prescriptions),
    prescriptions,
    estimatedMinutes: Math.round(estimateProgramDayMinutes(prescriptions)),
  };
}

export function estimateProgramDayMinutes(prescriptions: ExercisePrescription[]): number {
  return (
    TIME_MODEL.sessionOverheadMinutes +
    prescriptions.reduce(
      (total, prescription) =>
        total + estimateExerciseMinutes(prescription.workingSets, prescription.restSeconds),
      0,
    )
  );
}

function editProgramDay(
  program: TrainingProgram,
  dayIndex: number,
  update: (day: ProgramDay) => ProgramDay,
): TrainingProgram {
  if (!program.days[dayIndex]) return program;
  const days = program.days.map((day, index) =>
    index === dayIndex ? recalculateProgramDay(update(day)) : day,
  );
  return markProgramEdited({ ...program, days });
}

function markProgramEdited(program: TrainingProgram): TrainingProgram {
  return {
    ...program,
    splitType: 'custom',
    name: program.name.includes('Edited') ? program.name : `${program.name} - Edited`,
    rationale: program.rationale.includes('Manual edits are preserved locally')
      ? program.rationale
      : `${program.rationale} Manual edits are preserved locally until you reset the plan.`,
  };
}

function focusFromPrescriptions(prescriptions: ExercisePrescription[]): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  for (const prescription of prescriptions) {
    for (const muscle of requireExercise(prescription.exerciseId).primaryMuscles) {
      seen.add(muscle);
    }
  }
  return [...seen];
}

function repRangeFor(exercise: Exercise, muscle: MuscleGroup, preferences: TrainingPreferences) {
  if (exercise.trackingType === 'time') return TIME_RANGE_SECONDS;
  if (
    preferences.goal !== 'strength' &&
    HIGH_REP_MUSCLES.includes(muscle) &&
    exercise.exerciseType === 'isolation'
  ) {
    return HIGH_REP_RANGE;
  }
  return GOAL_REP_RANGES[preferences.goal][exercise.exerciseType];
}

function matchesQuery(exercise: Exercise, query: string): boolean {
  if (!query) return true;
  const haystack = [
    exercise.name,
    exercise.slug,
    ...exercise.aliases,
    ...exercise.primaryMuscles,
    ...exercise.secondaryMuscles,
    exercise.movementPattern,
  ]
    .join(' ')
    .replace(/_/g, ' ')
    .toLowerCase();
  return haystack.includes(query);
}

function scoreCandidate(
  exercise: Exercise,
  focus: Set<MuscleGroup>,
  preferences: TrainingPreferences,
): number {
  let score = 0;
  for (const muscle of exercise.primaryMuscles) {
    if (focus.has(muscle)) score += 40;
    if (preferences.musclePriorities.includes(muscle)) score += 16;
  }
  for (const muscle of exercise.secondaryMuscles) {
    if (focus.has(muscle)) score += 12;
  }
  if (preferences.preferredExerciseSlugs.includes(exercise.slug)) score += 24;
  if (preferences.dislikedExerciseSlugs.includes(exercise.slug)) score -= 40;
  if (exercise.exerciseType === 'compound') score += 4;
  if (exercise.difficulty === preferences.experience) score += 3;
  return score;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
