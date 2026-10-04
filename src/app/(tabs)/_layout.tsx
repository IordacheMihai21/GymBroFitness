import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, type ColorValue, Keyboard, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { popSpring } from '@/components/ui/motion';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { TAB_BAR_HEIGHT } from '@/constants/layout';
import { getInProgressWorkoutSession } from '@/domain/workouts/historyStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { fonts, useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <AnimatedTabIcon name={focused ? active : inactive} color={color} focused={focused} />;
  };
}

/** Icon that gives a short spring kick when its tab becomes active. */
function AnimatedTabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: ColorValue;
  focused: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!focused) return;
    scale.value = withSequence(withTiming(0.86, { duration: 80 }), withSpring(1, popSpring));
  }, [focused, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <MaterialCommunityIcons name={name} color={color} size={24} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useTrainingProfile();

  if (profile.loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!profile.user.onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        backBehavior="history"
        screenListeners={{ tabPress: () => void Haptics.selectionAsync() }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.textPrimary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingTop: 6,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Today', tabBarIcon: tabIcon('home-variant', 'home-variant-outline') }}
        />
        <Tabs.Screen
          name="program"
          options={{
            title: 'Plan',
            tabBarIcon: tabIcon('clipboard-text', 'clipboard-text-outline'),
          }}
        />
        <Tabs.Screen
          name="body"
          options={{ title: 'Body', tabBarIcon: tabIcon('human', 'human-handsdown') }}
        />
        <Tabs.Screen
          name="analytics"
          options={{ title: 'Progress', tabBarIcon: tabIcon('chart-line', 'chart-line-variant') }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Exercises',
            tabBarIcon: tabIcon('dumbbell', 'dumbbell'),
          }}
        />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="workout" options={{ href: null }} />
      </Tabs>
      <ActiveWorkoutBar />
      {/* Scrim under the status bar so scrolled content doesn't collide with the clock. */}
      <View
        pointerEvents="none"
        style={[styles.statusScrim, { height: insets.top, backgroundColor: colors.background }]}
      />
    </View>
  );
}

/**
 * The one persistent "resume" affordance outside Today (Today renders its own
 * resume hero, so the bar would duplicate it there).
 */
function ActiveWorkoutBar() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    getInProgressWorkoutSession().then((draft) => {
      if (mounted) setSession(draft);
    });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!session || pathname === '/' || pathname.includes('/workout') || keyboardVisible) {
    return null;
  }

  const completedSets = session.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => set.completed && !set.skipped).length,
    0,
  );
  const plannedSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
  const verb = session.reviewStartedAt ? 'Review' : 'Resume';

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(200)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.barWrap, { bottom: TAB_BAR_HEIGHT + insets.bottom + spacing.sm }]}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${verb} ${session.dayName}, ${completedSets} of ${plannedSets} sets complete`}
        onPress={() => router.push('/workout')}
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <View>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
              {session.dayName}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {completedSets} of {plannedSets} sets
            </Text>
          </View>
          <ProgressLine progress={completedSets / Math.max(1, plannedSets)} height={2} />
        </View>
        <View
          style={[styles.barAction, { backgroundColor: colors.accent, borderRadius: radius.md }]}
        >
          <Text style={[typography.captionBold, { color: colors.onAccent }]}>{verb}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0.94,
  },
  barWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },
  barAction: {
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
