import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned value; numbers use the mono face, words the body face. */
  value?: string;
  left?: ReactNode;
  onPress?: () => void;
  /** Omit the bottom hairline (last row of a group). */
  last?: boolean;
  accessibilityLabel?: string;
};

/** A plain row on the canvas: the default way to show a list, instead of a card per item. */
export function ListRow({
  title,
  subtitle,
  value,
  left,
  onPress,
  last = false,
  accessibilityLabel,
}: ListRowProps) {
  const { colors, spacing, typography } = useTheme();

  const content = (
    <View
      style={[
        styles.row,
        {
          gap: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {left}
      <View style={styles.text}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={[
            /\d/.test(value) ? typography.numeric : typography.body,
            { color: /\d/.test(value) ? colors.textPrimary : colors.textSecondary },
          ]}
        >
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
