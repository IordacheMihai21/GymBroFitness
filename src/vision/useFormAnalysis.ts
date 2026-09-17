import { useCallback, useMemo, useRef, useState } from 'react';
import { useFrameProcessor, type Frame } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useRunOnJS } from 'react-native-worklets-core';
import { NitroModules } from 'react-native-nitro-modules';
import type { TensorflowModel } from 'react-native-fast-tflite';
import * as Speech from 'expo-speech';

import {
  decodeMoveNetOutput,
  MOVENET_INPUT_SIZE,
} from '@/domain/vision/moveNetDecode';
import {
  cameraAngleMismatchMessage,
  detectCameraOrientation,
  isCameraAngleMismatched,
} from '@/domain/vision/cameraOrientation';
import { extractKeyJoints, type PoseLandmarks } from '@/domain/vision/landmarks';
import { LandmarkSmoother } from '@/domain/vision/smoothing';
import { VelocityTracker, getSymmetryRatio } from '@/domain/vision/biomechanics';
import { assessTrackingQuality, hasRequiredJoints, type TrackingQuality } from '@/domain/vision/confidence';
import { TemporalFilter } from '@/domain/vision/temporalFilter';
import {
  createInitialRepMachineState,
  updateRepMachine,
  type MovementPhase,
} from '@/domain/vision/repStateMachine';
import { scoreRep, type RepAnalysis } from '@/domain/vision/formScoring';
import { pickTopViolation, resolvePriority, type FormViolation } from '@/domain/vision/feedbackPriority';
import { VoiceCoach } from '@/domain/vision/voiceCoaching';
import type { VisionExerciseConfig } from '@/domain/vision/exerciseVisionConfigs/types';

export interface FormAnalysisState {
  trackingQuality: TrackingQuality;
  repCount: number;
  phase: MovementPhase;
  currentAngle: number | null;
  topViolation: FormViolation | null;
  lastCompletedRep: RepAnalysis | null;
  /** Smoothed per-frame landmarks, for a plain (non-Skia) overlay to draw — see useFrameProcessor below for why. */
  landmarks: PoseLandmarks | null;
}

const INITIAL_STATE: FormAnalysisState = {
  trackingQuality: 'lost',
  repCount: 0,
  phase: 'start',
  currentAngle: null,
  topViolation: null,
  lastCompletedRep: null,
  landmarks: null,
};

/**
 * Owns the whole per-frame analysis pipeline for one exercise: the camera
 * frame processor (pose inference, running on the VisionCamera/worklets-core
 * thread) and the stateful rep-counting/scoring logic (running on the JS
 * thread, using the exact same Phase 1 domain modules, unit-tested
 * independently of any camera).
 *
 * Split deliberately across two threads: the frame processor worklet only
 * does inference with the model's raw per-frame landmarks (no stateful
 * classes — worklet runtimes make bridging class instances across the
 * worklet boundary unreliable). Every decoded frame is bridged to the JS
 * thread via `runOnJS`, where smoothing/rep-state/scoring/the skeleton
 * overlay all run as plain, already-tested JS.
 */
export function useFormAnalysis(model: TensorflowModel | undefined, config: VisionExerciseConfig) {
  const { resize } = useResizePlugin();
  const [state, setState] = useState<FormAnalysisState>(INITIAL_STATE);

  const smoother = useMemo(() => new LandmarkSmoother(), []);
  const velocityTracker = useMemo(() => new VelocityTracker(), []);
  const temporalFilter = useMemo(() => new TemporalFilter(), []);
  const voiceCoach = useMemo(() => new VoiceCoach(), []);
  const repStateRef = useRef(createInitialRepMachineState());
  const repViolationsRef = useRef<Map<string, FormViolation>>(new Map());
  const repsRef = useRef<RepAnalysis[]>([]);

  // A ref (not just the state below) so the frame-processor callback can read
  // the current mute setting without depending on it — toggling mute must not
  // recreate the callback and tear down VisionCamera's native frame processor.
  const speechEnabledRef = useRef(true);
  const [speechEnabled, setSpeechEnabledState] = useState(true);
  const setSpeechEnabled = useCallback((enabled: boolean) => {
    speechEnabledRef.current = enabled;
    setSpeechEnabledState(enabled);
    if (!enabled) Speech.stop();
  }, []);

  // The TFLite model is a Nitro HybridObject (native C++ state). VisionCamera
  // v4's frame-processor worklet runtime (react-native-worklets-core) can't
  // capture that native state directly across the worklet boundary — it has
  // to be boxed into a plain JS-safe handle here and unboxed back inside the
  // worklet on every call. This is the exact workaround react-native-fast-
  // tflite's own README documents for VisionCamera v4 (unnecessary only on
  // v5, which this app isn't using — see docs/PLAN.md).
  const boxedModel = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);

  const onFrameLandmarks = useCallback(
    (rawLandmarks: PoseLandmarks) => {
      const timestampMs = Date.now();
      const smoothed = smoother.smooth(rawLandmarks, timestampMs);
      const joints = extractKeyJoints(smoothed);
      const quality = assessTrackingQuality(joints);

      if (!hasRequiredJoints(joints, config.requiredJoints)) {
        setState((prev) => ({ ...prev, trackingQuality: quality, landmarks: smoothed }));
        return;
      }

      const angle = config.getAngle(joints);
      const velocity = velocityTracker.update(angle, timestampMs);
      const result = updateRepMachine(
        repStateRef.current,
        angle,
        velocity,
        config.direction,
        config.thresholds,
        timestampMs,
      );
      repStateRef.current = result.state;

      const activeViolations: FormViolation[] = [];
      for (const rule of config.formRules) {
        const isActive = rule.check(joints, angle, result.state.phase);
        const confirmed = temporalFilter.update(rule.id, isActive, timestampMs, rule.persistMs);
        if (confirmed) {
          const violation: FormViolation = {
            id: rule.id,
            message: rule.message,
            severity: rule.severity,
            priority: resolvePriority(rule.severity, rule.priority),
          };
          activeViolations.push(violation);
          repViolationsRef.current.set(rule.id, violation);
        }
      }

      // Checked independently of the exercise's own form rules, and not added
      // to repViolationsRef: a wrong camera angle is a setup problem, not a
      // per-rep fault, so it shouldn't count against this rep's alignment
      // score — but it undermines every other measurement, so it outranks
      // them all for what's actually shown/spoken.
      const orientationMismatched = isCameraAngleMismatched(
        detectCameraOrientation(joints),
        config.recommendedCameraAngle,
      );
      const cameraAngleConfirmed = temporalFilter.update(
        'camera-angle-mismatch',
        orientationMismatched,
        timestampMs,
        1500,
      );
      if (cameraAngleConfirmed) {
        activeViolations.push({
          id: 'camera-angle-mismatch',
          message: cameraAngleMismatchMessage(config.recommendedCameraAngle),
          severity: 'warning',
          priority: -10,
        });
      }

      const topViolation = pickTopViolation(activeViolations);

      let newlyCompletedRep: RepAnalysis | null = null;
      if (result.repCompleted && result.completedRepTiming) {
        const symmetryRatio =
          config.getAngleLeft && config.getAngleRight
            ? getSymmetryRatio(config.getAngleLeft(joints), config.getAngleRight(joints))
            : null;
        newlyCompletedRep = scoreRep({
          repNumber: repsRef.current.length + 1,
          timing: result.completedRepTiming,
          minRomDegrees: config.minRomDegrees,
          concentricDirection: config.concentricDirection,
          idealTempo: config.idealTempo,
          scoringWeights: config.scoringWeights,
          ruleViolations: Array.from(repViolationsRef.current.values()),
          symmetryRatio,
          stabilityJitterDegrees: null,
        });
        repsRef.current.push(newlyCompletedRep);
        repViolationsRef.current.clear();
      }

      if (speechEnabledRef.current) {
        const cue = voiceCoach.decide({ repCompleted: newlyCompletedRep, topViolation }, timestampMs);
        if (cue) Speech.speak(cue.text, { rate: 1.05 });
      }

      setState((prev) => ({
        trackingQuality: quality,
        repCount: result.state.count,
        phase: result.state.phase,
        currentAngle: angle,
        topViolation,
        lastCompletedRep: newlyCompletedRep ?? prev.lastCompletedRep,
        landmarks: smoothed,
      }));
    },
    // Deliberately excludes `state`: it's read only via the setState updater above, keeping
    // this (and the frame processor built on it) stable across reps instead of recreating
    // VisionCamera's native frame processor context every rep.
    [config, smoother, velocityTracker, temporalFilter, voiceCoach],
  );

  const reportLandmarks = useRunOnJS(onFrameLandmarks, [onFrameLandmarks]);

  // A plain (non-Skia) frame processor: on some devices (confirmed on a real
  // Samsung Galaxy S24) the camera's native hardware buffer can't be wrapped
  // into a Skia SkImage — useSkiaFrameProcessor's frame.render() throws
  // "Failed to convert NativeBuffer to SkImage!" on every frame, since Skia's
  // GPU import path doesn't recognize that device's buffer format. Inference
  // (resize + model.runSync) never needs Skia at all, and the camera preview
  // renders itself natively regardless of what the frame processor does — so
  // dropping Skia here sidesteps that whole class of device incompatibility.
  // The skeleton overlay is drawn separately in JS (SkeletonOverlay.tsx) from
  // the landmarks already bridged to onFrameLandmarks below.
  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      if (boxedModel == null) return;
      const model = boxedModel.unbox();

      const resized = resize(frame, {
        scale: { width: MOVENET_INPUT_SIZE, height: MOVENET_INPUT_SIZE },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });
      const inputBuffer = resized.buffer.slice(
        resized.byteOffset,
        resized.byteOffset + resized.byteLength,
      ) as ArrayBuffer;
      const outputs = model.runSync([inputBuffer]);
      const landmarks = decodeMoveNetOutput(new Float32Array(outputs[0]));

      reportLandmarks(landmarks);
    },
    [boxedModel, resize, reportLandmarks],
  );

  const resetSet = useCallback(() => {
    repsRef.current = [];
    repViolationsRef.current.clear();
    repStateRef.current = createInitialRepMachineState();
    smoother.reset();
    velocityTracker.reset();
    temporalFilter.reset();
    voiceCoach.reset();
    Speech.stop();
    setState(INITIAL_STATE);
  }, [smoother, velocityTracker, temporalFilter, voiceCoach]);

  const finishSet = useCallback((): RepAnalysis[] => {
    const reps = repsRef.current;
    resetSet();
    return reps;
  }, [resetSet]);

  return { frameProcessor, state, finishSet, resetSet, speechEnabled, setSpeechEnabled };
}
