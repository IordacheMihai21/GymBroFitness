import { Text, View } from 'react-native';

import { AnimatedNumber } from './AnimatedNumber';

import { useTheme } from '@/theme';

type StatProps = {
  value: string;
  label: string;
  /** Use the accent color for the one number that matters most on screen. */
  emphasis?: boolean;
};

/** A value with a quiet label underneath; numbers use the mono face so columns align. */
export function Stat({ value, label, emphasis = false }: StatProps) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AnimatedNumber
        value={value}
        style={[
          /\d/.test(value) ? typography.numeric : typography.heading,
          { color: emphasis ? colors.accent : colors.textPrimary },
        ]}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
