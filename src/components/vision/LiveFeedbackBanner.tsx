import { StyleSheet, Text, View } from 'react-native';
import { Chip } from 'react-native-paper';

import type { TrackingQuality } from '@/domain/vision/confidence';
import type { FormViolation } from '@/domain/vision/feedbackPriority';
import type { RepAnalysis } from '@/domain/vision/formScoring';
import type { MovementPhase } from '@/domain/vision/repStateMachine';
import { useTheme } from '@/theme';

type LiveFeedbackBannerProps = {
  trackingQuality: TrackingQuality;
  repCount: number;
  phase: MovementPhase;
  topViolation: FormViolation | null;
  lastCompletedRep: RepAnalysis | null;
};

const PHASE_LABELS: Record<MovementPhase, string> = {
  start: 'Ready',
  rising: 'Moving',
  peak: 'Hold',
  falling: 'Returning',
};

export function LiveFeedbackBanner({
  trackingQuality,
  repCount,
  phase,
  topViolation,
  lastCompletedRep,
}: LiveFeedbackBannerProps) {
  const { colors, radius, spacing, typography } = useTheme();

  if (trackingQuality !== 'good') {
    return (
      <View
        style={[
          styles.banner,
          { backgroundColor: colors.warningSoft, borderRadius: radius.lg, marginTop: spacing.md },
        ]}
      >
        <Text style={[typography.bodyBold, { color: colors.warning, textAlign: 'center' }]}>
          {trackingQuality === 'lost' ? 'Step into frame — full body not visible' : 'Move back a little'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <View style={styles.row}>
        <Text style={[typography.display, { color: colors.textPrimary }]}>{repCount}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Chip compact mode="flat">
            {PHASE_LABELS[phase]}
          </Chip>
        </View>
      </View>

      {topViolation ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: topViolation.severity === 'error' ? colors.dangerSoft : colors.warningSoft,
              borderRadius: radius.lg,
            },
          ]}
        >
          <Text
            style={[
              typography.bodyBold,
              { color: topViolation.severity === 'error' ? colors.danger : colors.warning, textAlign: 'center' },
            ]}
          >
            {topViolation.message}
          </Text>
        </View>
      ) : lastCompletedRep ? (
        <View style={[styles.banner, { backgroundColor: colors.successSoft, borderRadius: radius.lg }]}>
          <Text style={[typography.bodyBold, { color: colors.success, textAlign: 'center' }]}>
            Rep {lastCompletedRep.repNumber} · {lastCompletedRep.overallScore}/100
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
