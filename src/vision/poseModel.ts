import { useTensorflowModel } from 'react-native-fast-tflite';

// MoveNet Lightning (int8), TF Hub google/movenet/singlepose/lightning/tflite/int8/4,
// Apache-2.0. 17 COCO keypoints, 192x192x3 uint8 input — see
// src/domain/vision/moveNetDecode.ts for the output decode and
// src/domain/vision/landmarks.ts for why 17 COCO points (not BlazePose's 33)
// are enough for the initial 5 exercises.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require, per react-native-fast-tflite's documented pattern
const MOVENET_MODEL = require('../../assets/models/movenet-lightning-int8.tflite');

/** Loads the on-device pose model. CPU delegate by default — correctness first, GPU delegates are a later optimization. */
export function usePoseModel() {
  return useTensorflowModel(MOVENET_MODEL, []);
}
