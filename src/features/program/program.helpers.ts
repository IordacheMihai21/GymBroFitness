import type { ExtendedBodyPart } from 'react-native-body-highlighter';

import { requireExercise } from '@/domain/exercises/catalog';
import { rankReplacements, type RankedReplacement } from '@/domain/exercises/replacement';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { bodySlugsForMuscle, heatColorForVolumeZone } from '@/domain/muscles/muscleMap';
import {
  classifyWeeklyVolume,
  type VolumeLandmarks,
  type VolumeZone,
} from '@/domain/workouts/volumeLandmarks';
import type {
  ExercisePrescription,
  MuscleGroup,
  ProgramDay,
  TrainingPreferences,
  TrainingProgram,
} from '@/types';

export type SwapTarget = {
  dayIndex: number;
  prescriptionIndex: number;
} | null;

export type ProgramMuscleLoad = {
  muscle: MuscleGroup;
  sets: number;
  zone: VolumeZone;
  mev: number;
  mrv: number;
  gaugeFraction: number;
  landmarks: VolumeLandmarks;
};

export function formatGoal(goal: TrainingPreferences['goal']): string {
  if (goal === 'hypertrophy') return 'Muscle growth';
  if (goal === 'strength') return 'Strength';
  return 'Mixed';
}

export function formatEquipmentSummary(equipment: TrainingPreferences['equipment']): string {
  const visible = equipment.slice(0, 4).map((item) => item.replace(/_/g, ' '));
  const remainder = equipment.length - visible.length;
  return `${visible.join(', ')}${remainder > 0 ? ` +${remainder}` : ''}`;
}

export function buildSwapOptions(
  program: TrainingProgram,
  selectedDayIndex: number,
  swapTarget: SwapTarget,
  preferences: TrainingPreferences,
): RankedReplacement[] {
  if (!swapTarget || swapTarget.dayIndex !== selectedDayIndex) return [];
  const day = program.days[swapTarget.dayIndex];
  const prescription = day?.prescriptions[swapTarget.prescriptionIndex];
  if (!day || !prescription) return [];

  return rankReplacements({
    original: requireExercise(prescription.exerciseId),
    reason: 'general',
    equipment: preferences.equipment,
    prefs: preferences,
    usedExerciseIds: day.prescriptions.map((item) => item.exerciseId),
  });
}

export function computeProgramMuscleLoads(days: ProgramDay[]): ProgramMuscleLoad[] {
  const setsByMuscle: Partial<Record<MuscleGroup, number>> = {};
  for (const day of days) {
    for (const prescription of day.prescriptions) {
      const exercise = requireExercise(prescription.exerciseId);
      for (const muscle of exercise.primaryMuscles) {
        setsByMuscle[muscle] = (setsByMuscle[muscle] ?? 0) + prescription.workingSets;
      }
    }
  }

  return (Object.entries(setsByMuscle) as [MuscleGroup, number][])
    .map(([muscle, sets]) => {
      const classification = classifyWeeklyVolume(muscle, sets);
      return {
        muscle,
        sets,
        zone: classification.zone,
        mev: classification.landmarks.mev,
        mrv: classification.landmarks.mrv,
        gaugeFraction: classification.gaugeFraction,
        landmarks: classification.landmarks,
      };
    })
    .sort(
      (a, b) => b.sets - a.sets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]),
    );
}

export function buildBodyData(muscleLoads: ProgramMuscleLoad[]): ExtendedBodyPart[] {
  return muscleLoads.flatMap((item) => {
    const fill = heatColorForVolumeZone(item.zone);
    return bodySlugsForMuscle(item.muscle).map((slug) => ({
      slug,
      intensity: item.zone === 'below_mv' ? 1 : 2,
      styles: {
        fill: withAlpha(fill, item.zone === 'below_mv' ? '72' : 'B8'),
        stroke: fill,
        strokeWidth: 0.35,
      },
    }));
  });
}

export function summarizeDay(day: ProgramDay | undefined): { sets: number } {
  if (!day) return { sets: 0 };
  return {
    sets: day.prescriptions.reduce((sum, prescription) => sum + prescription.workingSets, 0),
  };
}

export function formatRepRange(prescription: ExercisePrescription): string {
  return `${prescription.minReps}-${prescription.maxReps}`;
}

export function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes}m rest`;
  return `${minutes}:${String(remainder).padStart(2, '0')} rest`;
}

export function formatShortRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatTechnique(
  technique: NonNullable<ExercisePrescription['setTechnique']>,
): string {
  switch (technique) {
    case 'drop_set':
      return 'Drop set';
    case 'rest_pause':
      return 'Rest-pause';
    case 'myo_reps':
      return 'Myo-reps';
    case 'cluster_set':
      return 'Cluster';
    case 'top_backoff':
      return 'Top + backoff';
    default:
      return 'Standard';
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}
