import { generateProgram } from '../generator';
import {
  buildOnboardingPreferences,
  buildOnboardingProfile,
  defaultEquipmentForEnvironment,
  fitOnboardingDays,
  validateOnboardingInput,
  type OnboardingInput,
} from '../onboarding';

const baseInput: OnboardingInput = {
  displayName: 'Mihai',
  units: 'kg',
  goal: 'hypertrophy',
  experience: 'intermediate',
  environment: 'commercial_gym',
  equipment: defaultEquipmentForEnvironment('commercial_gym'),
  daysPerWeek: 4,
  preferredDays: [0, 1, 3, 4],
  sessionMinutes: 60,
  musclePriorities: [],
};

describe('onboarding', () => {
  it('builds a completed local profile without account credentials', () => {
    const profile = buildOnboardingProfile(baseInput, '2026-09-15T08:00:00.000Z');

    expect(profile).toMatchObject({
      displayName: 'Mihai',
      createdAt: '2026-09-15T08:00:00.000Z',
      onboardingCompleted: true,
    });
    expect(profile.id).toMatch(/^local-/);
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('password');
  });

  it('turns onboarding answers into training preferences the program generator can use', () => {
    const preferences = buildOnboardingPreferences({
      ...baseInput,
      environment: 'home_gym',
      equipment: defaultEquipmentForEnvironment('home_gym'),
      daysPerWeek: 3,
      preferredDays: [0, 2, 4],
      sessionMinutes: 45,
      units: 'lb',
    });

    expect(preferences).toMatchObject({
      goal: 'hypertrophy',
      experience: 'intermediate',
      environment: 'home_gym',
      daysPerWeek: 3,
      preferredDays: [0, 2, 4],
      sessionMinutes: 45,
      musclePriorities: [],
      units: 'lb',
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

  it('changes compound prescriptions when the user chooses a different goal', () => {
    const hypertrophy = generateProgram(buildOnboardingPreferences(baseInput), 'user-1');
    const strength = generateProgram(
      buildOnboardingPreferences({ ...baseInput, goal: 'strength' }),
      'user-1',
    );
    const mixed = generateProgram(
      buildOnboardingPreferences({ ...baseInput, goal: 'mixed' }),
      'user-1',
    );
    const firstHypertrophyCompound = hypertrophy.days
      .flatMap((day) => day.prescriptions)
      .find((item) => item.minReps === 6 && item.maxReps === 10);
    const matchingStrength = strength.days
      .flatMap((day) => day.prescriptions)
      .find((item) => item.exerciseId === firstHypertrophyCompound?.exerciseId);
    const matchingMixed = mixed.days
      .flatMap((day) => day.prescriptions)
      .find((item) => item.exerciseId === firstHypertrophyCompound?.exerciseId);

    expect(firstHypertrophyCompound).toMatchObject({ minReps: 6, maxReps: 10, restSeconds: 180 });
    expect(matchingStrength).toMatchObject({ minReps: 3, maxReps: 6, restSeconds: 240 });
    expect(matchingMixed).toMatchObject({ minReps: 5, maxReps: 8, restSeconds: 210 });
    expect(strength.rationale).toContain('strength goal');
  });

  it('validates only the required local profile field', () => {
    const issues = validateOnboardingInput({
      ...baseInput,
      displayName: 'A',
    });

    expect(issues.map((issue) => issue.field)).toEqual(['displayName']);
  });

  it('preserves exact training days, equipment and muscle priorities', () => {
    const preferences = buildOnboardingPreferences({
      ...baseInput,
      equipment: ['barbell', 'squat_rack', 'bench', 'bodyweight'],
      preferredDays: [0, 2, 5, 6],
      musclePriorities: ['back', 'shoulders', 'biceps'],
    });

    expect(preferences.equipment).toEqual(['barbell', 'squat_rack', 'bench', 'bodyweight']);
    expect(preferences.preferredDays).toEqual([0, 2, 5, 6]);
    expect(preferences.musclePriorities).toEqual(['back', 'shoulders', 'biceps']);
  });

  it('fits schedule changes without duplicate training days', () => {
    expect(fitOnboardingDays(3, [0, 1, 3, 4])).toEqual([0, 1, 3]);
    expect(fitOnboardingDays(5, [0, 3])).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects incomplete schedules, empty equipment and too many priorities', () => {
    const issues = validateOnboardingInput({
      ...baseInput,
      equipment: [],
      preferredDays: [0, 1],
      musclePriorities: ['chest', 'back', 'shoulders', 'biceps'],
    });

    expect(issues.map((issue) => issue.field)).toEqual([
      'preferredDays',
      'equipment',
      'musclePriorities',
    ]);
  });
});
