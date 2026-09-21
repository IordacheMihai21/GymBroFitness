import { StyleSheet, Text, View } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import { Card, Divider, Icon, List, ProgressBar } from 'react-native-paper';

import type { WeekLogEntry } from '@/domain/workouts/demoHistory';
import { useTheme } from '@/theme';
import type { Units } from '@/types';
import { formatVolumeLoad, kgToLb } from '@/utils/units';

type WeekLogCardProps = {
  entries: WeekLogEntry[];
  weekVolumeKg: number;
  intensityMatchPct: number;
  units: Units;
};

const STATUS_ICON: Record<WeekLogEntry['status'], string> = {
  done: 'check-circle',
  today: 'clock-outline',
  upcoming: 'circle-outline',
  rest: 'check-circle',
};

export function WeekLogCard({ entries, weekVolumeKg, intensityMatchPct, units }: WeekLogCardProps) {
  const { colors, spacing, typography } = useTheme();
  const completedVolumeT = (entry: WeekLogEntry) =>
    entry.status === 'done'
      ? units === 'kg'
        ? entry.volumeKg / 1000
        : kgToLb(entry.volumeKg) / 1000
      : 0;
  const trendData: lineDataItem[] = entries.map((entry) => ({
    value: Math.max(completedVolumeT(entry), 0.2),
  }));
  const maxVolumeT = Math.max(...entries.map(completedVolumeT), 1);

  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>Week to date</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Real work logged before today&apos;s session
            </Text>
          </View>
          <View style={styles.volumeBlock}>
            <Text style={[typography.display, { color: colors.accent }]}>
              {formatVolumeLoad(weekVolumeKg, units)}
            </Text>
            <Text style={[typography.micro, { color: colors.textMuted }]}>volume</Text>
          </View>
        </View>

        <View style={styles.weekStrip}>
          {entries.map((entry) => (
            <DayMarker key={entry.label} entry={entry} />
          ))}
        </View>

        <View style={styles.trendRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
              Volume trend
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Tonnage only counts completed work
            </Text>
          </View>
          <VolumeSparkline data={trendData} maxValue={maxVolumeT + 2} />
        </View>

        {entries.map((entry) => {
          const dim = entry.status === 'upcoming' || entry.status === 'rest';
          const iconColor =
            entry.status === 'today'
              ? colors.accent
              : entry.status === 'done'
                ? colors.accent
                : colors.textMuted;
          const description =
            entry.status === 'today'
              ? "Today's session"
              : entry.status === 'done' && entry.volumeKg > 0
                ? `${formatVolumeLoad(entry.volumeKg, units)}${entry.isPr ? ' · PR' : ''}`
                : entry.status === 'upcoming'
                  ? 'Upcoming'
                  : entry.note;

          return (
            <List.Item
              key={entry.label}
              title={`${entry.label} · ${entry.splitName}`}
              description={description}
              titleStyle={[
                typography.bodyBold,
                { color: dim ? colors.textMuted : colors.textPrimary },
              ]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={styles.listItem}
              right={() => <Icon source={STATUS_ICON[entry.status]} size={18} color={iconColor} />}
            />
          );
        })}

        <Divider />
        <View style={{ gap: spacing.xs }}>
          <View style={styles.headerRow}>
            <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
              RIR discipline
            </Text>
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
              {Math.round(intensityMatchPct * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={intensityMatchPct}
            color={colors.accent}
            style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

function DayMarker({ entry }: { entry: WeekLogEntry }) {
  const { colors, typography } = useTheme();
  const active = entry.status === 'today';
  const done = entry.status === 'done';
  const rest = entry.status === 'rest';
  const borderColor = active || done ? colors.accent : colors.border;
  const backgroundColor = active
    ? colors.accentSoft
    : done
      ? colors.surfacePressed
      : colors.surface;

  return (
    <View style={[styles.dayMarker, { borderColor, backgroundColor }]}>
      <Text style={[typography.micro, { color: active ? colors.accent : colors.textMuted }]}>
        {entry.label.slice(0, 1)}
      </Text>
      <View
        style={[
          styles.dayDot,
          {
            backgroundColor: rest
              ? colors.textMuted
              : done
                ? colors.accent
                : active
                  ? colors.accent
                  : colors.borderStrong,
          },
        ]}
      />
    </View>
  );
}

function VolumeSparkline({ data, maxValue }: { data: lineDataItem[]; maxValue: number }) {
  const { colors } = useTheme();

  return (
    <View style={styles.sparklineClip}>
      <LineChart
        data={data}
        height={54}
        width={132}
        maxValue={maxValue}
        spacing={20}
        initialSpacing={0}
        endSpacing={0}
        thickness={3}
        color={colors.accent}
        curved
        areaChart
        startFillColor={colors.accent}
        endFillColor={colors.accent}
        startOpacity={0.18}
        endOpacity={0.02}
        hideAxesAndRules
        hideDataPoints
        disableScroll
        backgroundColor="transparent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volumeBlock: {
    alignItems: 'flex-end',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayMarker: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  trendRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparklineClip: {
    width: 132,
    height: 54,
    overflow: 'hidden',
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  listItem: { paddingHorizontal: 0, paddingVertical: 0, minHeight: 0 },
});
