import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { List } from 'react-native-paper';

import type { LibraryExercise } from '@/domain/exercises/library';
import { useTheme } from '@/theme';

type ExerciseListItemProps = {
  exercise: LibraryExercise;
  onPress?: () => void;
  selected?: boolean;
};

export function ExerciseListItem({ exercise, onPress, selected = false }: ExerciseListItemProps) {
  const { colors, radius, typography } = useTheme();
  const thumbnail = exercise.images[0];
  const muscleLabel = exercise.primaryMuscles.join(', ') || 'Other';

  return (
    <List.Item
      onPress={onPress}
      title={exercise.name}
      description={`${exercise.equipmentLabel} · ${muscleLabel}`}
      titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
      descriptionStyle={[typography.caption, { color: colors.textMuted }]}
      titleNumberOfLines={1}
      descriptionNumberOfLines={1}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surfaceRaised,
          borderRadius: radius.lg,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
      left={() =>
        thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={[styles.thumbnail, { borderRadius: radius.md, backgroundColor: colors.surfacePressed }]}
            contentFit="cover"
          />
        ) : (
          <List.Icon icon="dumbbell" color={colors.textMuted} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: {
    width: 56,
    height: 56,
  },
});
