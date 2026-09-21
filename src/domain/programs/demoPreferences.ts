import type { TrainingPreferences } from '@/types';

/**
 * Stand-in for onboarding output until the real preferences flow exists.
 * Used by the Home and Workout screens so they generate against the same
 * program.
 */
export const DEMO_USER_ID = 'demo-user';
export const DEMO_DISPLAY_NAME = 'Alex';

export const DEMO_PREFERENCES: TrainingPreferences = {
  goal: 'hypertrophy',
  nutritionContext: 'unknown',
  experience: 'intermediate',
  environment: 'commercial_gym',
  equipment: [
    'barbell',
    'dumbbell',
    'bench',
    'incline_bench',
    'squat_rack',
    'pull_up_bar',
    'cable_machine',
    'selectorized_machine',
  ],
  daysPerWeek: 4,
  preferredDays: [0, 1, 3, 4],
  sessionMinutes: 60,
  musclePriorities: ['chest', 'back'],
  preferredExerciseSlugs: [],
  dislikedExerciseSlugs: [],
  excludedExerciseSlugs: [],
  discomfortExerciseSlugs: [],
  units: 'kg',
  coachingTone: 'supportive',
};
