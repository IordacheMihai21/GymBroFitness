import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon } from 'react-native-paper';

import {
  formatProgressionSignal,
  formatDecisionTarget,
  progressionActionLabel,
  type TargetToBeat,
} from '@/domain/workouts/targetToBeat';
import { useTheme } from '@/theme';
import type { Units } from '@/types';

type OverloadRunwayCardProps = {
  target: TargetToBeat;
  units: Units;
};

export function OverloadRunwayCard({ target, units }: OverloadRunwayCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const { decision } = target;
  const comparableSessions = Number(decision.supportingMetrics.comparableHistorySessions ?? 0);
  const confidenceCopy =
    comparableSessions >= 2
      ? `${comparableSessions} comparable sessions`
      : comparableSessions === 1
        ? '1 comparable session'
        : 'Limited history';
  const lastValue = target.lastSignal
    ? formatProgressionSignal(target.lastSignal, units)
    : 'Baseline';

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Progression engine</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Overload runway
            </Text>
          </View>
          <View style={[styles.confidenceBadge, { backgroundColor: colors.accentSoft }]}>
            <Icon source="radar" size={14} color={colors.accent} />
            <Text style={[typography.micro, { color: colors.accent }]}>{confidenceCopy}</Text>
          </View>
        </View>

        <View style={styles.runway}>
          <RunwayStep label="Last signal" value={lastValue} />
          <View style={[styles.connector, { backgroundColor: colors.borderStrong }]} />
          <RunwayStep label="Today target" value={formatDecisionTarget(decision, units)} active />
          <View style={[styles.connector, { backgroundColor: colors.borderStrong }]} />
          <RunwayStep label="Decision" value={progressionActionLabel(decision.action)} />
        </View>

        <View style={[styles.coachNote, { backgroundColor: colors.surfaceRaised }]}>
          <Icon source="chart-timeline-variant-shimmer" size={18} color={colors.accent} />
          <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
            {decision.explanation}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function RunwayStep({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.step}>
      <View
        style={[
          styles.stepNode,
          {
            backgroundColor: active ? colors.accent : colors.surfacePressed,
            borderColor: active ? colors.accent : colors.borderStrong,
          },
        ]}
      />
      <Text
        style={[typography.micro, { color: active ? colors.accent : colors.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  runway: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    width: 86,
    gap: 3,
  },
  stepNode: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  connector: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginLeft: -20,
    marginTop: -31,
  },
  coachNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 12,
  },
});
