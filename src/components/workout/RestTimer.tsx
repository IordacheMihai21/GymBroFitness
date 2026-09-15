import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Portal, ProgressBar } from 'react-native-paper';

import { useTheme } from '@/theme';

type RestTimerProps = {
  secondsRemaining: number;
  initialSeconds: number;
  onChangeSeconds: (seconds: number) => void;
  onDismiss: () => void;
  bottomOffset: number;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({
  secondsRemaining,
  initialSeconds,
  onChangeSeconds,
  onDismiss,
  bottomOffset,
}: RestTimerProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const notifiedRef = useRef(false);
  const isDone = secondsRemaining <= 0;
  const progress =
    initialSeconds > 0 ? 1 - Math.min(1, Math.max(0, secondsRemaining) / initialSeconds) : 1;

  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const timeout = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timeout);
    }

    const id = setInterval(() => {
      onChangeSeconds(Math.max(0, secondsRemaining - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [onChangeSeconds, onDismiss, secondsRemaining]);

  function addThirtySeconds() {
    notifiedRef.current = false;
    onChangeSeconds(Math.max(0, secondsRemaining) + 30);
    Haptics.selectionAsync();
  }

  return (
    <Portal>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.panel,
            {
              bottom: bottomOffset,
              backgroundColor: colors.surfaceRaised,
              borderColor: isDone ? colors.accent : colors.borderStrong,
              borderRadius: radius.lg,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.micro, { color: isDone ? colors.accent : colors.textMuted }]}>
                {isDone ? 'Rest complete' : 'Rest timer'}
              </Text>
              <Text style={[typography.display, { color: colors.textPrimary }]}>
                {formatTime(Math.max(0, secondsRemaining))}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isDone ? colors.accentSoft : colors.surfacePressed },
              ]}
            >
              <Text style={[typography.captionBold, { color: isDone ? colors.accent : colors.textSecondary }]}>
                {isDone ? 'Ready' : 'Recover'}
              </Text>
            </View>
          </View>

          <ProgressBar
            progress={progress}
            color={isDone ? colors.accent : colors.info}
            style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
          />

          <View style={styles.actionRow}>
            <Button
              compact
              mode="contained-tonal"
              icon="plus"
              onPress={addThirtySeconds}
              style={styles.actionButton}
            >
              30s
            </Button>
            <Button
              compact
              mode="outlined"
              icon="skip-next-outline"
              onPress={onDismiss}
              style={styles.actionButton}
            >
              Skip
            </Button>
          </View>
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
});
