import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { snappySpring, STAGGER_MS } from '@/components/ui/motion';
import { useTheme } from '@/theme';

export type BarDatum = {
  key: string;
  value: number;
  label: string;
  /** Shown above the chart when the bar is selected. */
  detail: string;
  sessions?: number;
};

type BarSeriesProps = {
  data: BarDatum[];
  height?: number;
  /** Called with the selected bar's detail, or null when cleared. */
  onSelect?: (datum: BarDatum | null) => void;
};

/**
 * Vertical bars that grow from the baseline in a stagger. Tapping a bar
 * selects it (accent) and reports its detail; the latest bar is selected by
 * default so the tile always says something concrete.
 */
export function BarSeries({ data, height = 72, onSelect }: BarSeriesProps) {
  const { colors, typography } = useTheme();
  const max = Math.max(1, ...data.map((item) => item.value));
  const [selected, setSelected] = useState(data.length - 1);

  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.row, { height }]}>
        {data.map((item, index) => (
          <Bar
            key={item.key}
            index={index}
            ratio={item.value / max}
            height={height}
            active={index === selected}
            empty={item.value === 0}
            onPress={() => {
              void Haptics.selectionAsync();
              setSelected(index);
              onSelect?.(item);
            }}
            accessibilityLabel={`${item.label}: ${item.detail}`}
          />
        ))}
      </View>
      <View style={styles.row}>
        {data.map((item, index) => (
          <Text
            key={item.key}
            style={[
              typography.micro,
              styles.label,
              { color: index === selected ? colors.textPrimary : colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bar({
  index,
  ratio,
  height,
  active,
  empty,
  onPress,
  accessibilityLabel,
}: {
  index: number;
  ratio: number;
  height: number;
  active: boolean;
  empty: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const target = empty ? 4 : Math.max(6, ratio * height);
  const barHeight = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    barHeight.value = reduceMotion
      ? target
      : withDelay(index * STAGGER_MS, withSpring(target, snappySpring));
  }, [barHeight, index, reduceMotion, target]);

  const style = useAnimatedStyle(() => ({ height: barHeight.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      style={styles.barSlot}
      hitSlop={4}
    >
      <Animated.View
        style={[
          styles.bar,
          {
            backgroundColor: active
              ? colors.accent
              : empty
                ? colors.surfacePressed
                : colors.borderStrong,
          },
          style,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
});
