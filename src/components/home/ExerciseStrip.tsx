import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { exerciseThumbnailUrl } from '@/domain/exercises/library';
import { useTheme } from '@/theme';
import type { Exercise } from '@/types';

export type StripItem = {
  key: string;
  exercise: Exercise;
  /** "3 × 6-10" for a plan, "2/3 sets" for a workout in progress. */
  detail: string;
  done?: boolean;
};

type ExerciseStripProps = {
  items: StripItem[];
  onPressItem?: (exercise: Exercise) => void;
};

/** Horizontal run of exercise cards with their demo image: the session at a glance. */
export function ExerciseStrip({ items, onPressItem }: ExerciseStripProps) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      style={{ marginHorizontal: -spacing.lg }}
    >
      {items.map((item, index) => {
        const uri = exerciseThumbnailUrl(item.exercise);
        return (
          <PressableScale
            key={item.key}
            onPress={onPressItem ? () => onPressItem(item.exercise) : undefined}
            pressedScale={0.96}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}. ${item.exercise.name}, ${item.detail}`}
            style={[styles.card, { width: 116, gap: spacing.sm }]}
          >
            <View
              style={[
                styles.imageWrap,
                { borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
              ]}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={180}
                />
              ) : (
                <MaterialCommunityIcons name="dumbbell" size={28} color={colors.textMuted} />
              )}
              <View
                style={[
                  styles.order,
                  { backgroundColor: colors.background, borderRadius: radius.sm },
                ]}
              >
                <Text style={[typography.micro, { color: colors.textPrimary }]}>{index + 1}</Text>
              </View>
              {item.done ? (
                <View style={[styles.doneBadge, { backgroundColor: colors.success }]}>
                  <MaterialCommunityIcons name="check" size={14} color={colors.background} />
                </View>
              ) : null}
            </View>
            <View style={{ gap: 2 }}>
              <Text
                style={[typography.captionBold, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {item.exercise.name}
              </Text>
              <Text style={[typography.micro, { color: colors.textMuted }]}>{item.detail}</Text>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {},
  imageWrap: {
    width: 116,
    height: 116,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  order: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
