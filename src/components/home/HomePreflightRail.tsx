import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';

import { useTheme } from '@/theme';

type HomePreflightRailProps = {
  /** Share of sets with logged RIR that matched the prescribed RIR. */
  intensityMatchPct: number;
  sessionsThisWeek: number;
};

export function HomePreflightRail({ intensityMatchPct, sessionsThisWeek }: HomePreflightRailProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const matchPercent = Math.round(intensityMatchPct * 100);

  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.xs,
        },
      ]}
    >
      <View style={styles.cell}>
        <View style={styles.cellInner}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>Logged RIR</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {matchPercent > 0 ? `${matchPercent}%` : 'No data'}
          </Text>
          <ProgressBar
            progress={intensityMatchPct}
            color={colors.accent}
            style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
          />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cell}>
        <View style={styles.cellInner}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>This week</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {sessionsThisWeek} session{sessionsThisWeek === 1 ? '' : 's'}
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>completed</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cell}>
        <View style={styles.cellInner}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>Meaning</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>History only</Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>not readiness</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    minHeight: 82,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    borderRadius: 16,
  },
  cellInner: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 13,
  },
  progress: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 3,
  },
});
