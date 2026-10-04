import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

/**
 * Placeholder block with a slow shimmer pulse, shaped like the content that is
 * loading. Used instead of spinners so the layout does not jump on arrival.
 */
export function Skeleton({ width = '100%', height = 14, radius }: SkeletonProps) {
  const { colors, radius: radii } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.4 }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius ?? radii.sm, backgroundColor: colors.surfaceRaised },
        style,
      ]}
    />
  );
}

/** A stack of skeleton rows approximating a workout screen while it restores. */
export function WorkoutSkeleton() {
  const { spacing } = useTheme();

  return (
    <View style={[styles.stack, { gap: spacing.lg }]}>
      <View style={{ gap: spacing.sm }}>
        <Skeleton width="55%" height={28} />
        <Skeleton width="35%" height={12} />
      </View>
      <Skeleton height={3} />
      <View style={styles.row}>
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} width={96} height={36} radius={999} />
        ))}
      </View>
      <Skeleton width="70%" height={22} />
      {[0, 1, 2].map((item) => (
        <View key={item} style={{ gap: spacing.sm }}>
          <Skeleton width="40%" height={12} />
          <View style={styles.row}>
            <Skeleton width="30%" height={48} />
            <Skeleton width="30%" height={48} />
            <Skeleton width="30%" height={48} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
