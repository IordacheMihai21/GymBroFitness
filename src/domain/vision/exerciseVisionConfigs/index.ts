import { curlConfig } from './curl';
import { lateralRaiseConfig } from './lateralRaise';
import { overheadPressConfig } from './overheadPress';
import { pushUpConfig } from './pushUp';
import { squatConfig } from './squat';
import type { VisionExerciseConfig } from './types';
import type { MovementPattern } from '@/types';

/**
 * Keyed by movement pattern rather than exercise slug: GymBro's catalog has
 * several equipment variants per movement (barbell/dumbbell/EZ-bar/hammer/
 * cable/preacher curl all share `movementPattern: 'elbow_flexion'`), and
 * the camera-based biomechanics are identical across them — one config
 * covers every variant instead of duplicating it per slug.
 */
export const VISION_EXERCISE_CONFIGS: Partial<Record<MovementPattern, VisionExerciseConfig>> = {
  elbow_flexion: curlConfig,
  squat: squatConfig,
  shoulder_abduction: lateralRaiseConfig,
  horizontal_push: pushUpConfig,
  vertical_push: overheadPressConfig,
};

export function getVisionConfigForMovementPattern(pattern: MovementPattern): VisionExerciseConfig | undefined {
  return VISION_EXERCISE_CONFIGS[pattern];
}

export type { VisionExerciseConfig, FormRule, CameraAngle, ScoringWeights, TempoTarget } from './types';
