import {
  VisionCameraProxy,
  type Frame,
  type FrameProcessorPlugin,
} from 'react-native-vision-camera';

import { decodeMediaPipePose, type MediaPipeLandmark } from '@/domain/vision/mediaPipeDecode';
import type { PoseLandmarks } from '@/domain/vision/landmarks';

type NativePoseResult = {
  pose?: MediaPipeLandmark[];
  inferenceMs?: number;
  error?: string;
};

export type MediaPipePoseResult = {
  landmarks: PoseLandmarks | null;
  inferenceMs: number;
  error: string | null;
};

let posePlugin: FrameProcessorPlugin | undefined;
try {
  posePlugin = VisionCameraProxy.initFrameProcessorPlugin('poseLandmarker', {});
} catch {
  // A JS-only/Expo Go build has no native plugin. The camera screen displays
  // an actionable recovery message instead of failing module evaluation.
  posePlugin = undefined;
}

export function isMediaPipePoseAvailable(): boolean {
  return posePlugin != null;
}

export function detectMediaPipePose(frame: Frame): MediaPipePoseResult {
  'worklet';
  if (posePlugin == null) {
    return { landmarks: null, inferenceMs: 0, error: 'plugin-unavailable' };
  }

  const result = posePlugin.call(frame) as NativePoseResult | undefined;
  const pose = result?.pose;
  if (!Array.isArray(pose) || pose.length < 33) {
    return {
      landmarks: null,
      inferenceMs: result?.inferenceMs ?? 0,
      error: result?.error ?? null,
    };
  }

  const landmarks = decodeMediaPipePose(pose);
  return { landmarks, inferenceMs: result?.inferenceMs ?? 0, error: result?.error ?? null };
}
