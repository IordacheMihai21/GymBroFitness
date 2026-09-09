import { useColorScheme } from 'react-native';

import {
  darkColors,
  elevation,
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

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    elevation,
    isDark,
  };
}

export { MIN_TOUCH_TARGET, spacing, radius, typography, elevation };
export type { SemanticColors };
