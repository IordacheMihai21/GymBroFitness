import { configureFonts, MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { fonts } from './tokens';
import { useTheme } from './index';

const regular = { fontFamily: fonts.regular, fontWeight: 'normal' as const };
const medium = { fontFamily: fonts.medium, fontWeight: 'normal' as const };
const semibold = { fontFamily: fonts.semibold, fontWeight: 'normal' as const };

const paperFonts = configureFonts({
  config: {
    displayLarge: semibold,
    displayMedium: semibold,
    displaySmall: semibold,
    headlineLarge: semibold,
    headlineMedium: semibold,
    headlineSmall: semibold,
    titleLarge: semibold,
    titleMedium: medium,
    titleSmall: medium,
    labelLarge: medium,
    labelMedium: medium,
    labelSmall: medium,
    bodyLarge: regular,
    bodyMedium: regular,
    bodySmall: regular,
  },
});

/** Maps our own semantic tokens onto react-native-paper's MD3 theme contract. */
export function usePaperTheme(): MD3Theme {
  const { colors, radius, isDark } = useTheme();
  const base = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    fonts: paperFonts,
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
      surface: colors.surface,
      onSurface: colors.textPrimary,
      surfaceVariant: colors.surfaceRaised,
      onSurfaceVariant: colors.textSecondary,
      surfaceDisabled: colors.surfacePressed,
      onSurfaceDisabled: colors.textMuted,
      outline: colors.borderStrong,
      outlineVariant: colors.border,
      error: colors.danger,
      onError: colors.onAccent,
      errorContainer: colors.dangerSoft,
      elevation: {
        level0: 'transparent',
        level1: colors.surface,
        level2: colors.surfaceRaised,
        level3: colors.surfaceRaised,
        level4: colors.surfacePressed,
        level5: colors.surfacePressed,
      },
    },
  };
}
