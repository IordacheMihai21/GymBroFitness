import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type PillProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
  /** Trailing glyph, e.g. a chevron for pills that open a menu. */
  trailingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  accessibilityLabel?: string;
};

/** Filter or selector pill. The active one inverts to the primary text color. */
export function Pill({
  label,
  active = false,
  onPress,
  trailingIcon,
  accessibilityLabel,
}: PillProps) {
  const { colors, radius, typography } = useTheme();
  const foreground = active ? colors.textInverse : colors.textSecondary;

  return (
    <PressableScale
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.pill,
        {
          borderRadius: radius.pill,
          backgroundColor: active ? colors.textPrimary : colors.surface,
        },
      ]}
    >
      <Text style={[typography.captionBold, { color: foreground }]}>{label}</Text>
      {trailingIcon ? (
        <MaterialCommunityIcons name={trailingIcon} size={16} color={foreground} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
