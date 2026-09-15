import { PIConfetti } from 'react-native-fast-confetti';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * PR celebration burst — a real package (react-native-fast-confetti, Skia-
 * powered), not hand-built. Swapped in once native rebuilds were unblocked;
 * see docs/PLAN.md for why an earlier version of this was reanimated-only.
 * `onAnimationEnd` maps straight to `onDone` so the caller's unmount timing
 * is unchanged.
 */
export function PrCelebration({ onDone }: { onDone?: () => void }) {
  const { colors } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <PIConfetti fadeOutOnEnd onAnimationEnd={onDone}>
        <PIConfetti.Origin
          blastPosition="center"
          count={90}
          initialSpeed={2.2}
          colors={[colors.accent, colors.success, colors.warning]}
        >
          <PIConfetti.Flake size={8} />
        </PIConfetti.Origin>
      </PIConfetti>
    </View>
  );
}
