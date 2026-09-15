import type { ExercisePrescription, TrainingPreferences, TrainingProgram } from '@/types';

import { requireExercise } from '../../exercises/catalog';
import {
  addProgramPrescription,
  buildManualPrescription,
  exerciseCandidatesForProgramDay,
  moveProgramPrescription,
  removeProgramPrescription,
  updateProgramPrescription,
} from '../programEditing';

const preferences: TrainingPreferences = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  environment: 'commercial_gym',
  equipment: [
    'barbell',
    'dumbbell',
    'bench',
    'incline_bench',
    'squat_rack',
    'cable_machine',
    'selectorized_machine',
    'bodyweight',
  ],
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

function prescription(exerciseId: string, order: number): ExercisePrescription {
  return {
    exerciseId,
    order,
    workingSets: 3,
    minReps: 6,
    maxReps: 10,
    targetRir: 2,
    restSeconds: 120,
    selectionReason: 'test',
  };
}

function program(prescriptions: ExercisePrescription[] = []): TrainingProgram {
  return {
    id: 'program-1',
    userId: 'user-1',
    name: 'Upper Lower',
    splitType: 'upper_lower',
    daysPerWeek: 4,
    active: true,
    createdAt: '2026-09-14T10:00:00.000Z',
    rationale: 'Generated plan.',
    days: [
      {
        id: 'upper-a',
        name: 'Upper A',
        order: 0,
        focus: ['chest', 'back'],
        estimatedMinutes: 45,
        prescriptions:
          prescriptions.length > 0
            ? prescriptions
            : [prescription('barbell-bench-press', 0), prescription('barbell-row', 1)],
      },
    ],
  };
}

describe('programEditing', () => {
  it('updates a prescription and marks the program as locally edited', () => {
    const next = updateProgramPrescription(program(), 0, 0, { workingSets: 4, targetRir: 1 });

    expect(next.splitType).toBe('custom');
    expect(next.name).toContain('Edited');
    expect(next.days[0].prescriptions[0]).toMatchObject({
      exerciseId: 'barbell-bench-press',
      workingSets: 4,
      targetRir: 1,
      order: 0,
    });
    expect(next.days[0].estimatedMinutes).toBe(28);
  });

  it('moves exercises and normalizes their order fields', () => {
    const next = moveProgramPrescription(program(), 0, 1, 0);

    expect(next.days[0].prescriptions.map((item) => item.exerciseId)).toEqual([
      'barbell-row',
      'barbell-bench-press',
    ]);
    expect(next.days[0].prescriptions.map((item) => item.order)).toEqual([0, 1]);
  });

  it('adds a manual prescription with programming defaults', () => {
    const lateralRaise = requireExercise('lateral-raise');
    const manual = buildManualPrescription(lateralRaise, 2, preferences);
    const next = addProgramPrescription(program(), 0, manual);

    expect(manual).toMatchObject({
      exerciseId: 'lateral-raise',
      workingSets: 3,
      minReps: 10,
      maxReps: 15,
      targetRir: 2,
    });
    expect(next.days[0].focus).toContain('shoulders');
    expect(next.days[0].prescriptions.at(-1)?.order).toBe(2);
  });

  it('removes an exercise without accidentally bridging supersets', () => {
    const next = removeProgramPrescription(
      program([
        { ...prescription('barbell-bench-press', 0), supersetWithNext: true },
        prescription('barbell-row', 1),
        prescription('lateral-raise', 2),
      ]),
      0,
      1,
    );

    expect(next.days[0].prescriptions.map((item) => item.exerciseId)).toEqual([
      'barbell-bench-press',
      'lateral-raise',
    ]);
    expect(next.days[0].prescriptions[0].supersetWithNext).toBe(false);
  });

  it('ranks unused exercises by the selected day focus', () => {
    const candidates = exerciseCandidatesForProgramDay(program().days[0], preferences, 'press');

    expect(candidates[0].primaryMuscles).toContain('chest');
    expect(candidates.some((exercise) => exercise.id === 'barbell-bench-press')).toBe(false);
  });
});
