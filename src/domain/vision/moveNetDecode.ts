import type { PoseLandmarks } from './landmarks';

export const MOVENET_KEYPOINT_COUNT = 17;
export const MOVENET_INPUT_SIZE = 192;

/**
 * Decodes MoveNet Lightning's raw output tensor into our landmark shape.
 * MoveNet's output is 17 keypoints (COCO order, matching KEY_JOINT_NAMES)
 * x [y, x, confidence] — y-before-x is MoveNet's documented convention,
 * the opposite of this app's own {x, y} field order, so this is the one
 * place that ordering gets corrected.
 *
 * Marked as a worklet so it can be called directly from the VisionCamera
 * frame processor (which runs on react-native-worklets-core's JS runtime,
 * not the main JS thread) without a cross-runtime call.
 */
export function decodeMoveNetOutput(output: ArrayLike<number>): PoseLandmarks {
  'worklet';
  const landmarks: PoseLandmarks = [];
  for (let i = 0; i < MOVENET_KEYPOINT_COUNT; i += 1) {
    const base = i * 3;
    landmarks.push({
      x: output[base + 1],
      y: output[base],
      z: 0,
      visibility: output[base + 2],
    });
  }
  return landmarks;
}
