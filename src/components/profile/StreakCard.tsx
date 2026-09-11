import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useTheme } from '@/theme';

type StreakCardProps = {
  streakDays: number;
};

export function StreakCard({ streakDays }: StreakCardProps) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.xl,
          borderColor: colors.accent,
          shadowColor: colors.accent,
        },
      ]}
    >
      <LinearGradient
        colors={[colors.accentSoft, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.row, { padding: spacing.lg, gap: spacing.md }]}>
        <View style={[styles.iconBadge, { backgroundColor: colors.accent }]}>
          <Ionicons name="flame" size={20} color={colors.onAccent} />
        </View>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
