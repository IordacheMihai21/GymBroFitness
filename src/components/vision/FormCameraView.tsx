import { StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { usePoseModel } from '@/vision/poseModel';
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
  const modelPlugin = usePoseModel();
  const model = modelPlugin.state === 'loaded' ? modelPlugin.model : undefined;
  const { frameProcessor, state, finishSet, speechEnabled, setSpeechEnabled } = useFormAnalysis(model, config);

  if (!hasPermission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
        <Text style={[typography.subheading, { color: colors.textPrimary, textAlign: 'center' }]}>
          Camera access needed
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
          GymBroFitness analyzes your form on-device — video never leaves your phone.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={{ marginTop: spacing.lg }}>
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
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          frameProcessor={modelPlugin.state === 'loaded' ? frameProcessor : undefined}
        />
        {modelPlugin.state === 'loaded' && <SkeletonOverlay landmarks={state.landmarks} />}
        {modelPlugin.state !== 'loaded' && (
          <View style={[StyleSheet.absoluteFill, styles.centered, { backgroundColor: colors.background + 'CC' }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {modelPlugin.state === 'error' ? 'Failed to load the form-analysis model.' : 'Loading form analysis…'}
            </Text>
          </View>
        )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraFrame: {
    aspectRatio: 1,
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
});
