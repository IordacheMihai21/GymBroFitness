import { Easing } from 'react-native-reanimated';

/**
 * Shared motion vocabulary. One easing curve and one spring for the whole app,
 * so every moving thing feels like it belongs to the same instrument.
 *
 * `easeOutExpo` is anime.js's signature curve: fast start, long soft landing.
 */
export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);

/** Firm, barely-overshooting spring for indicators and presses. */
export const snappySpring = { damping: 20, stiffness: 260, mass: 0.7 } as const;

/** A little more give, for the set-complete check pop. */
export const popSpring = { damping: 11, stiffness: 320, mass: 0.6 } as const;

export const durations = {
  fast: 160,
  base: 280,
  slow: 520,
  count: 800,
} as const;

/** Delay between items in a staggered entrance. */
export const STAGGER_MS = 45;
