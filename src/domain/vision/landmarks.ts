/**
 * Landmark shape and joint extraction for the on-device pose model.
 *
 * The native detector is MediaPipe Pose Landmarker Full (33 points). The
 * existing biomechanics engine consumes this stable 17-joint anatomical
 * subset: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles.
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** Model confidence, 0-1. Named to match the pose-estimation convention (BlazePose calls this "visibility"). */
  visibility: number;
}

/** Raw model output: 17 landmarks in COCO order. */
export type PoseLandmarks = Landmark[];

export interface KeyJoints {
  nose: Landmark;
  leftEye: Landmark;
  rightEye: Landmark;
  leftEar: Landmark;
  rightEar: Landmark;
  leftShoulder: Landmark;
  rightShoulder: Landmark;
  leftElbow: Landmark;
  rightElbow: Landmark;
  leftWrist: Landmark;
  rightWrist: Landmark;
  leftHip: Landmark;
  rightHip: Landmark;
  leftKnee: Landmark;
  rightKnee: Landmark;
  leftAnkle: Landmark;
  rightAnkle: Landmark;
}

export const KEY_JOINT_NAMES = [
  'nose',
  'leftEye',
  'rightEye',
  'leftEar',
  'rightEar',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
] as const satisfies readonly (keyof KeyJoints)[];

/** Extracts named joints from the model's raw 17-point COCO-order output. */
export function extractKeyJoints(landmarks: PoseLandmarks): KeyJoints | null {
  if (!landmarks || landmarks.length < KEY_JOINT_NAMES.length) return null;

  const joints = {} as KeyJoints;
  KEY_JOINT_NAMES.forEach((name, index) => {
    joints[name] = landmarks[index];
  });
  return joints;
}
