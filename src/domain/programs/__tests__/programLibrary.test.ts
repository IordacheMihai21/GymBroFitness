import {
  ENVIRONMENT_EQUIPMENT,
  isExerciseAvailable,
  requireExercise,
} from '@/domain/exercises/catalog';
import type { TrainingPreferences } from '@/types';

import {
  buildProgramFromLibraryTemplate,
  listProgramLibraryTemplates,
  PROGRAM_LIBRARY,
  templateWeeklySetCount,
} from '../programLibrary';

const preferences: TrainingPreferences = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  environment: 'commercial_gym',
  equipment: ENVIRONMENT_EQUIPMENT.commercial_gym,
  daysPerWeek: 4,
  preferredDays: [0, 1, 3, 4],
  sessionMinutes: 75,
  musclePriorities: ['chest', 'back'],
  preferredExerciseSlugs: [],
  dislikedExerciseSlugs: [],
  excludedExerciseSlugs: [],
  discomfortExerciseSlugs: [],
  units: 'kg',
  coachingTone: 'direct',
};

describe('program library', () => {
  it('only references exercises that exist in the local catalog', () => {
    for (const template of PROGRAM_LIBRARY) {
      expect(template.days).toHaveLength(template.daysPerWeek);
      expect(templateWeeklySetCount(template)).toBeGreaterThan(0);

      for (const day of template.days) {
        expect(day.prescriptions.length).toBeGreaterThan(0);
        for (const prescription of day.prescriptions) {
          expect(requireExercise(prescription.exerciseId).id).toBe(prescription.exerciseId);
        }
      }
    }
  });

  it('imports each template as a normal active training program', () => {
    for (const template of PROGRAM_LIBRARY) {
      const program = buildProgramFromLibraryTemplate(template.id, {
        userId: 'user-1',
        preferences,
        now: '2026-09-15T10:00:00.000Z',
      });

      expect(program).toMatchObject({
        userId: 'user-1',
        name: template.name,
        active: true,
        daysPerWeek: template.daysPerWeek,
      });
      expect(program.days).toHaveLength(template.days.length);
      expect(program.days.every((day) => day.focus.length > 0)).toBe(true);
      expect(program.days.every((day) => day.estimatedMinutes > 0)).toBe(true);
    }
  });

  it('adapts template exercises to bodyweight equipment and exclusions', () => {
    const bodyweightPreferences: TrainingPreferences = {
      ...preferences,
      experience: 'beginner',
      environment: 'bodyweight',
      equipment: ['bodyweight', 'resistance_band'],
      daysPerWeek: 3,
      excludedExerciseSlugs: ['push-up'],
    };

    const program = buildProgramFromLibraryTemplate('full-body-minimalist-3', {
      userId: 'user-1',
      preferences: bodyweightPreferences,
      now: '2026-09-15T10:00:00.000Z',
    });

    const exercises = program.days.flatMap((day) =>
      day.prescriptions.map((prescription) => requireExercise(prescription.exerciseId)),
    );

    expect(exercises.every((exercise) => exercise.slug !== 'push-up')).toBe(true);
    expect(
      exercises.every((exercise) => isExerciseAvailable(exercise, bodyweightPreferences.equipment)),
    ).toBe(true);
  });

  it('ranks templates matching the selected goal ahead of otherwise similar plans', () => {
    const ranked = listProgramLibraryTemplates({ ...preferences, goal: 'mixed' });

    expect(ranked[0].goal).toBe('mixed');
  });
});
