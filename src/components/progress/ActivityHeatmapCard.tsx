import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from 'react-native-paper';

import type { ActivityHeatmap } from '@/domain/workouts/activityHeatmap';
import { useTheme } from '@/theme';

const CELL_SIZE = 12;
const CELL_GAP = 3;

type ActivityHeatmapCardProps = {
  heatmap: ActivityHeatmap;
};

export function ActivityHeatmapCard({ heatmap }: ActivityHeatmapCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstDow = new Date(`${heatmap.days[0]?.date ?? '2026-01-01'}T00:00:00Z`).getUTCDay();
  const columns: (typeof heatmap.days[number] | null)[][] = [];
  heatmap.days.forEach((day, i) => {
    const absoluteIndex = firstDow + i;
    const col = Math.floor(absoluteIndex / 7);
    const row = absoluteIndex % 7;
    if (!columns[col]) columns[col] = [null, null, null, null, null, null, null];
    columns[col][row] = day;
  });

  const selected = selectedDate ? heatmap.days.find((d) => d.date === selectedDate) : null;

  return (
    <Card
      mode="contained"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Activity</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              {heatmap.totalWorkouts} training days
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {(heatmap.totalVolumeKg / 1000).toFixed(1)}t volume
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: CELL_GAP }}>
          {columns.map((column, colIndex) => (
            <View key={colIndex} style={{ gap: CELL_GAP }}>
              {column.map((day, rowIndex) => (
                <Pressable
                  key={rowIndex}
                  disabled={!day}
                  onPress={() => day && setSelectedDate(day.date === selectedDate ? null : day.date)}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: day ? levelColor(day.level, colors.accent, colors.surfacePressed) : 'transparent',
                      borderColor: day?.date === selectedDate ? colors.textPrimary : 'transparent',
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footerRow}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            {selected
              ? `${formatDate(selected.date)} · ${selected.completedSets} sets · ${Math.round(selected.volumeKg)}kg`
              : 'Tap a day for details'}
          </Text>
          <View style={styles.legendRow}>
            <Text style={[typography.micro, { color: colors.textMuted }]}>Less</Text>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <View
                key={level}
                style={[styles.legendCell, { backgroundColor: levelColor(level, colors.accent, colors.surfacePressed) }]}
              />
            ))}
            <Text style={[typography.micro, { color: colors.textMuted }]}>More</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

function levelColor(level: 0 | 1 | 2 | 3 | 4, accent: string, empty: string): string {
  switch (level) {
    case 0:
      return empty;
    case 1:
      return `${accent}40`;
    case 2:
      return `${accent}75`;
    case 3:
      return `${accent}B0`;
    case 4:
      return accent;
  }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendCell: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
});
