import { generateProgram } from '../generator';
import {
  buildOnboardingPreferences,
  buildOnboardingProfile,
  validateOnboardingInput,
  type OnboardingInput,
} from '../onboarding';

const baseInput: OnboardingInput = {
  displayName: 'Mihai',
  email: 'mihai@example.com',
  password: 'strong-password',
  experience: 'intermediate',
  environment: 'commercial_gym',
  daysPerWeek: 4,
  sessionMinutes: 60,
  musclePriorities: ['chest', 'back'],
};

describe('onboarding', () => {
  it('builds a completed local account profile without storing the password', () => {
    const profile = buildOnboardingProfile(baseInput, '2026-09-15T08:00:00.000Z');

    expect(profile).toMatchObject({
      displayName: 'Mihai',
      email: 'mihai@example.com',
      createdAt: '2026-09-15T08:00:00.000Z',
      onboardingCompleted: true,
    });
    expect(profile.id).toMatch(/^local-/);
    expect(profile).not.toHaveProperty('password');
  });

  it('turns onboarding answers into training preferences the program generator can use', () => {
    const preferences = buildOnboardingPreferences({
      ...baseInput,
      environment: 'home_gym',
      daysPerWeek: 3,
      sessionMinutes: 45,
      musclePriorities: ['shoulders', 'biceps', 'triceps', 'chest'],
    });

    expect(preferences).toMatchObject({
      goal: 'hypertrophy',
      experience: 'intermediate',
      environment: 'home_gym',
      daysPerWeek: 3,
      preferredDays: [0, 2, 4],
      sessionMinutes: 45,
      musclePriorities: ['shoulders', 'biceps', 'triceps'],
      units: 'kg',
      coachingTone: 'direct',
    });
    expect(preferences.equipment).toContain('adjustable_dumbbell');
  });

  it('supports immediate active program generation from the onboarding output', () => {
    const profile = buildOnboardingProfile(baseInput, '2026-09-15T08:00:00.000Z');
    const preferences = buildOnboardingPreferences(baseInput);
    const program = generateProgram(preferences, profile.id);

    expect(program.userId).toBe(profile.id);
    expect(program.days).toHaveLength(4);
    expect(program.rationale).toContain('4 training days');
  });

  it('validates account essentials and limits focus muscles', () => {
    const issues = validateOnboardingInput({
      ...baseInput,
      displayName: 'A',
      email: 'not-an-email',
      password: 'short',
      musclePriorities: ['chest', 'back', 'shoulders', 'biceps'],
    });

    expect(issues.map((issue) => issue.field)).toEqual([
      'displayName',
      'email',
      'password',
      'musclePriorities',
    ]);
  });
});
