import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { LevelProgress } from '@/domain/workouts/gamification';
import { useTheme } from '@/theme';

type LevelCardProps = {
  level: LevelProgress;
  totalWorkouts: number;
};

export function LevelCard({ level, totalWorkouts }: LevelCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const { tier, nextTier, progress } = level;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, borderColor: colors.border },
      ]}
    >
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={[styles.iconBadge, { backgroundColor: colors.surfacePressed }]}>
              <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
            </View>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>{tier.name}</Text>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {totalWorkouts} workouts
          </Text>
        </View>

        <View style={[styles.track, { backgroundColor: colors.surfacePressed, borderRadius: radius.pill }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
              },
            ]}
          />
        </View>

        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {nextTier
            ? `${nextTier.minWorkouts - totalWorkouts} workouts to ${nextTier.name}`
            : 'Max level reached'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 8, overflow: 'hidden' },
  fill: { height: '100%' },
});
