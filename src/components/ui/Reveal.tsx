import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type RevealProps = PropsWithChildren<{
  index?: number;
  style?: StyleProp<ViewStyle>;
}>;

/** Staggered fade+slide entrance for list-like content. */
export function Reveal({ index = 0, style, children }: RevealProps) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(index * 70).springify().damping(16).mass(0.7)}
    >
      {children}
    </Animated.View>
  );
}
