import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
};

export function AnimatedNumber({ value, decimals = 0, suffix = '', style }: AnimatedNumberProps) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(value.toFixed(decimals));

  useEffect(() => {
    progress.value = withTiming(value, {
      duration: 1100,
      easing: Easing.out(Easing.exp),
    });
  }, [value, progress]);

  useAnimatedReaction(
    () => progress.value,
    (current) => {
      runOnJS(setDisplay)(current.toFixed(decimals));
    },
  );

  return <Text style={style}>{`${display}${suffix}`}</Text>;
}
