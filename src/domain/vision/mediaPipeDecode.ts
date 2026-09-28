import type { PoseLandmarks } from './landmarks';

export type MediaPipeLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

// MediaPipe Pose's 33-point order mapped to the 17-joint order already used
// by GymBro's biomechanics engine.
const MEDIAPIPE_TO_GYMBRO = [
  0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28,
] as const;

export function decodeMediaPipePose(pose: MediaPipeLandmark[]): PoseLandmarks | null {
  'worklet';
  if (pose.length < 33) return null;
  return MEDIAPIPE_TO_GYMBRO.map((index) => {
    const point = pose[index];
    return {
      x: point.x,
      y: point.y,
      z: point.z,
      visibility: point.visibility ?? 0,
    };
  });
}
