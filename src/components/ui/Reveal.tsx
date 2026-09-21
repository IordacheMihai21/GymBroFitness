import { MotiView } from 'moti';
import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

type RevealProps = PropsWithChildren<{
  index?: number;
  style?: StyleProp<ViewStyle>;
}>;

/** Staggered fade+slide entrance for list-like content. */
export function Reveal({ index = 0, style, children }: RevealProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <View style={style}>{children}</View>;

  return (
    <MotiView
      style={style}
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 16, mass: 0.7, delay: index * 70 }}
    >
      {children}
    </MotiView>
  );
}
