import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { List } from 'react-native-paper';

import { exerciseThumbnailUrl } from '@/domain/exercises/library';
import { useTheme } from '@/theme';
import type { Exercise } from '@/types';

/** Demo-photo thumbnail for a catalog exercise row, falling back to a generic icon when no reference image is mapped. */
export function ExerciseThumbnail({ exercise }: { exercise: Exercise }) {
  const { colors, radius } = useTheme();
  const thumbnail = exerciseThumbnailUrl(exercise);

  if (!thumbnail) return <List.Icon icon="dumbbell" color={colors.textMuted} />;

  return (
    <Image
      source={{ uri: thumbnail }}
      style={[
        styles.thumbnail,
        { borderRadius: radius.md, backgroundColor: colors.surfacePressed },
      ]}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 48,
    height: 48,
  },
});
