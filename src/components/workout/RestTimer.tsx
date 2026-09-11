import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type RestTimerProps = {
  secondsRemaining: number;
  onDismiss: () => void;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({ secondsRemaining, onDismiss }: RestTimerProps) {
  const { colors, radius, spacing, typography } = useTheme();
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
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.accent,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          shadowColor: colors.accent,
        },
      ]}
    >
      <Text style={[typography.bodyBold, { color: colors.onAccent }]}>
        {remaining > 0 ? `Resting · ${formatTime(remaining)}` : 'Rest done'}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Text style={[typography.captionBold, { color: colors.onAccent, opacity: 0.85 }]}>
          Skip
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
