import type { Exercise, ProgramDay, TrainingPreferences, TrainingProgram } from '@/types';
import { uuid } from '@/utils/ids';

import {
  buildManualPrescription,
  recalculateProgramDay,
} from './programEditing';

type CreateCustomProgramDraftInput = {
  userId: string;
  preferences: TrainingPreferences;
  name?: string;
  daysPerWeek?: number;
  now?: string;
};

export function createCustomProgramDraft({
  userId,
  preferences,
  name = 'Custom Hypertrophy Program',
  daysPerWeek = preferences.daysPerWeek,
  now = new Date().toISOString(),
}: CreateCustomProgramDraftInput): TrainingProgram {
  const days = Array.from({ length: clamp(daysPerWeek, 2, 6) }, (_, index) =>
    emptyCustomProgramDay(index),
  );

  return {
    id: `custom-program-${uuid()}`,
    userId,
    name,
    splitType: 'custom',
    daysPerWeek: days.length,
    days,
    createdAt: now,
    active: true,
    rationale:
      'Built manually from selected exercises. The app keeps volume, RIR, rest, and progression data connected after you save it.',
  };
}

export function setCustomProgramDayCount(
  program: TrainingProgram,
  daysPerWeek: number,
): TrainingProgram {
  const nextCount = clamp(daysPerWeek, 2, 6);
  const days =
    nextCount <= program.days.length
      ? program.days.slice(0, nextCount)
      : [
          ...program.days,
          ...Array.from({ length: nextCount - program.days.length }, (_, offset) =>
            emptyCustomProgramDay(program.days.length + offset),
          ),
        ];

  return normalizeCustomProgram({ ...program, daysPerWeek: nextCount, days });
}

export function renameCustomProgramDay(
  program: TrainingProgram,
  dayIndex: number,
  name: string,
): TrainingProgram {
  if (!program.days[dayIndex]) return program;
  const days = program.days.map((day, index) =>
    index === dayIndex ? { ...day, name: name.trim() || `Day ${index + 1}` } : day,
  );
  return normalizeCustomProgram({ ...program, days });
}

export function addExerciseToCustomProgramDay(
  program: TrainingProgram,
  dayIndex: number,
  exercise: Exercise,
  preferences: TrainingPreferences,
): TrainingProgram {
  const day = program.days[dayIndex];
  if (!day) return program;
  const prescription = buildManualPrescription(exercise, day.prescriptions.length, preferences);
  const days = program.days.map((item, index) =>
    index === dayIndex
      ? recalculateProgramDay({
          ...item,
          prescriptions: [...item.prescriptions, prescription],
        })
      : item,
  );
  return normalizeCustomProgram({ ...program, days });
}

export function removeExerciseFromCustomProgramDay(
  program: TrainingProgram,
  dayIndex: number,
  prescriptionIndex: number,
): TrainingProgram {
  const day = program.days[dayIndex];
  if (!day) return program;
  if (day.prescriptions.length <= 1) {
    const days = program.days.map((item, index) =>
      index === dayIndex ? recalculateProgramDay({ ...item, prescriptions: [] }) : item,
    );
    return normalizeCustomProgram({ ...program, days });
  }
  const prescriptions = day.prescriptions.filter((_, index) => index !== prescriptionIndex);
  const days = program.days.map((item, index) =>
    index === dayIndex ? recalculateProgramDay({ ...item, prescriptions }) : item,
  );
  return normalizeCustomProgram({ ...program, days });
}

export function moveExerciseInCustomProgramDay(
  program: TrainingProgram,
  dayIndex: number,
  fromIndex: number,
  direction: -1 | 1,
): TrainingProgram {
  const day = program.days[dayIndex];
  if (!day) return program;
  const toIndex = clamp(fromIndex + direction, 0, day.prescriptions.length - 1);
  if (toIndex === fromIndex) return program;
  const prescriptions = [...day.prescriptions];
  const [moved] = prescriptions.splice(fromIndex, 1);
  if (!moved) return program;
  prescriptions.splice(toIndex, 0, moved);
  const days = program.days.map((item, index) =>
    index === dayIndex ? recalculateProgramDay({ ...item, prescriptions }) : item,
  );
  return normalizeCustomProgram({ ...program, days });
}

export function normalizeCustomProgram(program: TrainingProgram): TrainingProgram {
  const days = program.days.map((day, index) =>
    recalculateProgramDay({
      ...day,
      order: index,
      id: day.id || `custom-day-${index + 1}`,
      name: day.name.trim() || `Day ${index + 1}`,
    }),
  );

  return {
    ...program,
    splitType: 'custom',
    days,
    daysPerWeek: days.length,
    active: true,
  };
}

export function customProgramSaveIssue(program: TrainingProgram): string | null {
  if (!program.name.trim()) return 'Name the program before saving.';
  const emptyDay = program.days.find((day) => day.prescriptions.length === 0);
  if (emptyDay) return `${emptyDay.name} needs at least one exercise.`;
  return null;
}

function emptyCustomProgramDay(index: number): ProgramDay {
  return {
    id: `custom-day-${index + 1}-${uuid()}`,
    name: `Day ${index + 1}`,
    order: index,
    focus: [],
    prescriptions: [],
    estimatedMinutes: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
