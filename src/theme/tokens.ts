/**
 * Design tokens. Semantic colors resolve through useTheme() so every component
 * supports light and dark structurally. Avoid importing palette directly in UI.
 */

export const palette = {
  // Neutral scale — cool, blue-tinted (midnight), not flat gray
  gray0: '#FFFFFF',
  gray50: '#F5F7FB',
  gray100: '#E9EDF5',
  gray200: '#D7DEEA',
  gray300: '#B9C3D6',
  gray400: '#8B96AD',
  gray500: '#626E88',
  gray600: '#454F66',
  gray700: '#2E3549',
  gray800: '#1C2233',
  gray850: '#151A28',
  gray900: '#0F1320',
  gray950: '#090C15',

  // Brand — electric blue, deliberately not "AI purple"
  brand300: '#7DA2FF',
  brand400: '#4C7EFF',
  brand500: '#2F5FEF',
  brand600: '#2449C4',
  brand700: '#1B3796',

  amber400: '#F5B942',
  amber600: '#B37E12',
  red400: '#F0655A',
  red600: '#C93D33',
  blue400: '#63B3F0',
  blue600: '#2C7FC7',
  green400: '#3ECF8E',
  green600: '#1F9D68',
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
  brandGradientStart: string;
  brandGradientEnd: string;
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
  accentSoft: '#E5EBFC',
  success: palette.green600,
  successSoft: '#E1F7EC',
  warning: palette.amber600,
  warningSoft: '#FBF0D9',
  danger: palette.red600,
  dangerSoft: '#FBE4E2',
  info: palette.blue600,
  infoSoft: '#E3EEF8',
  brandGradientStart: palette.brand500,
  brandGradientEnd: palette.brand700,
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
  accentSoft: '#16224A',
  success: palette.green400,
  successSoft: '#12332A',
  warning: palette.amber400,
  warningSoft: '#332A12',
  danger: palette.red400,
  dangerSoft: '#361A18',
  info: palette.blue400,
  infoSoft: '#132638',
  brandGradientStart: palette.brand400,
  brandGradientEnd: palette.brand700,
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
