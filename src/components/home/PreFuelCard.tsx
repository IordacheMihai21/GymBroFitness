import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon, ProgressBar } from 'react-native-paper';

import { computePreWorkoutStatus, type PreWorkoutLog } from '@/domain/workouts/preRoutine';
import { useTheme } from '@/theme';

type PreFuelCardProps = {
  log: PreWorkoutLog;
  onPress: () => void;
};

export function PreFuelCard({ log, onPress }: PreFuelCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const status = computePreWorkoutStatus(log);
  const peakProgress = Math.min(1, status.minutesSinceTaken / log.peakWindowMinutes);

  return (
    <Card
      mode="contained"
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={styles.headerRow}>
          <View style={styles.row}>
            <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
              <Icon source="flash" size={16} color={colors.accent} />
            </View>
            <View>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                {log.doseMg}mg {log.substance}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Taken {status.minutesSinceTaken}m ago
              </Text>
            </View>
          </View>
          <Icon source="chevron-right" size={18} color={colors.textMuted} />
        </View>

        <ProgressBar
          progress={peakProgress}
          color={colors.accent}
          style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
        />

        <View style={styles.footerRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {status.atPeak
              ? 'At peak effect'
              : `Peak effect in: ~${status.minutesToPeak} min`}
          </Text>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
            {log.carbsLoadedG}g carbs loaded
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
});
