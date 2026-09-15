/**
 * Landmark shape and joint extraction for the on-device pose model.
 *
 * Uses MoveNet's 17-point COCO keypoint layout (nose, eyes, ears, shoulders,
 * elbows, wrists, hips, knees, ankles) rather than BlazePose's 33 points —
 * see docs/PLAN.md's form-analysis architecture note for why: every rule in
 * the initial 5 exercises (curl, squat, lateral raise, push-up, overhead
 * press) only needs this subset, and MoveNet ships a well-maintained,
 * actively-updated React Native integration path (react-native-fast-tflite)
 * that MediaPipe's browser-only package does not.
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
