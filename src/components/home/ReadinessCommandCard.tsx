import { StyleSheet, Text, View } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { Card, Divider, Icon } from 'react-native-paper';

import type { MesocycleStatus } from '@/domain/programs/mesocycle';
import { computePreWorkoutStatus, type PreWorkoutLog } from '@/domain/workouts/preRoutine';
import { useTheme, type Theme } from '@/theme';

type ReadinessCommandCardProps = {
  intensityMatchPct: number;
  preWorkoutLog: PreWorkoutLog;
  status: MesocycleStatus;
};

type Band = 'good' | 'caution' | 'hold';

function bandFor(score01: number): Band {
  if (score01 >= 0.8) return 'good';
  if (score01 >= 0.55) return 'caution';
  return 'hold';
}

function bandColor(band: Band, colors: Theme['colors']): string {
  return band === 'good' ? colors.success : band === 'caution' ? colors.warning : colors.danger;
}

export function ReadinessCommandCard({
  intensityMatchPct,
  preWorkoutLog,
  status,
}: ReadinessCommandCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const preWorkoutStatus = computePreWorkoutStatus(preWorkoutLog);
  const fatiguePenalty = status.phase === 'overreaching' ? 7 : status.phase === 'deload' ? -4 : 2;
  const fuelBonus = preWorkoutStatus.atPeak ? 7 : preWorkoutStatus.minutesToPeak <= 25 ? 4 : 1;
  const readinessScore = Math.min(
    96,
    Math.max(68, Math.round(78 + intensityMatchPct * 12 + fuelBonus - fatiguePenalty)),
  );
  const readinessBand = bandFor(readinessScore / 100);
  const ringColor = bandColor(readinessBand, colors);
  const bandLabel =
    readinessBand === 'good' ? 'GREEN LIGHT' : readinessBand === 'caution' ? 'CAUTION' : 'HOLD BACK';

  const signals = [
    {
      label: 'Fuel',
      value: `${preWorkoutLog.doseMg}mg`,
      detail: preWorkoutStatus.atPeak ? 'Peak window' : `${preWorkoutStatus.minutesToPeak}m to peak`,
      score: preWorkoutStatus.atPeak ? 0.94 : 0.78,
    },
    {
      label: 'Intent',
      value: `${Math.round(intensityMatchPct * 100)}%`,
      detail: 'RIR matched',
      score: intensityMatchPct,
    },
    {
      label: 'Fatigue',
      value: status.phase === 'overreaching' ? 'High' : 'Managed',
      detail: `${status.daysToDeload}d to deload`,
      score: status.phase === 'overreaching' ? 0.64 : 0.82,
    },
  ];

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.lg }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Command check</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>
              Training readiness
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${ringColor}26` }]}>
            <View style={[styles.statusDot, { backgroundColor: ringColor }]} />
            <Text style={[typography.micro, { color: ringColor }]}>{bandLabel}</Text>
          </View>
        </View>

        <View style={styles.ringRow}>
          <AnimatedCircularProgress
            size={128}
            width={11}
            fill={readinessScore}
            tintColor={ringColor}
            backgroundColor={colors.surfacePressed}
            lineCap="round"
            duration={900}
          >
            {() => (
              <View style={styles.ringCenter}>
                <Text style={[typography.jumbo, { fontSize: 34, lineHeight: 38, color: colors.textPrimary }]}>
                  {readinessScore}
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted }]}>/ 100</Text>
              </View>
            )}
          </AnimatedCircularProgress>

          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              Start window is open.
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Keep warmups crisp and let the first compound set decide the session ceiling.
            </Text>
          </View>
        </View>

        <Divider />

        <View style={styles.signalGrid}>
          {signals.map((signal) => (
            <SignalGate key={signal.label} {...signal} />
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function SignalGate({
  label,
  value,
  detail,
  score,
}: {
  label: string;
  value: string;
  detail: string;
  score: number;
}) {
  const { colors, typography } = useTheme();
  const band = bandFor(score);
  const color = bandColor(band, colors);

  return (
    <View style={[styles.signalGate, { backgroundColor: colors.surfaceRaised }]}>
      <View style={styles.signalHeader}>
        <View style={styles.signalLabelRow}>
          <View style={[styles.signalDot, { backgroundColor: color }]} />
          <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
        </View>
        <Icon source="pulse" size={13} color={color} />
      </View>
      <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{detail}</Text>
      <View style={[styles.signalTrack, { backgroundColor: colors.surfacePressed }]}>
        <View
          style={[
            styles.signalFill,
            {
              width: `${Math.round(score * 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  signalGate: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  signalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  signalTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 3,
  },
  signalFill: {
    height: 4,
    borderRadius: 999,
  },
});
