import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { snappySpring } from './motion';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Layout style for the touch target itself (flex, alignSelf, margins). */
  containerStyle?: StyleProp<ViewStyle>;
  /** How far the surface sinks while held. Rows use a subtle 0.98, small controls 0.94. */
  pressedScale?: number;
  children: ReactNode;
};

/**
 * Tactile press: the surface sinks slightly under the thumb and springs back.
 * Replaces the flat opacity flash, so tapping a row or pill feels physical.
 */
export function PressableScale({
  style,
  containerStyle,
  pressedScale = 0.98,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, snappySpring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, snappySpring);
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
