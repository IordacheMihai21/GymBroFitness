import { StyleSheet, Text, View } from 'react-native';

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
  const { colors, radius, spacing, typography } = useTheme();
  const phaseColor = status.phase === 'deload' ? colors.warning : colors.accent;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, borderColor: colors.border },
      ]}
    >
      <View style={{ padding: spacing.lg, gap: 6 }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Block: {blockName}</Text>
        <View style={styles.headerRow}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            Week {status.currentWeek} of {status.totalWeeks} ({PHASE_LABEL[status.phase]})
          </Text>
        </View>

        <View style={[styles.track, { backgroundColor: colors.surfacePressed, borderRadius: radius.pill }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(status.progress * 100)}%`,
                backgroundColor: phaseColor,
                borderRadius: radius.pill,
              },
            ]}
          />
        </View>

        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {status.phase === 'deload'
            ? 'Deload week — reduced load, same movements'
            : `Deload in ${status.daysToDeload} day${status.daysToDeload === 1 ? '' : 's'}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, overflow: 'hidden' },
  fill: { height: '100%' },
});
