import { StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { bodySlugsForMuscle } from '@/domain/muscles/muscleMap';
import type { MuscleFreshness, MuscleFreshnessStatus } from '@/domain/workouts/dashboard';
import { useTheme, type SemanticColors } from '@/theme';

function statusColor(status: MuscleFreshnessStatus, colors: SemanticColors): string {
  if (status === 'fresh') return colors.accent;
  if (status === 'recovering') return `${colors.accent}55`;
  return colors.warning;
}

/**
 * Front and back silhouettes coloured by how recently each muscle was trained:
 * blue is ready, faint blue is still recovering, amber was hit in the last day.
 */
export function RecoveryMap({ freshness }: { freshness: MuscleFreshness[] }) {
  const { colors, spacing, typography } = useTheme();
  const data: ExtendedBodyPart[] = freshness.flatMap((item) =>
    bodySlugsForMuscle(item.muscle).map((slug) => ({
      slug,
      styles: {
        fill: statusColor(item.status, colors),
        stroke: colors.background,
        strokeWidth: 0.4,
      },
    })),
  );
  const trained = freshness.filter((item) => item.hoursSince != null);
  const ready = freshness.filter((item) => item.status === 'fresh');
  const sore = freshness.filter((item) => item.status !== 'fresh');

  return (
    <View style={styles.row}>
      <View style={styles.bodies} importantForAccessibility="no-hide-descendants">
        <Body
          data={data}
          side="front"
          scale={0.42}
          border="none"
          defaultFill={colors.surfacePressed}
        />
        <Body
          data={data}
          side="back"
          scale={0.42}
          border="none"
          defaultFill={colors.surfacePressed}
        />
      </View>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text
            style={[typography.jumbo, { color: colors.textPrimary, fontSize: 32, lineHeight: 36 }]}
          >
            {ready.length}
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {' '}
              / {freshness.length}
            </Text>
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>muscles ready</Text>
        </View>
        {trained.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Everything is fresh. Finish a workout to see what needs rest.
          </Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <Legend
              color={colors.warning}
              label="Last 24 h"
              items={sore.filter((i) => i.status === 'worked')}
            />
            <Legend
              color={`${colors.accent}55`}
              label="Recovering"
              items={sore.filter((i) => i.status === 'recovering')}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function Legend({
  color,
  label,
  items,
}: {
  color: string;
  label: string;
  items: MuscleFreshness[];
}) {
  const { colors, typography } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text
        style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
        numberOfLines={2}
      >
        <Text style={{ color: colors.textPrimary }}>{label}: </Text>
        {items.map((item) => MUSCLE_LABELS[item.muscle]).join(', ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bodies: {
    flexDirection: 'row',
    marginVertical: -8,
    marginLeft: -12,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginTop: 5,
  },
});
