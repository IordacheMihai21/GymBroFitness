import { ENVIRONMENT_EQUIPMENT } from '@/domain/exercises/catalog';
import type {
  CoachingTone,
  DayOfWeek,
  ExperienceLevel,
  MuscleGroup,
  TrainingEnvironment,
  TrainingPreferences,
  Units,
  UserProfile,
} from '@/types';
import { uuid } from '@/utils/ids';

type DaysPerWeek = TrainingPreferences['daysPerWeek'];
type SessionMinutes = TrainingPreferences['sessionMinutes'];

export type OnboardingInput = {
  displayName: string;
  email: string;
  password: string;
  experience: ExperienceLevel;
  environment: Exclude<TrainingEnvironment, 'custom'>;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
  musclePriorities: MuscleGroup[];
  units?: Units;
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
  const email = input.email.trim();

  if (displayName.length < 2) {
    issues.push({ field: 'displayName', message: 'Use at least 2 characters for your name.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({ field: 'email', message: 'Add a valid email address.' });
  }
  if (input.password.length < 8) {
    issues.push({ field: 'password', message: 'Use at least 8 characters.' });
  }
  if (input.musclePriorities.length > 3) {
    issues.push({ field: 'musclePriorities', message: 'Pick up to 3 priority muscles.' });
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
    email: input.email.trim().toLowerCase(),
    createdAt,
    onboardingCompleted: true,
  };
}

export function buildOnboardingPreferences(input: OnboardingInput): TrainingPreferences {
  return {
    goal: 'hypertrophy',
    experience: input.experience,
    environment: input.environment,
    equipment: ENVIRONMENT_EQUIPMENT[input.environment],
    daysPerWeek: input.daysPerWeek,
    preferredDays: DEFAULT_DAYS[input.daysPerWeek],
    sessionMinutes: input.sessionMinutes,
    musclePriorities: input.musclePriorities.slice(0, 3),
    preferredExerciseSlugs: [],
    dislikedExerciseSlugs: [],
    excludedExerciseSlugs: [],
    discomfortExerciseSlugs: [],
    units: input.units ?? 'kg',
    coachingTone: input.coachingTone ?? coachingToneFor(input.experience),
  };
}

function coachingToneFor(experience: ExperienceLevel): CoachingTone {
  if (experience === 'advanced') return 'science';
  if (experience === 'intermediate') return 'direct';
  return 'supportive';
}
