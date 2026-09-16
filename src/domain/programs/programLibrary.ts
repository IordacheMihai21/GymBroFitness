import type {
  Exercise,
  ExercisePrescription,
  ExperienceLevel,
  MuscleGroup,
  SplitType,
  TrainingPreferences,
  TrainingProgram,
} from '@/types';
import { uuid } from '@/utils/ids';

import { availableExercises, isExerciseAvailable, requireExercise } from '../exercises/catalog';
import { recalculateProgramDay } from './programEditing';

export type ProgramLibraryCategory =
  'ppl' | 'upper_lower' | 'full_body' | 'powerbuilding' | 'specialization';

export type ProgramLibraryExerciseTemplate = {
  exerciseId: string;
  sets: number;
  minReps: number;
  maxReps: number;
  targetRir: number;
  restSeconds: number;
  note?: string;
  supersetWithNext?: boolean;
  setTechnique?: ExercisePrescription['setTechnique'];
};

export type ProgramLibraryDayTemplate = {
  name: string;
  prescriptions: ProgramLibraryExerciseTemplate[];
};

export type ProgramLibraryTemplate = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: ProgramLibraryCategory;
  splitType: SplitType;
  daysPerWeek: 3 | 4 | 5 | 6;
  level: ExperienceLevel;
  tags: string[];
  emphasis: MuscleGroup[];
  sourcePattern: string;
  days: ProgramLibraryDayTemplate[];
};

type BuildProgramFromLibraryInput = {
  userId: string;
  preferences: TrainingPreferences;
  now?: string;
};

export const PROGRAM_LIBRARY: ProgramLibraryTemplate[] = [
  {
    id: 'ppl-hypertrophy-6',
    name: 'PPL Hypertrophy System',
    subtitle: 'High-frequency push/pull/legs with overload targets',
    description:
      'A six-day bodybuilding split for lifters who recover well and want high weekly exposure per muscle.',
    category: 'ppl',
    splitType: 'push_pull_legs',
    daysPerWeek: 6,
    level: 'advanced',
    tags: ['High frequency', 'Volume bias', 'Intermediate+'],
    emphasis: ['chest', 'back', 'shoulders', 'quadriceps', 'hamstrings'],
    sourcePattern:
      'Inspired by program-library flows from Boostcamp and Hevy-style routine planning.',
    days: [
      {
        name: 'Push A - Upper Chest',
        prescriptions: [
          rx('incline-dumbbell-press', 3, 6, 10, 1, 180, 'Primary overload lift.'),
          rx('machine-chest-press', 3, 8, 12, 1, 150),
          rx('cable-lateral-raise', 4, 12, 20, 1, 75),
          rx('cable-fly', 3, 12, 20, 1, 75),
          rx('triceps-pushdown', 3, 10, 15, 1, 75),
          rx('overhead-triceps-extension', 2, 12, 18, 1, 75),
        ],
      },
      {
        name: 'Pull A - Width',
        prescriptions: [
          rx('pull-up', 3, 5, 8, 1, 180, 'Add load once top reps are clean.'),
          rx('chest-supported-row', 3, 8, 12, 1, 150),
          rx('lat-pulldown', 2, 10, 12, 1, 120),
          rx('face-pull', 3, 15, 25, 1, 60),
          rx('incline-dumbbell-curl', 3, 10, 15, 1, 75),
          rx('hammer-curl', 2, 10, 15, 1, 75),
        ],
      },
      {
        name: 'Legs A - Quad Base',
        prescriptions: [
          rx('hack-squat-machine', 3, 6, 10, 1, 180),
          rx('romanian-deadlift', 3, 6, 10, 1, 180),
          rx('leg-press', 2, 10, 15, 1, 150),
          rx('seated-leg-curl', 3, 10, 15, 1, 90),
          rx('standing-calf-raise', 4, 8, 15, 1, 60),
          rx('cable-crunch', 3, 10, 15, 1, 60),
        ],
      },
      {
        name: 'Push B - Press Strength',
        prescriptions: [
          rx('barbell-bench-press', 3, 5, 8, 1, 180, 'Set 1 is the progression anchor.'),
          rx('seated-dumbbell-press', 3, 8, 12, 1, 150),
          rx('pec-deck', 3, 12, 20, 1, 75),
          rx('machine-lateral-raise', 4, 12, 20, 1, 75),
          rx('skull-crusher', 3, 8, 12, 1, 90),
          rx('diamond-push-up', 2, 12, 20, 1, 60),
        ],
      },
      {
        name: 'Pull B - Thickness',
        prescriptions: [
          rx('barbell-row', 3, 6, 10, 1, 180),
          rx('chin-up', 3, 6, 10, 1, 180),
          rx('seated-cable-row', 3, 10, 12, 1, 120),
          rx('straight-arm-pulldown', 2, 12, 20, 1, 75),
          rx('preacher-curl', 3, 10, 15, 1, 75),
          rx('cable-curl', 2, 12, 20, 1, 75),
        ],
      },
      {
        name: 'Legs B - Posterior Chain',
        prescriptions: [
          rx('barbell-back-squat', 3, 5, 8, 1, 180),
          rx('hip-thrust', 3, 8, 12, 1, 150),
          rx('leg-extension', 3, 12, 20, 1, 75),
          rx('lying-leg-curl', 3, 10, 15, 1, 90),
          rx('seated-calf-raise', 4, 10, 20, 1, 60),
          rx('hanging-knee-raise', 3, 10, 15, 1, 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower-hypertrophy-4',
    name: 'Upper / Lower Hypertrophy',
    subtitle: 'Four days, clean recovery, balanced growth',
    description:
      'A practical four-day split with enough weekly volume for serious hypertrophy without living in the gym.',
    category: 'upper_lower',
    splitType: 'upper_lower',
    daysPerWeek: 4,
    level: 'intermediate',
    tags: ['Balanced', 'Recovery friendly', '4-day'],
    emphasis: ['chest', 'back', 'quadriceps', 'hamstrings'],
    sourcePattern: 'Matches the simple routine-planner pattern seen in Hevy and Strong-style apps.',
    days: [
      {
        name: 'Upper A - Press / Pull',
        prescriptions: [
          rx('dumbbell-bench-press', 3, 6, 10, 1, 150),
          rx('lat-pulldown', 3, 8, 12, 1, 120),
          rx('seated-dumbbell-press', 3, 8, 12, 1, 120),
          rx('seated-cable-row', 3, 10, 12, 1, 120),
          rx('cable-lateral-raise', 3, 12, 20, 1, 75),
          rx('triceps-pushdown', 2, 10, 15, 1, 75),
          rx('cable-curl', 2, 10, 15, 1, 75),
        ],
      },
      {
        name: 'Lower A - Squat Bias',
        prescriptions: [
          rx('barbell-back-squat', 3, 5, 8, 1, 180),
          rx('romanian-deadlift', 3, 6, 10, 1, 180),
          rx('leg-press', 3, 10, 15, 1, 150),
          rx('seated-leg-curl', 3, 10, 15, 1, 90),
          rx('standing-calf-raise', 4, 8, 15, 1, 60),
          rx('cable-crunch', 3, 10, 15, 1, 60),
        ],
      },
      {
        name: 'Upper B - Chest / Back',
        prescriptions: [
          rx('incline-barbell-press', 3, 6, 10, 1, 180),
          rx('pull-up', 3, 5, 8, 1, 180),
          rx('machine-row', 3, 8, 12, 1, 120),
          rx('machine-shoulder-press', 2, 8, 12, 1, 120),
          rx('pec-deck', 3, 12, 20, 1, 75),
          rx('ez-bar-curl', 2, 10, 15, 1, 75),
          rx('overhead-triceps-extension', 2, 12, 18, 1, 75),
        ],
      },
      {
        name: 'Lower B - Glute / Ham',
        prescriptions: [
          rx('hack-squat-machine', 3, 6, 10, 1, 180),
          rx('hip-thrust', 3, 8, 12, 1, 150),
          rx('leg-extension', 3, 12, 20, 1, 75),
          rx('lying-leg-curl', 3, 10, 15, 1, 90),
          rx('walking-lunge', 2, 10, 14, 1, 90),
          rx('seated-calf-raise', 4, 10, 20, 1, 60),
          rx('hanging-knee-raise', 3, 10, 15, 1, 60),
        ],
      },
    ],
  },
  {
    id: 'full-body-minimalist-3',
    name: 'Full Body Minimalist',
    subtitle: 'Three high-signal sessions for busy lifters',
    description:
      'A stripped-down full-body setup that keeps the big hypertrophy levers covered with low complexity.',
    category: 'full_body',
    splitType: 'full_body',
    daysPerWeek: 3,
    level: 'beginner',
    tags: ['Low friction', '3-day', 'Efficient'],
    emphasis: ['chest', 'back', 'quadriceps', 'hamstrings', 'shoulders'],
    sourcePattern:
      'Borrowed from proven full-body routine structure used across public program libraries.',
    days: [
      {
        name: 'Full Body A',
        prescriptions: [
          rx('barbell-back-squat', 3, 5, 8, 2, 180),
          rx('dumbbell-bench-press', 3, 8, 12, 2, 150),
          rx('lat-pulldown', 3, 8, 12, 2, 120),
          rx('romanian-deadlift', 2, 8, 10, 2, 150),
          rx('lateral-raise', 3, 12, 20, 1, 60),
          rx('cable-crunch', 2, 10, 15, 1, 60),
        ],
      },
      {
        name: 'Full Body B',
        prescriptions: [
          rx('leg-press', 3, 10, 15, 2, 150),
          rx('seated-dumbbell-press', 3, 8, 12, 2, 120),
          rx('seated-cable-row', 3, 8, 12, 2, 120),
          rx('hip-thrust', 3, 8, 12, 2, 150),
          rx('cable-fly', 2, 12, 20, 1, 75),
          rx('cable-curl', 2, 10, 15, 1, 60, undefined, true),
          rx('triceps-pushdown', 2, 10, 15, 1, 60),
        ],
      },
      {
        name: 'Full Body C',
        prescriptions: [
          rx('hack-squat-machine', 3, 6, 10, 2, 180),
          rx('incline-dumbbell-press', 3, 8, 12, 2, 150),
          rx('chin-up', 3, 6, 10, 2, 150),
          rx('seated-leg-curl', 3, 10, 15, 1, 90),
          rx('machine-lateral-raise', 3, 12, 20, 1, 60),
          rx('standing-calf-raise', 3, 8, 15, 1, 60),
          rx('hanging-knee-raise', 2, 10, 15, 1, 60),
        ],
      },
    ],
  },
  {
    id: 'powerbuilding-base-4',
    name: 'Powerbuilding Base',
    subtitle: 'Heavy anchors plus bodybuilding accessories',
    description:
      'A four-day setup for lifters who care about numbers and physique: heavy top work first, volume after.',
    category: 'powerbuilding',
    splitType: 'upper_lower',
    daysPerWeek: 4,
    level: 'intermediate',
    tags: ['Strength + size', 'Top sets', 'Progression'],
    emphasis: ['chest', 'back', 'quadriceps', 'hamstrings', 'triceps'],
    sourcePattern:
      'Inspired by Liftosaur-style editable strength templates plus hypertrophy accessories.',
    days: [
      {
        name: 'Upper Strength',
        prescriptions: [
          rx('barbell-bench-press', 4, 4, 6, 1, 210, 'Top-set anchor.', false, 'top_backoff'),
          rx('barbell-row', 4, 5, 8, 1, 180),
          rx('overhead-press', 3, 5, 8, 1, 180),
          rx('pull-up', 3, 5, 8, 1, 180),
          rx('close-grip-bench-press', 2, 6, 10, 1, 150),
          rx('barbell-curl', 2, 8, 12, 1, 90),
        ],
      },
      {
        name: 'Lower Strength',
        prescriptions: [
          rx('barbell-back-squat', 4, 4, 6, 1, 210, 'Top-set anchor.', false, 'top_backoff'),
          rx('romanian-deadlift', 3, 5, 8, 1, 180),
          rx('leg-press', 3, 8, 12, 1, 150),
          rx('standing-calf-raise', 4, 8, 15, 1, 60),
          rx('ab-wheel-rollout', 3, 8, 12, 1, 60),
        ],
      },
      {
        name: 'Upper Hypertrophy',
        prescriptions: [
          rx('incline-dumbbell-press', 3, 8, 12, 1, 150),
          rx('chest-supported-row', 3, 8, 12, 1, 120),
          rx('lat-pulldown', 3, 10, 12, 1, 120),
          rx('lateral-raise', 4, 12, 20, 1, 60),
          rx('cable-fly', 3, 12, 20, 1, 75),
          rx('triceps-pushdown', 3, 10, 15, 1, 75),
          rx('cable-curl', 3, 10, 15, 1, 75),
        ],
      },
      {
        name: 'Lower Hypertrophy',
        prescriptions: [
          rx('hack-squat-machine', 3, 8, 12, 1, 150),
          rx('hip-thrust', 3, 8, 12, 1, 150),
          rx('seated-leg-curl', 3, 10, 15, 1, 90),
          rx('leg-extension', 3, 12, 20, 1, 75),
          rx('bulgarian-split-squat', 2, 8, 12, 1, 90),
          rx('seated-calf-raise', 4, 10, 20, 1, 60),
          rx('cable-crunch', 3, 10, 15, 1, 60),
        ],
      },
    ],
  },
  {
    id: 'chest-back-specialization-5',
    name: 'Chest / Back Specialization',
    subtitle: 'Torso-first block with legs on maintenance',
    description:
      'A five-day specialization block for lifters whose chest and back need the strongest growth signal.',
    category: 'specialization',
    splitType: 'custom',
    daysPerWeek: 5,
    level: 'advanced',
    tags: ['Specialization', 'Torso focus', '5-day'],
    emphasis: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
    sourcePattern: 'Inspired by coach-program browsing patterns from Boostcamp-style libraries.',
    days: [
      {
        name: 'Chest Overload',
        prescriptions: [
          rx('incline-barbell-press', 3, 5, 8, 1, 180),
          rx('dumbbell-bench-press', 3, 8, 12, 1, 150),
          rx('cable-fly', 3, 12, 20, 1, 75),
          rx('machine-lateral-raise', 3, 12, 20, 1, 60),
          rx('triceps-pushdown', 3, 10, 15, 1, 75),
        ],
      },
      {
        name: 'Back Width',
        prescriptions: [
          rx('pull-up', 3, 5, 8, 1, 180),
          rx('lat-pulldown', 3, 8, 12, 1, 120),
          rx('straight-arm-pulldown', 3, 12, 20, 1, 75),
          rx('face-pull', 3, 15, 25, 1, 60),
          rx('incline-dumbbell-curl', 3, 10, 15, 1, 75),
        ],
      },
      {
        name: 'Legs Maintenance',
        prescriptions: [
          rx('hack-squat-machine', 3, 6, 10, 1, 180),
          rx('romanian-deadlift', 3, 6, 10, 1, 180),
          rx('seated-leg-curl', 2, 10, 15, 1, 90),
          rx('standing-calf-raise', 3, 8, 15, 1, 60),
          rx('cable-crunch', 2, 10, 15, 1, 60),
        ],
      },
      {
        name: 'Chest / Delts Pump',
        prescriptions: [
          rx('machine-chest-press', 3, 8, 12, 1, 150),
          rx('pec-deck', 3, 12, 20, 1, 75, 'Controlled stretch, no ego load.'),
          rx('seated-dumbbell-press', 2, 8, 12, 1, 120),
          rx('cable-lateral-raise', 4, 12, 20, 1, 60),
          rx('overhead-triceps-extension', 3, 12, 18, 1, 75),
          rx('diamond-push-up', 2, 12, 20, 1, 60),
        ],
      },
      {
        name: 'Back Thickness / Arms',
        prescriptions: [
          rx('barbell-row', 3, 6, 10, 1, 180),
          rx('machine-row', 3, 8, 12, 1, 120),
          rx('chest-supported-row', 2, 10, 12, 1, 120),
          rx('reverse-fly', 3, 15, 25, 1, 60),
          rx('preacher-curl', 3, 10, 15, 1, 75),
          rx('hammer-curl', 2, 10, 15, 1, 75),
        ],
      },
    ],
  },
];

export function listProgramLibraryTemplates(
  preferences?: TrainingPreferences,
): ProgramLibraryTemplate[] {
  const templates = [...PROGRAM_LIBRARY];
  if (!preferences) return templates;
  return templates.sort(
    (a, b) =>
      scoreTemplate(b, preferences) - scoreTemplate(a, preferences) || a.name.localeCompare(b.name),
  );
}

export function getProgramLibraryTemplate(id: string): ProgramLibraryTemplate | undefined {
  return PROGRAM_LIBRARY.find((template) => template.id === id);
}

export function buildProgramFromLibraryTemplate(
  templateId: string,
  input: BuildProgramFromLibraryInput,
): TrainingProgram {
  const template = getProgramLibraryTemplate(templateId);
  if (!template) throw new Error(`Unknown program library template: ${templateId}`);

  const days = template.days.map((day, dayIndex) =>
    recalculateProgramDay({
      id: `library-day-${dayIndex + 1}-${uuid()}`,
      name: day.name,
      order: dayIndex,
      focus: [],
      prescriptions: buildDayPrescriptions(day, input.preferences),
      estimatedMinutes: 0,
    }),
  );

  return {
    id: `library-program-${uuid()}`,
    userId: input.userId,
    name: template.name,
    splitType: template.splitType,
    daysPerWeek: days.length,
    days,
    createdAt: input.now ?? new Date().toISOString(),
    active: true,
    rationale: buildRationale(template, input.preferences),
  };
}

export function templateWeeklySetCount(template: ProgramLibraryTemplate): number {
  return template.days.reduce(
    (total, day) =>
      total + day.prescriptions.reduce((dayTotal, prescription) => dayTotal + prescription.sets, 0),
    0,
  );
}

function buildDayPrescriptions(
  day: ProgramLibraryDayTemplate,
  preferences: TrainingPreferences,
): ExercisePrescription[] {
  const usedToday = new Set<string>();

  return day.prescriptions.map((prescription, order) => {
    const original = requireExercise(prescription.exerciseId);
    const exercise = resolveExercise(original, preferences, usedToday);
    usedToday.add(exercise.id);

    return {
      exerciseId: exercise.id,
      order,
      workingSets: adjustSets(prescription.sets, preferences.experience, exercise),
      minReps: prescription.minReps,
      maxReps: prescription.maxReps,
      targetRir: adjustRir(prescription.targetRir, preferences.experience),
      restSeconds: prescription.restSeconds,
      note: prescription.note,
      setTechnique: prescription.setTechnique,
      supersetWithNext: prescription.supersetWithNext,
      selectionReason: buildSelectionReason(original, exercise, preferences),
    };
  });
}

function resolveExercise(
  original: Exercise,
  preferences: TrainingPreferences,
  usedToday: Set<string>,
): Exercise {
  if (isAllowed(original, preferences, usedToday)) return original;

  const excluded = [...preferences.excludedExerciseSlugs, ...preferences.discomfortExerciseSlugs];
  const pool = availableExercises(preferences.equipment, excluded);
  const alternativeSlugs = [
    ...original.equivalentAlternatives,
    ...original.easierAlternatives,
    ...original.harderAlternatives,
  ];

  const directAlternative = alternativeSlugs
    .map((slug) => pool.find((candidate) => candidate.slug === slug))
    .find((candidate): candidate is Exercise => !!candidate && !usedToday.has(candidate.id));
  if (directAlternative) return directAlternative;

  const scored = pool
    .filter((candidate) => !usedToday.has(candidate.id))
    .filter((candidate) => overlaps(candidate.primaryMuscles, original.primaryMuscles))
    .map((candidate) => ({
      candidate,
      score: replacementScore(candidate, original, preferences),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));

  return scored[0]?.candidate ?? original;
}

function isAllowed(
  exercise: Exercise,
  preferences: TrainingPreferences,
  usedToday: Set<string>,
): boolean {
  const blocked = new Set([
    ...preferences.excludedExerciseSlugs,
    ...preferences.discomfortExerciseSlugs,
  ]);
  return (
    !usedToday.has(exercise.id) &&
    !blocked.has(exercise.slug) &&
    isExerciseAvailable(exercise, preferences.equipment)
  );
}

function replacementScore(
  candidate: Exercise,
  original: Exercise,
  preferences: TrainingPreferences,
): number {
  let score = 0;
  for (const muscle of candidate.primaryMuscles) {
    if (original.primaryMuscles.includes(muscle)) score += 30;
    if (preferences.musclePriorities.includes(muscle)) score += 12;
  }
  if (candidate.movementPattern === original.movementPattern) score += 24;
  if (candidate.exerciseType === original.exerciseType) score += 8;
  if (candidate.difficulty === preferences.experience) score += 4;
  if (preferences.preferredExerciseSlugs.includes(candidate.slug)) score += 16;
  if (preferences.dislikedExerciseSlugs.includes(candidate.slug)) score -= 40;
  return score;
}

function buildSelectionReason(
  original: Exercise,
  exercise: Exercise,
  preferences: TrainingPreferences,
): string {
  const muscles = exercise.primaryMuscles.map((muscle) => muscle.replace('_', ' ')).join(', ');
  const prefix =
    original.id === exercise.id
      ? `Library pick for ${muscles}.`
      : `Auto-swapped from ${original.name} to ${exercise.name} for your equipment/preferences.`;
  const priority = exercise.primaryMuscles.some((muscle) =>
    preferences.musclePriorities.includes(muscle),
  )
    ? ' This also supports one of your priority muscles.'
    : '';
  return `${prefix}${priority} ${exercise.scienceExplanation}`;
}

function buildRationale(
  template: ProgramLibraryTemplate,
  preferences: TrainingPreferences,
): string {
  const match =
    template.daysPerWeek === preferences.daysPerWeek
      ? 'It matches your selected training frequency.'
      : `It runs ${template.daysPerWeek} days/week instead of your current ${preferences.daysPerWeek}-day preference.`;
  const priorityMatches = template.emphasis.filter((muscle) =>
    preferences.musclePriorities.includes(muscle),
  );
  const priority =
    priorityMatches.length > 0
      ? ` It reinforces your priority muscles: ${priorityMatches
          .map((muscle) => muscle.replace('_', ' '))
          .join(', ')}.`
      : '';
  return `${template.description} ${match}${priority} Exercises auto-adapt to your equipment and blocked movements; edit any day after import.`;
}

function adjustSets(
  sets: number,
  experience: TrainingPreferences['experience'],
  exercise: Exercise,
): number {
  if (experience === 'beginner') return Math.max(2, Math.min(4, sets - 1));
  if (experience === 'advanced' && exercise.exerciseType === 'isolation') {
    return Math.min(5, sets + 1);
  }
  return sets;
}

function adjustRir(targetRir: number, experience: TrainingPreferences['experience']): number {
  if (experience === 'beginner') return Math.max(targetRir, 2);
  if (experience === 'advanced') return Math.max(0, targetRir - 1);
  return targetRir;
}

function scoreTemplate(template: ProgramLibraryTemplate, preferences: TrainingPreferences): number {
  let score = 0;
  if (template.daysPerWeek === preferences.daysPerWeek) score += 40;
  if (template.daysPerWeek <= preferences.daysPerWeek) score += 8;
  if (template.level === preferences.experience) score += 14;
  for (const muscle of template.emphasis) {
    if (preferences.musclePriorities.includes(muscle)) score += 10;
  }
  return score;
}

function overlaps(a: MuscleGroup[], b: MuscleGroup[]): boolean {
  return a.some((item) => b.includes(item));
}

function rx(
  exerciseId: string,
  sets: number,
  minReps: number,
  maxReps: number,
  targetRir: number,
  restSeconds: number,
  note?: string,
  supersetWithNext = false,
  setTechnique?: ExercisePrescription['setTechnique'],
): ProgramLibraryExerciseTemplate {
  requireExercise(exerciseId);
  return {
    exerciseId,
    sets,
    minReps,
    maxReps,
    targetRir,
    restSeconds,
    note,
    supersetWithNext,
    setTechnique,
  };
}
