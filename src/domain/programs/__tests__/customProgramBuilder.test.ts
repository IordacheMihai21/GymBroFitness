import {
  addExerciseToCustomProgramDay,
  createCustomProgramDraft,
  customProgramSaveIssue,
  removeExerciseFromCustomProgramDay,
  renameCustomProgramDay,
  setCustomProgramDayCount,
} from '../customProgramBuilder';
import { requireExercise } from '@/domain/exercises/catalog';
import type { TrainingPreferences } from '@/types';

const preferences: TrainingPreferences = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  environment: 'commercial_gym',
  equipment: ['barbell', 'bench', 'dumbbell', 'cable_machine', 'bodyweight'],
  daysPerWeek: 4,
  preferredDays: [0, 1, 3, 4],
  sessionMinutes: 60,
  musclePriorities: ['chest'],
  preferredExerciseSlugs: [],
  dislikedExerciseSlugs: [],
  excludedExerciseSlugs: [],
  discomfortExerciseSlugs: [],
  units: 'kg',
  coachingTone: 'direct',
};

describe('custom program builder', () => {
  it('creates an empty draft that is not saveable until every day has work', () => {
    const draft = createCustomProgramDraft({
      userId: 'user-1',
      preferences,
      now: '2026-09-15T10:00:00.000Z',
    });

    expect(draft.splitType).toBe('custom');
    expect(draft.days).toHaveLength(4);
    expect(customProgramSaveIssue(draft)).toBe('Day 1 needs at least one exercise.');
  });

  it('adds exercises, recalculates focus, and permits saving when all days are filled', () => {
    let draft = createCustomProgramDraft({ userId: 'user-1', preferences, daysPerWeek: 2 });
    draft = renameCustomProgramDay(draft, 0, 'Push A');
    draft = renameCustomProgramDay(draft, 1, 'Pull A');
    draft = addExerciseToCustomProgramDay(draft, 0, requireExercise('barbell-bench-press'), preferences);
    draft = addExerciseToCustomProgramDay(draft, 1, requireExercise('pull-up'), preferences);

    expect(draft.days[0]).toMatchObject({
      name: 'Push A',
      focus: ['chest'],
    });
    expect(draft.days[0].estimatedMinutes).toBeGreaterThan(0);
    expect(customProgramSaveIssue(draft)).toBeNull();
  });

  it('can resize the week and remove the last exercise from a draft day', () => {
    let draft = createCustomProgramDraft({ userId: 'user-1', preferences, daysPerWeek: 3 });
    draft = setCustomProgramDayCount(draft, 5);
    expect(draft.days).toHaveLength(5);

    draft = addExerciseToCustomProgramDay(draft, 0, requireExercise('barbell-bench-press'), preferences);
    draft = removeExerciseFromCustomProgramDay(draft, 0, 0);
    expect(draft.days[0].prescriptions).toHaveLength(0);
  });
});
