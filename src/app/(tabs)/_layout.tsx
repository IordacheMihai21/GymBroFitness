import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getInProgressWorkoutSession } from '@/domain/workouts/historyStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';

export default function TabsLayout() {
  const { colors, typography } = useTheme();
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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: { fontSize: typography.micro.fontSize, fontWeight: '600' },
          tabBarActiveBackgroundColor: colors.accentSoft,
          tabBarItemStyle: styles.tabItem,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ],
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="program"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="clipboard" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="body"
          options={{
            title: 'Body',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="body-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Exercises',
            tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            href: null,
          }}
        />
      </Tabs>
      <ActiveWorkoutBar />
    </View>
  );
}

function ActiveWorkoutBar() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

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

  const sessionId = session?.id ?? null;
  if (sessionId !== lastSessionId) {
    setLastSessionId(sessionId);
    if (sessionId) setCollapsed(false);
  }

  if (!session || pathname.includes('/workout') || keyboardVisible) return null;

  const completedSets = session.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => set.completed && !set.skipped).length,
    0,
  );
  const plannedSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
  const bottom = Math.max(insets.bottom, spacing.sm) + 84;
  const label = session.reviewStartedAt ? 'REVIEW WORKOUT' : 'RESUME WORKOUT';
  const icon = session.reviewStartedAt ? 'clipboard-outline' : 'play-circle';

  const pill = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${label.toLowerCase()} bar for ${session.dayName}`}
      onPress={() => setCollapsed(false)}
      style={({ pressed }) => [
        styles.activeWorkoutFab,
        { backgroundColor: pressed ? colors.accentPressed : colors.accent },
      ]}
    >
      <Ionicons name={icon} color={colors.onAccent} size={26} />
    </Pressable>
  );

  const bar = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${session.reviewStartedAt ? 'Review' : 'Resume'} ${session.dayName}, ${completedSets} of ${plannedSets} sets complete`}
        onPress={() => router.push('/workout')}
        style={({ pressed }) => [styles.activeWorkoutContent, pressed && { opacity: 0.7 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[typography.micro, { color: colors.accent }]}>{label}</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
            {session.dayName}
          </Text>
        </View>
        <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
          {completedSets}/{plannedSets} sets
        </Text>
        <Ionicons name={icon} color={colors.accent} size={28} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Minimize active workout bar"
        hitSlop={10}
        onPress={() => setCollapsed(true)}
        style={styles.minimizeButton}
      >
        <Ionicons name="chevron-down" color={colors.textMuted} size={18} />
      </Pressable>
    </>
  );

  return collapsed ? (
    <View style={[styles.activeWorkoutFabWrap, { bottom }]}>{pill}</View>
  ) : (
    <View
      style={[
        styles.activeWorkoutBar,
        {
          bottom,
          backgroundColor: colors.surface,
          borderColor: colors.accent,
          borderRadius: radius.lg,
        },
      ]}
    >
      {bar}
    </View>
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
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 72,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  tabItem: {
    borderRadius: 14,
    marginHorizontal: 2,
  },
  activeWorkoutBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 10,
  },
  activeWorkoutContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minimizeButton: {
    paddingLeft: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWorkoutFabWrap: {
    position: 'absolute',
    right: 16,
  },
  activeWorkoutFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
