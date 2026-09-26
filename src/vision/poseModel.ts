import { useCallback, useEffect, useState } from 'react';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

// MoveNet Lightning (int8), TF Hub google/movenet/singlepose/lightning/tflite/int8/4,
// Apache-2.0. 17 COCO keypoints, 192x192x3 uint8 input — see
// src/domain/vision/moveNetDecode.ts for the output decode and
// src/domain/vision/landmarks.ts for why 17 COCO points (not BlazePose's 33)
// are enough for the initial 5 exercises.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require, per react-native-fast-tflite's documented pattern
const MOVENET_MODEL = require('../../assets/models/movenet-lightning-int8.tflite');

export type PoseModelState =
  | { state: 'loading'; model: undefined; error: undefined }
  | { state: 'loaded'; model: TensorflowModel; error: undefined }
  | { state: 'error'; model: undefined; error: Error };

export type PoseModelPlugin = PoseModelState & {
  retry: () => void;
};

const INITIAL_STATE: PoseModelState = {
  state: 'loading',
  model: undefined,
  error: undefined,
};

/**
 * Loads the pose model with an explicit retry boundary. The library hook only
 * attempts once, which makes a temporary Metro/device connection failure
 * permanent until the whole screen is remounted.
 */
export function usePoseModel(): PoseModelPlugin {
  const [attempt, setAttempt] = useState(0);
  const [modelState, setModelState] = useState<PoseModelState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    loadTensorflowModel(MOVENET_MODEL, [])
      .then((model) => {
        if (active) setModelState({ state: 'loaded', model, error: undefined });
      })
      .catch((value: unknown) => {
        const error = normalizeModelError(value);
        console.error('Failed to load the Form AI pose model.', error);
        if (active) setModelState({ state: 'error', model: undefined, error });
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setModelState(INITIAL_STATE);
    setAttempt((current) => current + 1);
  }, []);
  return { ...modelState, retry };
}

function normalizeModelError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown pose model error');
}
