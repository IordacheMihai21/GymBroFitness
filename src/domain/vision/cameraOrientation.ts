/**
 * Detects which way the camera is actually pointed at the lifter, so the
 * app can tell them when it doesn't match what the exercise needs — today
 * the "Side angle" / "Front angle" chip on the form-check screen is only
 * ever instructional copy; nothing checks whether the lifter complied.
 *
 * Heuristic: viewed side-on, the two shoulders sit almost on top of each
 * other in the 2D image (they're aligned along the camera's line of sight);
 * viewed front-on, they're clearly separated. Comparing that separation to
 * body scale (so it holds across heights and camera distances, same trick
 * as biomechanics.ts's normalized* helpers) gives a distance-invariant
 * front/side signal without needing real depth data.
 */

import { getBodyScale, getDistance } from './biomechanics';
import type { CameraAngle } from './exerciseVisionConfigs/types';
import type { KeyJoints } from './landmarks';

export type DetectedCameraOrientation = 'front' | 'side' | 'front-45';

const FRONT_MIN_RATIO = 0.45;
const SIDE_MAX_RATIO = 0.22;

/**
 * Classifies the lifter's orientation to the camera from shoulder separation
 * relative to body scale. Only meaningful once the caller has already
 * confirmed the torso joints are confidently tracked (same precondition as
 * the rest of the pipeline) — `getBodyScale` always returns a positive
 * number by design (it floors to shoulder width, then to 1), so this never
 * needs an "undetermined" case of its own.
 */
export function detectCameraOrientation(joints: KeyJoints): DetectedCameraOrientation {
  const ratio = getDistance(joints.leftShoulder, joints.rightShoulder) / getBodyScale(joints);
  if (ratio >= FRONT_MIN_RATIO) return 'front';
  if (ratio <= SIDE_MAX_RATIO) return 'side';
  return 'front-45';
}

/**
 * Whether the detected orientation is close enough to what the exercise
 * recommends to trust its measurements. 'front-45' is treated as compatible
 * with either neighbor — it's the midpoint between them, and MoveNet's 2D
 * estimate is noisy enough that a lifter rarely aligns perfectly anyway.
 */
export function isCameraAngleMismatched(
  detected: DetectedCameraOrientation,
  recommended: CameraAngle,
): boolean {
  if (detected === recommended) return false;
  if (detected === 'front-45' || recommended === 'front-45') return false;
  return true;
}

export function cameraAngleMismatchMessage(recommended: CameraAngle): string {
  switch (recommended) {
    case 'front':
      return 'Face the camera for accurate tracking.';
    case 'side':
      return 'Turn side-on to the camera for accurate tracking.';
    case 'front-45':
      return 'Angle the camera to your front-45° for accurate tracking.';
  }
}
