import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import {
  Camera,
  type CameraRuntimeError,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';

import { isMediaPipePoseAvailable } from '@/vision/mediaPipePose';
import { useFormAnalysis } from '@/vision/useFormAnalysis';
import type { VisionExerciseConfig } from '@/domain/vision/exerciseVisionConfigs/types';
import type { RepAnalysis } from '@/domain/vision/formScoring';
import { useTheme } from '@/theme';

import { LiveFeedbackBanner } from './LiveFeedbackBanner';
import { SkeletonOverlay } from './SkeletonOverlay';

type FormCameraViewProps = {
  config: VisionExerciseConfig;
  onFinishSet: (reps: RepAnalysis[]) => void;
};

export function FormCameraView({ config, onFinishSet }: FormCameraViewProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
    { fps: 5 },
  ]);
  const cameraFps = format ? Math.max(format.minFps, Math.min(5, format.maxFps)) : undefined;
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const [hasWindowFocus, setHasWindowFocus] = useState(AppState.currentState === 'active');
  const lifecycleActiveRef = useRef(AppState.currentState === 'active');
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<CameraRuntimeError | null>(null);
  const [cameraRestartKey, setCameraRestartKey] = useState(0);
  const [analysisReady, setAnalysisReady] = useState(false);
  const poseLandmarkerAvailable = isMediaPipePoseAvailable();
  const { frameProcessor, state, finishSet, speechEnabled, setSpeechEnabled } =
    useFormAnalysis(config);

  useEffect(() => {
    function pauseForBackground() {
      lifecycleActiveRef.current = false;
      setHasWindowFocus(false);
    }

    function resumeFromBackground() {
      lifecycleActiveRef.current = true;
      setHasWindowFocus(true);
      setCameraError(null);
    }

    const stateSubscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (nextState === 'active') {
        resumeFromBackground();
      } else {
        pauseForBackground();
      }
    });
    // Android emits blur/focus when the notification shade is shown while the
    // process remains active. Pause capture, but keep the native view mounted.
    // The same applies to background transitions: toggling `isActive` lets
    // CameraX reuse one ImageReader instead of briefly overlapping old and new
    // sessions while frame-processor buffers are still being released.
    const blurSubscription = AppState.addEventListener('blur', () => {
      lifecycleActiveRef.current = false;
      setHasWindowFocus(false);
    });
    const focusSubscription = AppState.addEventListener('focus', () => {
      if (AppState.currentState === 'active') {
        lifecycleActiveRef.current = true;
        setHasWindowFocus(true);
      }
    });

    return () => {
      stateSubscription.remove();
      blurSubscription.remove();
      focusSubscription.remove();
    };
  }, []);

  const shouldMountCamera = isFocused;
  const cameraShouldRun =
    isFocused && appState === 'active' && hasWindowFocus && cameraError == null;

  useEffect(() => {
    const canAnalyze = cameraShouldRun && poseLandmarkerAvailable;
    // CameraX can start delivering analysis frames while its ImageReader is
    // still being recreated after resume. Let the preview settle first so no
    // stale buffers overlap the new frame-processor pipeline. Disable it on
    // the next task immediately when focus is lost.
    const timeout = setTimeout(() => setAnalysisReady(canAnalyze), canAnalyze ? 1000 : 0);
    return () => clearTimeout(timeout);
  }, [cameraRestartKey, cameraShouldRun, poseLandmarkerAvailable]);

  async function handleRequestPermission() {
    setRequestingPermission(true);
    setPermissionError(null);
    try {
      const granted = await requestPermission();
      if (!granted) {
        setPermissionError(
          'Camera access was not granted. Enable it in system settings to use Form AI.',
        );
      }
    } catch {
      setPermissionError('Camera permission could not be requested. Try again.');
    } finally {
      setRequestingPermission(false);
    }
  }

  if (!hasPermission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
        <Text style={[typography.subheading, { color: colors.textPrimary, textAlign: 'center' }]}>
          Camera access needed
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          Form is analyzed on this phone. Video never leaves it.
        </Text>
        {permissionError ? (
          <Text
            accessibilityRole="alert"
            style={[
              typography.caption,
              { color: colors.danger, textAlign: 'center', marginTop: spacing.md },
            ]}
          >
            {permissionError}
          </Text>
        ) : null}
        <Button
          mode="contained"
          loading={requestingPermission}
          disabled={requestingPermission}
          onPress={handleRequestPermission}
          style={{ marginTop: spacing.lg }}
        >
          Grant camera access
        </Button>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
          No front camera found on this device.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.cameraFrame, { borderRadius: radius.xl, borderColor: colors.border }]}>
        {shouldMountCamera ? (
          <Camera
            key={cameraRestartKey}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            fps={cameraFps}
            pixelFormat="rgb"
            isActive={cameraShouldRun}
            frameProcessor={analysisReady ? frameProcessor : undefined}
            onError={(error) => {
              if (lifecycleActiveRef.current) {
                setCameraError(error);
              }
            }}
            onInitialized={() => setCameraError(null)}
          />
        ) : null}
        <SkeletonOverlay landmarks={state.landmarks} />
        {!poseLandmarkerAvailable ? (
          <RecoveryOverlay
            title="Form AI could not start"
            detail="This build does not include MediaPipe Pose Landmarker. Install the latest native build."
            action="Restart camera"
            onRetry={() => setCameraRestartKey((current) => current + 1)}
          />
        ) : null}
        {cameraError ? (
          <RecoveryOverlay
            title="Camera stopped"
            detail="The camera session was interrupted. Restart it without leaving this workout."
            action="Restart camera"
            onRetry={() => {
              setCameraError(null);
              setCameraRestartKey((current) => current + 1);
            }}
          />
        ) : null}
        <IconButton
          icon={speechEnabled ? 'volume-high' : 'volume-off'}
          mode="contained"
          containerColor={colors.surface + 'CC'}
          iconColor={colors.textPrimary}
          style={styles.muteButton}
          accessibilityLabel={speechEnabled ? 'Mute voice coaching' : 'Unmute voice coaching'}
          onPress={() => setSpeechEnabled(!speechEnabled)}
        />
      </View>

      <LiveFeedbackBanner
        trackingQuality={state.trackingQuality}
        repCount={state.repCount}
        phase={state.phase}
        topViolation={state.topViolation}
        lastCompletedRep={state.lastCompletedRep}
      />

      {__DEV__ && state.performance ? (
        <Text style={[typography.caption, styles.performanceText, { color: colors.textMuted }]}>
          Form AI, {state.performance.processedFps.toFixed(1)} fps,{' '}
          {Math.round(state.performance.averageInferenceMs)} ms/frame
        </Text>
      ) : null}

      <Button
        mode="contained"
        style={{ marginTop: spacing.md }}
        disabled={state.repCount === 0}
        onPress={() => onFinishSet(finishSet())}
      >
        Finish set
      </Button>
    </View>
  );
}

function RecoveryOverlay({
  title,
  detail,
  action,
  onRetry,
}: {
  title: string;
  detail: string;
  action: string;
  onRetry: () => void;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={[
        StyleSheet.absoluteFill,
        styles.centered,
        { backgroundColor: `${colors.background}F2` },
      ]}
    >
      <Text style={[typography.subheading, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
        ]}
      >
        {detail}
      </Text>
      <Button mode="contained" icon="refresh" onPress={onRetry} style={{ marginTop: spacing.lg }}>
        {action}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraFrame: {
    // Matches the portrait 480×640 analysis frame. Avoiding a square `cover`
    // crop is essential: landmark coordinates and preview pixels now share
    // the same geometry.
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    margin: 0,
  },
  performanceText: {
    marginTop: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
