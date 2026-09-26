import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type RevealProps = PropsWithChildren<{
  index?: number;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Stable layout wrapper for list-like content. Tab screens are mounted before
 * they become visible; entrance animations could therefore remain at their
 * initial opacity and render an apparently empty screen on Android.
 */
export function Reveal({ index = 0, style, children }: RevealProps) {
  void index;
  return <View style={style}>{children}</View>;
}
