import { ENVIRONMENT_EQUIPMENT } from '@/domain/exercises/catalog';
import type {
  CoachingTone,
  DayOfWeek,
  EquipmentType,
  ExperienceLevel,
  MuscleGroup,
  TrainingEnvironment,
  TrainingGoal,
  TrainingPreferences,
  Units,
  UserProfile,
} from '@/types';
import { uuid } from '@/utils/ids';

type DaysPerWeek = TrainingPreferences['daysPerWeek'];
type SessionMinutes = TrainingPreferences['sessionMinutes'];

export type OnboardingInput = {
  displayName: string;
  goal: TrainingGoal;
  experience: ExperienceLevel;
  environment: Exclude<TrainingEnvironment, 'custom'>;
  equipment: EquipmentType[];
  daysPerWeek: DaysPerWeek;
  preferredDays: DayOfWeek[];
  sessionMinutes: SessionMinutes;
  musclePriorities: MuscleGroup[];
  units: Units;
  coachingTone?: CoachingTone;
};

export type OnboardingValidationIssue = {
  field: keyof OnboardingInput;
  message: string;
};

const DEFAULT_DAYS: Record<DaysPerWeek, DayOfWeek[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
};

export function validateOnboardingInput(input: OnboardingInput): OnboardingValidationIssue[] {
  const issues: OnboardingValidationIssue[] = [];
  const displayName = input.displayName.trim();

  if (displayName.length < 2) {
    issues.push({ field: 'displayName', message: 'Use at least 2 characters for your name.' });
  }

  if (input.preferredDays.length !== input.daysPerWeek) {
    issues.push({
      field: 'preferredDays',
      message: `Select exactly ${input.daysPerWeek} training days.`,
    });
  }

  if (new Set(input.preferredDays).size !== input.preferredDays.length) {
    issues.push({ field: 'preferredDays', message: 'Training days must be unique.' });
  }

  if (input.equipment.length === 0) {
    issues.push({ field: 'equipment', message: 'Select at least one available equipment type.' });
  }

  if (input.musclePriorities.length > 3) {
    issues.push({ field: 'musclePriorities', message: 'Choose up to three priority muscles.' });
  }

  return issues;
}

export function buildOnboardingProfile(
  input: OnboardingInput,
  createdAt = new Date().toISOString(),
): UserProfile {
  return {
    id: `local-${uuid()}`,
    displayName: input.displayName.trim(),
    createdAt,
    onboardingCompleted: true,
  };
}

export function buildOnboardingPreferences(input: OnboardingInput): TrainingPreferences {
  return {
    goal: input.goal,
    nutritionContext: 'unknown',
    experience: input.experience,
    environment: input.environment,
    equipment: [...input.equipment],
    daysPerWeek: input.daysPerWeek,
    preferredDays: [...input.preferredDays],
    sessionMinutes: input.sessionMinutes,
    musclePriorities: [...input.musclePriorities],
    preferredExerciseSlugs: [],
    dislikedExerciseSlugs: [],
    excludedExerciseSlugs: [],
    discomfortExerciseSlugs: [],
    units: input.units,
    coachingTone: input.coachingTone ?? coachingToneFor(input.experience),
  };
}

export function defaultEquipmentForEnvironment(
  environment: OnboardingInput['environment'],
): EquipmentType[] {
  return [...ENVIRONMENT_EQUIPMENT[environment]];
}

export function fitOnboardingDays(daysPerWeek: DaysPerWeek, current: DayOfWeek[]): DayOfWeek[] {
  const defaults = DEFAULT_DAYS[daysPerWeek];
  return [...current, ...defaults]
    .filter((day, index, days) => days.indexOf(day) === index)
    .slice(0, daysPerWeek)
    .sort((a, b) => a - b);
}

function coachingToneFor(experience: ExperienceLevel): CoachingTone {
  if (experience === 'advanced') return 'science';
  if (experience === 'intermediate') return 'direct';
  return 'supportive';
}
