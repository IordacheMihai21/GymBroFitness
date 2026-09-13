import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { useTheme } from './index';

/** Maps our own semantic tokens onto react-native-paper's MD3 theme contract. */
export function usePaperTheme(): MD3Theme {
  const { colors, radius, isDark } = useTheme();
  const base = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    roundness: radius.md / 4, // Paper multiplies roundness by 4 internally
    colors: {
      ...base.colors,
      primary: colors.accent,
      onPrimary: colors.onAccent,
      primaryContainer: colors.accentSoft,
      onPrimaryContainer: colors.textPrimary,
      secondary: colors.accent,
      onSecondary: colors.onAccent,
      secondaryContainer: colors.surfacePressed,
      onSecondaryContainer: colors.textPrimary,
      tertiary: colors.accent,
      onTertiary: colors.onAccent,
      tertiaryContainer: colors.surfacePressed,
      onTertiaryContainer: colors.textPrimary,
      background: colors.background,
      onBackground: colors.textPrimary,
      surface: colors.surfaceRaised,
      onSurface: colors.textPrimary,
      surfaceVariant: colors.surfacePressed,
      onSurfaceVariant: colors.textSecondary,
      surfaceDisabled: colors.surfacePressed,
      onSurfaceDisabled: colors.textMuted,
      outline: colors.border,
      outlineVariant: colors.borderStrong,
      error: colors.danger,
      onError: colors.onAccent,
      errorContainer: colors.dangerSoft,
    },
  };
}
