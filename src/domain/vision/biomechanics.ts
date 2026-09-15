/**
 * Biomechanics math: joint angles, alignment, symmetry, and body-relative
 * normalization. Framework-free — no camera, no model, pure geometry over
 * the KeyJoints shape from landmarks.ts.
 *
 * Angle/lean/symmetry functions are ported near-verbatim from the
 * gouthamx67/ai-gym-trainer reference (used with the author's permission —
 * see docs/PLAN.md) since they're already-correct, framework-free geometry.
 * getBodyScale/normalizedDistance are new: ai-gym-trainer's form rules
 * compare raw normalized-image-space deltas (e.g. "elbow.x - shoulder.x >
 * 0.12") which only holds for one specific body size and camera distance.
 * Scaling by a body-proportional reference distance makes the same
 * threshold hold across different heights and camera distances.
 */

import type { KeyJoints, Landmark } from './landmarks';

export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

export function calculateAngle3D(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

export function getMidpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

export function getDistance(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function getDistance3D(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Angle of the top→bottom segment from vertical. 0 = perfectly vertical, 90 = horizontal. */
export function getVerticalAlignment(top: Landmark, bottom: Landmark): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  return Math.abs(Math.atan2(dx, -dy) * (180 / Math.PI));
}

export function getTorsoLean(joints: KeyJoints): number {
  const shoulderMid = getMidpoint(joints.leftShoulder, joints.rightShoulder);
  const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
  return getVerticalAlignment(shoulderMid, hipMid);
}

/** 0 (fully asymmetric) to 1 (perfectly symmetric). */
export function getSymmetryRatio(leftAngle: number, rightAngle: number): number {
  const max = Math.max(leftAngle, rightAngle);
  if (max === 0) return 1;
  return Math.min(leftAngle, rightAngle) / max;
}

export function areJointsVisible(
  joints: KeyJoints,
  jointNames: (keyof KeyJoints)[],
  minVisibility = 0.35,
): boolean {
  return jointNames.every((name) => joints[name].visibility > minVisibility);
}

/**
 * Body-proportional reference distance (shoulder-to-hip midpoint span),
 * used to normalize pixel-space distances across different body sizes and
 * camera distances. Falls back to shoulder width if the torso span is
 * degenerate (e.g. a near-front-on view collapses y-depth).
 */
export function getBodyScale(joints: KeyJoints): number {
  const shoulderMid = getMidpoint(joints.leftShoulder, joints.rightShoulder);
  const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
  const torsoSpan = getDistance(shoulderMid, hipMid);
  if (torsoSpan > 0.02) return torsoSpan;
  return getDistance(joints.leftShoulder, joints.rightShoulder) || 1;
}

/** Distance between two landmarks, expressed as a multiple of body scale (height/distance-invariant). */
export function normalizedDistance(a: Landmark, b: Landmark, joints: KeyJoints): number {
  return getDistance(a, b) / getBodyScale(joints);
}

/** Signed horizontal offset of `point` from `reference`, normalized by body scale. */
export function normalizedHorizontalOffset(point: Landmark, reference: Landmark, joints: KeyJoints): number {
  return (point.x - reference.x) / getBodyScale(joints);
}

/** Signed vertical offset of `point` from `reference`, normalized by body scale. */
export function normalizedVerticalOffset(point: Landmark, reference: Landmark, joints: KeyJoints): number {
  return (point.y - reference.y) / getBodyScale(joints);
}

/** Angular velocity tracker: feed it an angle per frame, get degrees/second. Null on the first call. */
export class VelocityTracker {
  private prevAngle: number | null = null;
  private prevTimestamp: number | null = null;

  update(angle: number, timestampMs: number): number | null {
    if (this.prevAngle === null || this.prevTimestamp === null) {
      this.prevAngle = angle;
      this.prevTimestamp = timestampMs;
      return null;
    }

    const dt = (timestampMs - this.prevTimestamp) / 1000;
    const prevAngle = this.prevAngle;
    this.prevAngle = angle;
    this.prevTimestamp = timestampMs;
    if (dt <= 0) return null;

    return (angle - prevAngle) / dt;
  }

  reset(): void {
    this.prevAngle = null;
    this.prevTimestamp = null;
  }
}
