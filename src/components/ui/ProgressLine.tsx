import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { durations, easeOutExpo, snappySpring } from './motion';

type ProgressLineProps = {
  /** 0 to 1. */
  progress: number;
  color?: ColorValue;
  trackColor?: ColorValue;
  height?: number;
  /** Springs instead of easing; used where progress jumps in steps, like completed sets. */
  spring?: boolean;
};

/** Thin progress bar whose fill glides to the new value instead of jumping. */
export function ProgressLine({
  progress,
  color,
  trackColor,
  height = 3,
  spring = false,
}: ProgressLineProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const value = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    if (reduceMotion) {
      value.value = clamped;
    } else if (spring) {
      value.value = withSpring(clamped, snappySpring);
    } else {
      value.value = withTiming(clamped, { duration: durations.slow, easing: easeOutExpo });
    }
  }, [clamped, reduceMotion, spring, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height, backgroundColor: trackColor ?? colors.surfaceRaised },
      ]}
    >
      <Animated.View
        style={[
          { height, borderRadius: height, backgroundColor: color ?? colors.accent },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
});
