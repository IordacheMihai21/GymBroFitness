import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { durations, easeOutExpo, STAGGER_MS } from './motion';

type RevealProps = PropsWithChildren<{
  index?: number;
  style?: StyleProp<ViewStyle>;
}>;

/** Reveal anyway after this long, in case the screen never reports focus. */
const FALLBACK_MS = 1200;

/**
 * Staggered entrance (anime.js `stagger`) for the sections of a screen.
 *
 * Layout `entering` animations are not used here on purpose: tab screens can
 * mount while hidden, and an entering animation that runs off-screen leaves
 * nothing to see when the tab is opened. This waits for the screen to gain
 * focus, plays once, and never hides content again after that.
 */
export function Reveal({ index = 0, style, children }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const played = useRef(reduceMotion);

  const play = useCallback(() => {
    if (played.current) return;
    played.current = true;
    progress.value = withDelay(
      Math.min(index, 8) * STAGGER_MS,
      withTiming(1, { duration: durations.slow, easing: easeOutExpo }),
    );
  }, [index, progress]);

  useFocusEffect(play);

  useEffect(() => {
    const timeout = setTimeout(play, FALLBACK_MS);
    return () => clearTimeout(timeout);
  }, [play]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
