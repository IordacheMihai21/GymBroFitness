import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { computePreWorkoutStatus, type PreWorkoutLog } from '@/domain/workouts/preRoutine';
import { useTheme } from '@/theme';

type PreFuelCardProps = {
  log: PreWorkoutLog;
  onPress: () => void;
};

export function PreFuelCard({ log, onPress }: PreFuelCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const status = computePreWorkoutStatus(log);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surfaceRaised,
          borderRadius: radius.lg,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={{ padding: spacing.md, gap: 4 }}>
        <View style={styles.row}>
          <Ionicons name="flash" size={14} color={colors.warning} />
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            Pre-Workout: {log.doseMg}mg {log.substance}
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            {' '}
            (Taken {status.minutesSinceTaken}m ago)
          </Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {status.atPeak
              ? 'At peak effect'
              : `Peak effect in: ~${status.minutesToPeak} min`}
            {'  ·  '}Carbs: {log.carbsLoadedG}g loaded
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.textMuted}
            style={{ marginLeft: 'auto' }}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
