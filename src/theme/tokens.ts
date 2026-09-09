/**
 * Design tokens. Semantic colors resolve through useTheme() so every component
 * supports light and dark structurally. Avoid importing palette directly in UI.
 */

export const palette = {
  // Neutral scale
  gray0: '#FFFFFF',
  gray50: '#F6F7F9',
  gray100: '#ECEEF1',
  gray200: '#DDE1E6',
  gray300: '#C2C8D0',
  gray400: '#9AA2AE',
  gray500: '#6E7681',
  gray600: '#4B525C',
  gray700: '#343A43',
  gray800: '#22272E',
  gray850: '#1B2027',
  gray900: '#14181D',
  gray950: '#0D1014',

  // Brand — deep teal-green, deliberately not "AI purple"
  brand300: '#5ED4B0',
  brand400: '#2FBF94',
  brand500: '#17A87C',
  brand600: '#0F8A66',
  brand700: '#0B6B50',

  amber400: '#F5B942',
  amber600: '#B37E12',
  red400: '#F0655A',
  red600: '#C93D33',
  blue400: '#4D9DE0',
  blue600: '#2C6FAF',
} as const;

export type SemanticColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfacePressed: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
};

export const lightColors: SemanticColors = {
  background: palette.gray50,
  surface: palette.gray0,
  surfaceRaised: palette.gray0,
  surfacePressed: palette.gray100,
  border: palette.gray200,
  borderStrong: palette.gray300,
  textPrimary: palette.gray900,
  textSecondary: palette.gray600,
  textMuted: palette.gray400,
  textInverse: palette.gray0,
  accent: palette.brand600,
  accentPressed: palette.brand700,
  onAccent: palette.gray0,
  accentSoft: '#E2F5EE',
  success: palette.brand600,
  successSoft: '#E2F5EE',
  warning: palette.amber600,
  warningSoft: '#FBF0D9',
  danger: palette.red600,
  dangerSoft: '#FBE4E2',
  info: palette.blue600,
  infoSoft: '#E3EEF8',
};

export const darkColors: SemanticColors = {
  background: palette.gray950,
  surface: palette.gray900,
  surfaceRaised: palette.gray850,
  surfacePressed: palette.gray800,
  border: palette.gray800,
  borderStrong: palette.gray700,
  textPrimary: palette.gray50,
  textSecondary: palette.gray300,
  textMuted: palette.gray500,
  textInverse: palette.gray900,
  accent: palette.brand400,
  accentPressed: palette.brand300,
  onAccent: palette.gray950,
  accentSoft: '#12332A',
  success: palette.brand400,
  successSoft: '#12332A',
  warning: palette.amber400,
  warningSoft: '#332A12',
  danger: palette.red400,
  dangerSoft: '#361A18',
  info: palette.blue400,
  infoSoft: '#132638',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3l: 32,
  x4l: 40,
  x5l: 56,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600' as const },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  captionBold: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
  numeric: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
} as const;

export type TypographyVariant = keyof typeof typography;

export const elevation = {
  none: {},
  low: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
} as const;

/** Minimum touch target size per accessibility guidance. */
export const MIN_TOUCH_TARGET = 44;
