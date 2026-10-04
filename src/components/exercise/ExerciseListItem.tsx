import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { preferredLibraryImages, type LibraryExercise } from '@/domain/exercises/library';
import { useTheme } from '@/theme';

type ExerciseListItemProps = {
  exercise: LibraryExercise;
  onPress?: () => void;
  selected?: boolean;
};

export function ExerciseListItem({ exercise, onPress, selected = false }: ExerciseListItemProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const thumbnail = preferredLibraryImages(exercise)[0];
  const muscleLabel =
    exercise.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ') || 'Other';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${exercise.name}, ${muscleLabel}, ${exercise.equipmentLabel}`}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: selected ? colors.accentSoft : pressed ? colors.surface : 'transparent',
        },
      ]}
    >
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={[styles.thumbnail, { borderRadius: radius.md, backgroundColor: colors.surface }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            styles.thumbnail,
            styles.placeholder,
            { borderRadius: radius.md, backgroundColor: colors.surface },
          ]}
        >
          <MaterialCommunityIcons name="dumbbell" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={[styles.text, { borderBottomColor: colors.border }]}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {muscleLabel}, {exercise.equipmentLabel}
        </Text>
      </View>
      {selected ? <MaterialCommunityIcons name="check" size={20} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  thumbnail: {
    width: 48,
    height: 48,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
