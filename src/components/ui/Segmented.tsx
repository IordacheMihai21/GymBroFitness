import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { snappySpring } from './motion';

type SegmentedProps<T extends string> = {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
};

type Frame = { x: number; width: number };

/**
 * Pill switch for two to five mutually exclusive views of the same data. The
 * highlight slides between options on a spring (the "animated tabs" pattern),
 * so the change of view reads as one motion instead of two repaints.
 */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const { colors, radius, typography } = useTheme();
  const reduceMotion = useReducedMotion();
  const [frames, setFrames] = useState<Record<string, Frame>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const active = frames[value];

  useEffect(() => {
    if (!active) return;
    if (reduceMotion || width.value === 0) {
      x.value = active.x;
      width.value = active.width;
    } else {
      x.value = withSpring(active.x, snappySpring);
      width.value = withSpring(active.width, snappySpring);
    }
  }, [active, reduceMotion, width, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.surface, borderRadius: radius.pill }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          { backgroundColor: colors.surfacePressed, borderRadius: radius.pill },
          indicatorStyle,
        ]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onLayout={(event) => {
              const { x: itemX, width: itemWidth } = event.nativeEvent.layout;
              setFrames((current) =>
                current[option.value]?.x === itemX && current[option.value]?.width === itemWidth
                  ? current
                  : { ...current, [option.value]: { x: itemX, width: itemWidth } },
              );
            }}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.item}
          >
            <Text
              style={[
                typography.captionBold,
                { color: selected ? colors.textPrimary : colors.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
  },
  item: {
    minHeight: 34,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
