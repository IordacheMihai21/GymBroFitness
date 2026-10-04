import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type TileProps = {
  /** Small label naming what the tile measures. */
  title?: string;
  /** Right side of the title row (a value, a delta). */
  aside?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Soft accent wash from the top-left corner, for the one tile that leads a screen. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Bento tile: a raised surface for one metric or one action. Pressable tiles
 * sink under the thumb and carry a chevron so they read as doors, not posters.
 */
export function Tile({
  title,
  aside,
  onPress,
  accessibilityLabel,
  glow = false,
  style,
  containerStyle,
  children,
}: TileProps) {
  const { colors, radius, spacing, typography } = useTheme();

  const body = (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {glow ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${colors.accent}2E`, `${colors.accent}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.9 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
        />
      ) : null}
      {title || aside || onPress ? (
        <View style={styles.header}>
          {title ? (
            <Text
              style={[typography.captionBold, { color: colors.textSecondary, flex: 1 }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {aside}
          {onPress ? (
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  if (!onPress) return <View style={containerStyle}>{body}</View>;

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.975}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      containerStyle={containerStyle}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
});
