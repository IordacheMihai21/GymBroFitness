import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card } from 'react-native-paper';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useTheme } from '@/theme';

type StreakCardProps = {
  streakDays: number;
};

export function StreakCard({ streakDays }: StreakCardProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Card mode="outlined" style={{ borderColor: colors.accent, overflow: 'hidden' }}>
      <LinearGradient
        colors={[colors.accentSoft, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <Card.Content style={[styles.row, { gap: spacing.md }]}>
        <Avatar.Icon icon="fire" size={44} style={{ backgroundColor: colors.accent }} color={colors.onAccent} />
        <View style={{ flex: 1 }}>
          <View style={styles.numberRow}>
            <AnimatedNumber
              value={streakDays}
              style={[typography.display, { color: colors.textPrimary }]}
            />
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              {' '}
              day{streakDays === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Current streak — keep it alive
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
