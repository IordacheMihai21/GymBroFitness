import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LibraryExercise } from '@/domain/exercises/library';
import { useTheme } from '@/theme';

type ExerciseListItemProps = {
  exercise: LibraryExercise;
  onPress?: () => void;
};

export function ExerciseListItem({ exercise, onPress }: ExerciseListItemProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const thumbnail = exercise.images[0];
  const muscleLabel = exercise.primaryMuscles.join(', ') || 'Other';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surfaceRaised,
          borderRadius: radius.lg,
          borderColor: colors.border,
          padding: spacing.sm,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.thumbnailWrap, { backgroundColor: colors.surfacePressed }]}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {exercise.equipmentLabel} · {muscleLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnailWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
