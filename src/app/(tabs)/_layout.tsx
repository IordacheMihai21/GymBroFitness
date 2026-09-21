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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: typography.micro.fontSize, fontWeight: '600' },
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
            href: null,
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume ${session.dayName}, ${completedSets} of ${plannedSets} sets complete`}
      onPress={() => router.push('/workout')}
      style={({ pressed }) => [
        styles.activeWorkoutBar,
        {
          bottom: Math.max(insets.bottom, spacing.sm) + 84,
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderColor: colors.accent,
          borderRadius: radius.lg,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.micro, { color: colors.accent }]}>RESUME WORKOUT</Text>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {session.dayName}
        </Text>
      </View>
      <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
        {completedSets}/{plannedSets} sets
      </Text>
      <Ionicons name="play-circle" color={colors.accent} size={28} />
    </Pressable>
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
    left: 20,
    right: 20,
    bottom: 24,
    height: 68,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    paddingTop: 6,
  },
  activeWorkoutBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 10,
  },
});
