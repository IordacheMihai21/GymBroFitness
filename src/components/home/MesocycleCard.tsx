import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon, ProgressBar } from 'react-native-paper';

import type { MesocycleStatus } from '@/domain/programs/mesocycle';
import { useTheme } from '@/theme';

type MesocycleCardProps = {
  blockName: string;
  status: MesocycleStatus;
};

const PHASE_LABEL: Record<MesocycleStatus['phase'], string> = {
  accumulation: 'Accumulation',
  overreaching: 'Overreaching',
  deload: 'Deload Week',
};

export function MesocycleCard({ blockName, status }: MesocycleCardProps) {
  const { colors, spacing, typography } = useTheme();
  const phaseColor = status.phase === 'deload' ? colors.warning : colors.accent;
  const fatigueLabel =
    status.phase === 'deload' ? 'Low' : status.phase === 'overreaching' ? 'High' : 'Medium';

  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Current block</Text>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{blockName}</Text>
          </View>
          <View style={[styles.phaseBadge, { backgroundColor: colors.accentSoft }]}>
            <Icon source="calendar-sync" size={14} color={phaseColor} />
            <Text style={[typography.micro, { color: phaseColor }]}>
              {PHASE_LABEL[status.phase]}
            </Text>
          </View>
        </View>

        <View style={styles.phaseRail}>
          {(['accumulation', 'overreaching', 'deload'] as const).map((phase) => (
            <View
              key={phase}
              style={[
                styles.phaseSegment,
                {
                  backgroundColor:
                    phase === status.phase ? phaseColor : colors.surfacePressed,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.headerRow}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            Week {status.currentWeek} of {status.totalWeeks}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Fatigue: {fatigueLabel}
          </Text>
        </View>

        <ProgressBar
          progress={status.progress}
          color={phaseColor}
          style={{ height: 8, borderRadius: 4, marginVertical: spacing.xs }}
        />

        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {status.phase === 'deload'
            ? 'Deload week — reduced load, same movements'
            : `Deload in ${status.daysToDeload} day${status.daysToDeload === 1 ? '' : 's'}`}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  phaseRail: {
    flexDirection: 'row',
    gap: 5,
  },
  phaseSegment: {
    flex: 1,
    height: 8,
    borderRadius: 999,
  },
});
