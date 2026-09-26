import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

const AnimatedImage = Animated.createAnimatedComponent(Image);

/**
 * Continuously cross-fades between an exercise's start/finish reference
 * photos, with a slight synced zoom on the incoming frame, so two static
 * photos read as a live loop of the movement instead of a manual before/
 * after toggle. Runs entirely on the UI thread (shared-value driven), so
 * it stays smooth regardless of JS thread load elsewhere in the screen.
 */
export function ExerciseDemoStage({
  images,
  exerciseName,
}: {
  images: string[];
  exerciseName: string;
}) {
  const { colors, radius, typography } = useTheme();
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(!reduceMotion && images.length > 1);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const progress = useSharedValue(0);

  const active = playing && !reduceMotion && images.length > 1 && !failed;

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      return;
    }
    const HOLD_MS = 500;
    const MOVE_MS = 650;
    const ease = Easing.inOut(Easing.cubic);
    // A constant back-and-forth fade reads as a blur, not motion — real
    // reps have a clear position, a movement, another clear position. This
    // sequence holds at each frame, then flows through the transition, so
    // two stills read like the moving parts of a single loop.
    progress.value = withRepeat(
      withSequence(
        withTiming(0, { duration: HOLD_MS }),
        withTiming(1, { duration: MOVE_MS, easing: ease }),
        withTiming(1, { duration: HOLD_MS }),
        withTiming(0, { duration: MOVE_MS, easing: ease }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [active, progress]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.02 }],
  }));

  const hasDemo = images.length > 0 && !failed;

  return (
    <View
      style={[
        styles.stage,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          borderRadius: radius.xl,
        },
      ]}
    >
      {hasDemo ? (
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          <Image
            key={`base-${retryKey}`}
            source={{ uri: images[0] }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel={`${exerciseName}, movement demonstration`}
            onError={() => setFailed(true)}
          />
          {images.length > 1 ? (
            <AnimatedImage
              key={`overlay-${retryKey}`}
              source={{ uri: images[1] }}
              style={[styles.image, styles.overlayImage, overlayStyle]}
              contentFit="contain"
              cachePolicy="memory-disk"
              onError={() => setFailed(true)}
            />
          ) : null}
        </Animated.View>
      ) : (
        <View style={styles.fallback}>
          <IconButton icon="image-off-outline" size={34} iconColor={colors.textMuted} />
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            {images.length > 0 ? 'Demo could not load' : 'Visual demo unavailable'}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            {images.length > 0
              ? 'Check your connection and retry, or use the cues below.'
              : 'Use the setup and movement cues below.'}
          </Text>
          {images.length > 0 ? (
            <Button
              mode="outlined"
              icon="refresh"
              onPress={() => {
                setFailed(false);
                setRetryKey((current) => current + 1);
              }}
            >
              Retry demo
            </Button>
          ) : null}
        </View>
      )}

      {hasDemo && images.length > 1 ? (
        <IconButton
          icon={playing ? 'pause' : 'play'}
          mode="contained"
          containerColor={`${colors.background}E8`}
          iconColor={colors.textPrimary}
          accessibilityLabel={playing ? 'Pause demonstration' : 'Play demonstration'}
          onPress={() => setPlaying((current) => !current)}
          style={styles.playControl}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: '100%', height: '100%' },
  overlayImage: { position: 'absolute', left: 0, top: 0 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  playControl: { position: 'absolute', right: 8, top: 8 },
});
