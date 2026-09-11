import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { WeekLogEntry } from '@/domain/workouts/demoHistory';
import { useTheme } from '@/theme';

type WeekLogCardProps = {
  entries: WeekLogEntry[];
  weekVolumeKg: number;
  intensityMatchPct: number;
};

const STATUS_ICON: Record<WeekLogEntry['status'], keyof typeof Ionicons.glyphMap> = {
  done: 'checkmark-circle',
  today: 'time',
  upcoming: 'ellipse-outline',
  rest: 'checkmark-circle',
};

export function WeekLogCard({ entries, weekVolumeKg, intensityMatchPct }: WeekLogCardProps) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, borderColor: colors.border },
      ]}
    >
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={styles.headerRow}>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            This Week&apos;s Track Record
          </Text>
          <Text style={[typography.captionBold, { color: colors.accent }]}>
            Volume: {(weekVolumeKg / 1000).toFixed(1)}t
          </Text>
        </View>

        <View style={{ gap: 2 }}>
          {entries.map((entry) => {
            const dim = entry.status === 'upcoming' || entry.status === 'rest';
            const iconColor =
              entry.status === 'today'
                ? colors.accent
                : entry.status === 'done'
                  ? colors.success
                  : colors.textMuted;
            return (
              <View key={entry.label} style={[styles.row, { paddingVertical: spacing.xs }]}>
                <Text
                  style={[typography.caption, { color: colors.textMuted, width: 36 }]}
                >
                  {entry.label}
                </Text>
                <Text
                  style={[
                    typography.bodyBold,
                    { color: dim ? colors.textMuted : colors.textPrimary, width: 76 },
                  ]}
                  numberOfLines={1}
                >
                  {entry.splitName}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted, flex: 1 }]}
                  numberOfLines={1}
                >
                  {entry.status === 'today'
                    ? "Today's session"
                    : entry.volumeKg > 0
                      ? `${(entry.volumeKg / 1000).toFixed(1)}t${entry.isPr ? ' · PR' : ''}`
                      : entry.note}
                </Text>
                <Ionicons name={STATUS_ICON[entry.status]} size={16} color={iconColor} />
              </View>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Intensity baseline: {Math.round(intensityMatchPct * 100)}% on-target RIR this week
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 4 },
});
