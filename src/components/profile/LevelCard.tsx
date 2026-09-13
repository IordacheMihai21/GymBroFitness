import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, ProgressBar } from 'react-native-paper';

import type { LevelProgress } from '@/domain/workouts/gamification';
import { useTheme, type Theme } from '@/theme';

type LevelCardProps = {
  level: LevelProgress;
  totalWorkouts: number;
};

function tierBadge(tierName: string, colors: Theme['colors']) {
  switch (tierName) {
    case 'Rookie':
      return { icon: 'account-outline', color: colors.textMuted };
    case 'Grinder':
      return { icon: 'arm-flex', color: colors.success };
    case 'Beast':
      return { icon: 'paw', color: colors.warning };
    case 'Titan':
      return { icon: 'shield-star', color: colors.danger };
    default:
      return { icon: 'crown', color: colors.accent };
  }
}

export function LevelCard({ level, totalWorkouts }: LevelCardProps) {
  const { colors, spacing, typography } = useTheme();
  const { tier, nextTier, progress } = level;
  const badge = tierBadge(tier.name, colors);

  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Avatar.Icon
              icon={badge.icon}
              size={36}
              style={{ backgroundColor: `${badge.color}26` }}
              color={badge.color}
            />
            <Text style={[typography.heading, { color: colors.textPrimary }]}>{tier.name}</Text>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {totalWorkouts} workouts
          </Text>
        </View>

        <ProgressBar progress={progress} color={badge.color} style={styles.track} />

        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {nextTier
            ? `${nextTier.minWorkouts - totalWorkouts} workouts to ${nextTier.name}`
            : 'Max level reached'}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 8, borderRadius: 4 },
});
