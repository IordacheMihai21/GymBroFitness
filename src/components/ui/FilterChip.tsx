import { Pressable, StyleSheet, Text } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.accent : colors.surfaceRaised,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text
        style={[
          typography.captionBold,
          { color: active ? colors.onAccent : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
