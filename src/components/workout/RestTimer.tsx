import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Portal } from 'react-native-paper';
import Animated, {
  Easing,
  FadeOutDown,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { popSpring } from '@/components/ui/motion';
import { PressableScale } from '@/components/ui/PressableScale';

import { remainingRestSeconds } from '@/domain/workouts/restTimer';
import type { RestTimerNotificationStatus } from '@/services/restTimerNotifications';
import { useTheme } from '@/theme';
import type { RestTimerSnapshot } from '@/types';

type RestTimerProps = {
  timer: RestTimerSnapshot;
  onExtend: (seconds: number) => void;
  onDismiss: () => void;
  bottomOffset: number;
  notificationStatus?: RestTimerNotificationStatus | 'idle';
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({
  timer,
  onExtend,
  onDismiss,
  bottomOffset,
  notificationStatus = 'idle',
}: RestTimerProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const notifiedRef = useRef(false);
  const [nowMs, setNowMs] = useState(Date.now);
  const secondsRemaining = remainingRestSeconds(timer, nowMs);
  const isDone = secondsRemaining <= 0;
  const progress =
    timer.durationSeconds > 0
      ? 1 - Math.min(1, Math.max(0, secondsRemaining) / timer.durationSeconds)
      : 1;

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, [timer.endsAt]);

  useEffect(() => {
    notifiedRef.current = false;
  }, [timer.endsAt]);

  // The fill runs on the UI thread as one linear glide to the end time, so it
  // moves continuously instead of stepping with the 250 ms text tick.
  const fill = useSharedValue(progress);
  const timeScale = useSharedValue(1);
  useEffect(() => {
    const remainingMs = Math.max(0, new Date(timer.endsAt).getTime() - Date.now());
    const total = Math.max(1, timer.durationSeconds * 1000);
    fill.value = 1 - Math.min(1, remainingMs / total);
    fill.value = withTiming(1, { duration: remainingMs, easing: Easing.linear });
  }, [fill, timer.durationSeconds, timer.endsAt]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const timeStyle = useAnimatedStyle(() => ({ transform: [{ scale: timeScale.value }] }));

  useEffect(() => {
    if (!isDone) return;
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      timeScale.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, popSpring));
    }
    const timeout = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timeout);
  }, [isDone, onDismiss, timeScale]);

  function addThirtySeconds() {
    notifiedRef.current = false;
    onExtend(30);
    void Haptics.selectionAsync();
  }

  const notificationNote =
    notificationStatus === 'permission_denied'
      ? 'Background alert is off. The timer still runs while the app is open.'
      : notificationStatus === 'error'
        ? 'Background alert is unavailable. The timer is still running.'
        : null;

  return (
    <Portal>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(180)}
          exiting={FadeOutDown.duration(180)}
          accessibilityLiveRegion="polite"
          style={[
            styles.panel,
            {
              bottom: bottomOffset,
              backgroundColor: colors.surfaceRaised,
              borderColor: isDone ? colors.accent : colors.borderStrong,
              borderRadius: radius.xl,
            },
          ]}
        >
          <View style={[styles.track, { backgroundColor: colors.surfacePressed }]}>
            <Animated.View
              style={[
                styles.fill,
                { backgroundColor: isDone ? colors.success : colors.accent },
                fillStyle,
              ]}
            />
          </View>
          <View style={[styles.row, { padding: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.caption, { color: isDone ? colors.accent : colors.textMuted }]}
              >
                {isDone ? 'Rest done, next set' : 'Rest'}
              </Text>
              <Animated.Text
                style={[
                  typography.jumbo,
                  {
                    color: colors.textPrimary,
                    fontSize: 34,
                    lineHeight: 40,
                    alignSelf: 'flex-start',
                  },
                  timeStyle,
                ]}
              >
                {formatTime(Math.max(0, secondsRemaining))}
              </Animated.Text>
            </View>
            <TimerButton label="+30s" onPress={addThirtySeconds} />
            <TimerButton label="Skip" onPress={onDismiss} />
          </View>
          {notificationNote ? (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textMuted,
                  paddingHorizontal: spacing.md,
                  paddingBottom: spacing.md,
                },
              ]}
            >
              {notificationNote}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Portal>
  );
}

function TimerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, radius, typography } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label === '+30s' ? 'Add 30 seconds' : 'Skip rest'}
      style={[styles.button, { backgroundColor: colors.surfacePressed, borderRadius: radius.md }]}
    >
      <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  track: {
    height: 3,
  },
  fill: {
    height: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    minWidth: 64,
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
