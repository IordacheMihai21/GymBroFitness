import type { ExerciseType, ExperienceLevel, MovementPattern, MuscleGroup, SplitType } from '@/types';

/**
 * A slot is a placeholder in a training day the generator fills with a
 * concrete exercise. `trimOrder` controls which slots get dropped first when
 * the session must fit the user's time budget (higher = dropped sooner).
 */
export type Slot = {
  muscle: MuscleGroup;
  patterns?: MovementPattern[];
  type?: ExerciseType;
  trimOrder: number;
};

export type DayTemplate = {
  name: string;
  focus: MuscleGroup[];
  slots: Slot[];
};

export type SplitTemplate = {
  splitType: SplitType;
  name: string;
  days: DayTemplate[];
};

const s = (
  muscle: MuscleGroup,
  trimOrder: number,
  patterns?: MovementPattern[],
  type?: ExerciseType,
): Slot => ({ muscle, trimOrder, patterns, type });

// ---------------------------------------------------------------------------
// Day templates
// ---------------------------------------------------------------------------

const fullBodyA: DayTemplate = {
  name: 'Full Body A',
  focus: ['quadriceps', 'chest', 'back'],
  slots: [
    s('quadriceps', 0, ['squat', 'lunge'], 'compound'),
    s('chest', 0, ['horizontal_push'], 'compound'),
    s('back', 0, ['horizontal_pull'], 'compound'),
    s('hamstrings', 1, ['hip_hinge', 'knee_flexion']),
    s('shoulders', 2, ['shoulder_abduction'], 'isolation'),
    s('biceps', 3, ['elbow_flexion'], 'isolation'),
    s('abs', 4, ['ab_flexion', 'anti_extension']),
  ],
};

const fullBodyB: DayTemplate = {
  name: 'Full Body B',
  focus: ['hamstrings', 'back', 'shoulders'],
  slots: [
    s('hamstrings', 0, ['hip_hinge'], 'compound'),
    s('back', 0, ['vertical_pull'], 'compound'),
    s('shoulders', 0, ['vertical_push'], 'compound'),
    s('quadriceps', 1, ['lunge', 'squat']),
    s('triceps', 2, ['elbow_extension'], 'isolation'),
    s('calves', 3, ['calf_raise'], 'isolation'),
    s('abs', 4, ['ab_flexion', 'anti_extension']),
  ],
};

const fullBodyC: DayTemplate = {
  name: 'Full Body C',
  focus: ['quadriceps', 'chest', 'glutes'],
  slots: [
    s('quadriceps', 0, ['squat', 'lunge'], 'compound'),
    s('chest', 0, ['horizontal_push', 'chest_fly']),
    s('glutes', 1, ['hip_thrust', 'hip_hinge']),
    s('back', 1, ['horizontal_pull']),
    s('biceps', 2, ['elbow_flexion'], 'isolation'),
    s('triceps', 3, ['elbow_extension'], 'isolation'),
    s('calves', 4, ['calf_raise'], 'isolation'),
  ],
};

const upperA: DayTemplate = {
  name: 'Upper A',
  focus: ['chest', 'back', 'shoulders'],
  slots: [
    s('chest', 0, ['horizontal_push'], 'compound'),
    s('back', 0, ['horizontal_pull'], 'compound'),
    s('shoulders', 1, ['vertical_push'], 'compound'),
    s('back', 1, ['vertical_pull']),
    s('biceps', 2, ['elbow_flexion'], 'isolation'),
    s('triceps', 3, ['elbow_extension'], 'isolation'),
  ],
};

const upperB: DayTemplate = {
  name: 'Upper B',
  focus: ['back', 'shoulders', 'chest'],
  slots: [
    s('back', 0, ['vertical_pull'], 'compound'),
    s('shoulders', 0, ['vertical_push'], 'compound'),
    s('chest', 1, ['horizontal_push', 'chest_fly']),
    s('back', 1, ['horizontal_pull']),
    s('shoulders', 2, ['shoulder_abduction'], 'isolation'),
    s('biceps', 3, ['elbow_flexion'], 'isolation'),
    s('triceps', 3, ['elbow_extension'], 'isolation'),
  ],
};

const lowerA: DayTemplate = {
  name: 'Lower A',
  focus: ['quadriceps', 'hamstrings', 'calves'],
  slots: [
    s('quadriceps', 0, ['squat'], 'compound'),
    s('hamstrings', 0, ['hip_hinge'], 'compound'),
    s('quadriceps', 1, ['lunge', 'knee_extension']),
    s('hamstrings', 2, ['knee_flexion'], 'isolation'),
    s('calves', 2, ['calf_raise'], 'isolation'),
    s('abs', 3, ['ab_flexion', 'anti_extension']),
  ],
};

const lowerB: DayTemplate = {
  name: 'Lower B',
  focus: ['glutes', 'quadriceps', 'hamstrings'],
  slots: [
    s('glutes', 0, ['hip_thrust'], 'compound'),
    s('quadriceps', 0, ['squat', 'lunge'], 'compound'),
    s('hamstrings', 1, ['knee_flexion', 'hip_hinge']),
    s('quadriceps', 2, ['knee_extension'], 'isolation'),
    s('calves', 2, ['calf_raise'], 'isolation'),
    s('abs', 3, ['ab_flexion', 'anti_extension']),
  ],
};

const pushDay: DayTemplate = {
  name: 'Push',
  focus: ['chest', 'shoulders', 'triceps'],
  slots: [
    s('chest', 0, ['horizontal_push'], 'compound'),
    s('shoulders', 0, ['vertical_push'], 'compound'),
    s('chest', 1, ['chest_fly', 'horizontal_push']),
    s('shoulders', 1, ['shoulder_abduction'], 'isolation'),
    s('triceps', 2, ['elbow_extension'], 'isolation'),
    s('triceps', 3, ['elbow_extension'], 'isolation'),
  ],
};

const pullDay: DayTemplate = {
  name: 'Pull',
  focus: ['back', 'biceps', 'shoulders'],
  slots: [
    s('back', 0, ['vertical_pull'], 'compound'),
    s('back', 0, ['horizontal_pull'], 'compound'),
    s('shoulders', 1, ['rear_delt'], 'isolation'),
    s('biceps', 1, ['elbow_flexion'], 'isolation'),
    s('back', 2, ['horizontal_pull', 'pullover']),
    s('biceps', 3, ['elbow_flexion'], 'isolation'),
  ],
};

const legsDay: DayTemplate = {
  name: 'Legs',
  focus: ['quadriceps', 'hamstrings', 'glutes'],
  slots: [
    s('quadriceps', 0, ['squat'], 'compound'),
    s('hamstrings', 0, ['hip_hinge'], 'compound'),
    s('glutes', 1, ['hip_thrust', 'lunge']),
    s('hamstrings', 2, ['knee_flexion'], 'isolation'),
    s('calves', 2, ['calf_raise'], 'isolation'),
    s('abs', 3, ['ab_flexion', 'anti_extension']),
  ],
};

// ---------------------------------------------------------------------------
// Split selection
// ---------------------------------------------------------------------------

export function selectSplit(daysPerWeek: number, experience: ExperienceLevel): SplitTemplate {
  switch (daysPerWeek) {
    case 2:
      return {
        splitType: 'full_body',
        name: 'Full Body ×2',
        days: [fullBodyA, fullBodyB],
      };
    case 3:
      if (experience === 'beginner') {
        return {
          splitType: 'full_body',
          name: 'Full Body ×3',
          days: [fullBodyA, fullBodyB, fullBodyC],
        };
      }
      return {
        splitType: 'upper_lower_full',
        name: 'Upper / Lower / Full Body',
        days: [upperA, lowerA, fullBodyB],
      };
    case 4:
      return {
        splitType: 'upper_lower',
        name: 'Upper / Lower ×2',
        days: [upperA, lowerA, upperB, lowerB],
      };
    case 5:
      return {
        splitType: 'custom',
        name: 'Upper / Lower + Push / Pull / Legs',
        days: [upperA, lowerA, pushDay, pullDay, legsDay],
      };
    case 6:
      return {
        splitType: 'push_pull_legs',
        name: 'Push / Pull / Legs ×2',
        days: [
          pushDay,
          pullDay,
          legsDay,
          { ...pushDay, name: 'Push B' },
          { ...pullDay, name: 'Pull B' },
          { ...legsDay, name: 'Legs B' },
        ],
      };
    default:
      throw new Error(`Unsupported training frequency: ${daysPerWeek} days/week`);
  }
}
