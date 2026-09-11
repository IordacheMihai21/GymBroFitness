import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type CardProps = PropsWithChildren<{
  style?: ViewStyle;
  glow?: boolean;
}>;

export function Card({ children, style, glow }: CardProps) {
  const { colors, radius, spacing, isDark } = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderRadius: radius.xl,
          borderColor: colors.border,
          backgroundColor: isDark ? 'rgba(28, 34, 51, 0.55)' : colors.surfaceRaised,
        },
        glow && {
          shadowColor: colors.accent,
          shadowOpacity: isDark ? 0.35 : 0.15,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        },
        style,
      ]}
    >
      {isDark && (
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View style={{ padding: spacing.lg }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
