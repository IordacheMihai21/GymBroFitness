/**
 * Design tokens. Semantic colors resolve through useTheme() so every component
 * supports light and dark structurally. Avoid importing palette directly in UI.
 */

export const palette = {
  // Neutral scale — black-first, with only a quiet cool edge in the deep surfaces.
  gray0: '#FFFFFF',
  gray50: '#F5F7FB',
  gray100: '#E9EDF5',
  gray200: '#D7DEEA',
  gray300: '#B9C3D6',
  gray400: '#8B96AD',
  gray500: '#626E88',
  gray600: '#3F4757',
  gray700: '#252B36',
  gray800: '#141821',
  gray850: '#0C1018',
  gray900: '#070A10',
  gray950: '#030509',

  // Brand — electric blue, deliberately not purple or blue-purple.
  brand300: '#8AB9FF',
  brand400: '#4A95FF',
  brand500: '#1F73FF',
  brand600: '#0F58D8',
  brand700: '#0A3E9F',

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
  musclePrimary: string;
  muscleSecondary: string;
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
  textMuted: palette.gray500,
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
  musclePrimary: palette.red600,
  muscleSecondary: '#D99A95',
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
  textMuted: palette.gray400,
  textInverse: palette.gray900,
  accent: palette.brand400,
  accentPressed: palette.brand300,
  onAccent: palette.gray950,
  accentSoft: '#071A3A',
  success: palette.green400,
  successSoft: '#12332A',
  warning: palette.amber400,
  warningSoft: '#332A12',
  danger: palette.red400,
  dangerSoft: '#361A18',
  musclePrimary: palette.red400,
  muscleSecondary: '#7A3935',
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

/** Controls are 10, surfaces 16. Pills are only for tiny status tags. */
export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

/**
 * Family names registered by `useFonts` in the root layout. Each weight is its
 * own family on Android, so typography roles set a family and never a
 * fontWeight (a weight on top of a custom family triggers synthetic bolding).
 */
export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  mono: 'GeistMono_500Medium',
  monoSemibold: 'GeistMono_600SemiBold',
} as const;

export const typography = {
  jumbo: { fontFamily: fonts.monoSemibold, fontSize: 44, lineHeight: 50, letterSpacing: -1.2 },
  display: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionBold: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  numeric: { fontFamily: fonts.mono, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const elevation = {
  none: {},
  low: {},
  medium: {},
} as const;

/** Minimum touch target size per accessibility guidance. */
export const MIN_TOUCH_TARGET = 48;
