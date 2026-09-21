import { ENVIRONMENT_EQUIPMENT } from '@/domain/exercises/catalog';
import type {
  CoachingTone,
  DayOfWeek,
  ExperienceLevel,
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
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
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
    equipment: ENVIRONMENT_EQUIPMENT[input.environment],
    daysPerWeek: input.daysPerWeek,
    preferredDays: DEFAULT_DAYS[input.daysPerWeek],
    sessionMinutes: input.sessionMinutes,
    musclePriorities: [],
    preferredExerciseSlugs: [],
    dislikedExerciseSlugs: [],
    excludedExerciseSlugs: [],
    discomfortExerciseSlugs: [],
    units: input.units,
    coachingTone: input.coachingTone ?? coachingToneFor(input.experience),
  };
}

function coachingToneFor(experience: ExperienceLevel): CoachingTone {
  if (experience === 'advanced') return 'science';
  if (experience === 'intermediate') return 'direct';
  return 'supportive';
}
