import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon } from 'react-native-paper';

import type { MesocycleStatus } from '@/domain/programs/mesocycle';
import { useTheme } from '@/theme';

type RecoveryProtocolCardProps = {
  status: MesocycleStatus;
  weekVolumeKg: number;
};

export function RecoveryProtocolCard({ status, weekVolumeKg }: RecoveryProtocolCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const volumeTons = (weekVolumeKg / 1000).toFixed(1);
  const protocol =
    status.phase === 'overreaching'
      ? [
          ['Log honestly', 'Keep RIR clean; no hidden grinders.'],
          ['Refuel', 'Protein plus carbs inside the first hour.'],
          ['Sleep gate', 'Protect 8h before next lower day.'],
        ]
      : [
          ['Lock data', 'Save top set and any joint notes.'],
          ['Reload', 'Hydrate, protein, easy carbs.'],
          ['Prepare', 'Preview next session before bed.'],
        ];

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
            <Text style={[typography.micro, { color: colors.accent }]}>After lift</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Recovery protocol
            </Text>
          </View>
          <View style={styles.volumeBlock}>
            <Text style={[typography.numeric, { color: colors.textPrimary }]}>{volumeTons}t</Text>
            <Text style={[typography.micro, { color: colors.textMuted }]}>week load</Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          {protocol.map(([title, detail], index) => (
            <View key={title} style={styles.protocolRow}>
              <View style={styles.timeline}>
                <View style={[styles.timelineDot, { backgroundColor: colors.accent }]} />
                {index < protocol.length - 1 ? (
                  <View style={[styles.timelineLine, { backgroundColor: colors.borderStrong }]} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                  {title}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {detail}
                </Text>
              </View>
              <Icon source="check" size={15} color={colors.accent} />
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
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
    gap: 12,
  },
  volumeBlock: {
    alignItems: 'flex-end',
  },
  protocolRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timeline: {
    width: 14,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  timelineLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    marginTop: 3,
  },
});
