import type { KeyJoints } from './landmarks';

export const DEFAULT_MIN_VISIBILITY = 0.35;

export type TrackingQuality = 'good' | 'degraded' | 'lost';

/**
 * Classifies overall tracking quality from a fixed set of "always needed"
 * landmarks (both shoulders and hips — a stable torso is the precondition
 * for every exercise's biomechanics, including exercise-specific joints
 * checked separately via hasRequiredJoints).
 */
export function assessTrackingQuality(
  joints: KeyJoints | null,
  minVisibility: number = DEFAULT_MIN_VISIBILITY,
): TrackingQuality {
  if (!joints) return 'lost';

  const core: (keyof KeyJoints)[] = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'];
  const visibleCore = core.filter((name) => joints[name].visibility > minVisibility).length;

  if (visibleCore === core.length) return 'good';
  if (visibleCore >= core.length / 2) return 'degraded';
  return 'lost';
}

/** True only when every joint a specific exercise needs is confidently tracked. */
export function hasRequiredJoints(
  joints: KeyJoints | null,
  requiredJoints: (keyof KeyJoints)[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY,
): joints is KeyJoints {
  if (!joints) return false;
  return requiredJoints.every((name) => joints[name].visibility > minVisibility);
}
