'use no memo';

import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  fullWidth?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({ label, onPress, fullWidth }: PrimaryButtonProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 16, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[
        styles.base,
        animatedStyle,
        {
          backgroundColor: colors.accent,
          borderRadius: radius.pill,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.x3l,
          minHeight: MIN_TOUCH_TARGET,
          alignSelf: fullWidth ? 'stretch' : 'center',
          shadowColor: colors.accent,
        },
      ]}
    >
      <Text style={[typography.subheading, { color: colors.onAccent }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
