import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Snackbar } from 'react-native-paper';

import { useTheme } from '@/theme';

type RestTimerProps = {
  secondsRemaining: number;
  onDismiss: () => void;
  bottomOffset: number;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({ secondsRemaining, onDismiss, bottomOffset }: RestTimerProps) {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState(secondsRemaining);

  useEffect(() => {
    if (remaining <= 0) {
      const timeout = setTimeout(onDismiss, 800);
      return () => clearTimeout(timeout);
    }
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onDismiss]);

  return (
    <Portal>
      <Snackbar
        visible
        onDismiss={onDismiss}
        duration={24 * 60 * 60 * 1000}
        action={{ label: 'Skip', onPress: onDismiss, textColor: colors.accent }}
        style={[
          styles.snackbar,
          {
            marginBottom: bottomOffset,
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
          },
        ]}
        theme={{
          colors: {
            inverseOnSurface: colors.textPrimary,
            inversePrimary: colors.accent,
            inverseSurface: colors.surfaceRaised,
          },
        }}
      >
        {remaining > 0 ? `Resting · ${formatTime(remaining)}` : 'Rest done'}
      </Snackbar>
    </Portal>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
