import { StyleSheet, Text, View } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { ProgressBar, TouchableRipple } from 'react-native-paper';

import type { MesocycleStatus } from '@/domain/programs/mesocycle';
import { computePreWorkoutStatus, type PreWorkoutLog } from '@/domain/workouts/preRoutine';
import { useTheme } from '@/theme';

type HomePreflightRailProps = {
  intensityMatchPct: number;
  preWorkoutLog: PreWorkoutLog;
  status: MesocycleStatus;
  onFuelPress: () => void;
};

export function HomePreflightRail({
  intensityMatchPct,
  preWorkoutLog,
  status,
  onFuelPress,
}: HomePreflightRailProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const fuel = computePreWorkoutStatus(preWorkoutLog);
  const fatigueLabel =
    status.phase === 'overreaching' ? 'High load' : status.phase === 'deload' ? 'Deload' : 'Managed';
  const readinessScore = Math.min(
    96,
    Math.max(68, Math.round(78 + intensityMatchPct * 12 + (fuel.minutesToPeak <= 25 ? 4 : 1) - 2)),
  );
  const fuelProgress = Math.min(1, fuel.minutesSinceTaken / preWorkoutLog.peakWindowMinutes);
  const blockProgress = status.currentWeek / status.totalWeeks;

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
      <TouchableRipple onPress={onFuelPress} style={styles.cell} borderless>
        <View style={styles.cellInner}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>Fuel</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {fuel.atPeak ? 'Peak now' : `${fuel.minutesToPeak}m`}
          </Text>
          <ProgressBar
            progress={fuelProgress}
            color={colors.accent}
            style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
          />
        </View>
      </TouchableRipple>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cell}>
        <View style={styles.readyCellInner}>
          <AnimatedCircularProgress
            size={42}
            width={4}
            fill={readinessScore}
            tintColor={colors.accent}
            backgroundColor={colors.surfacePressed}
            lineCap="round"
            duration={700}
          >
            {() => (
              <Text style={[typography.micro, { color: colors.textPrimary }]}>
                {readinessScore}
              </Text>
            )}
          </AnimatedCircularProgress>
          <View style={styles.readyCopy}>
            <Text style={[typography.micro, { color: colors.textMuted }]}>Ready</Text>
            <Text style={[typography.micro, { color: colors.accent }]}>green light</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cell}>
        <View style={styles.cellInner}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>Block</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            W{status.currentWeek}/{status.totalWeeks}
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>{fatigueLabel}</Text>
          <ProgressBar
            progress={blockProgress}
            color={colors.accent}
            style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
          />
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
  readyCellInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  readyCopy: {
    gap: 3,
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
