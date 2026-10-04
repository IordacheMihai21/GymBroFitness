import { useColorScheme } from 'react-native';

import {
  darkColors,
  elevation,
  fonts,
  lightColors,
  MIN_TOUCH_TARGET,
  radius,
  SemanticColors,
  spacing,
  typography,
} from './tokens';

export type Theme = {
  colors: SemanticColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  isDark: boolean;
};

/** GymBroFitness ships dark-first; a settings toggle can override this later. */
const FORCE_DARK = true;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = FORCE_DARK || scheme === 'dark';
  return {
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    elevation,
    isDark,
  };
}

/**
 * Paper's MD3 TextInput derives its corner radius straight from `roundness`,
 * which is tuned for buttons (5x). Pass this as `theme` on inputs so they use
 * the same radius as other controls.
 */
export const inputTheme = { roundness: radius.md } as const;

export { MIN_TOUCH_TARGET, spacing, radius, typography, elevation, fonts };
export type { SemanticColors };
