import { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ElementRef, useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Chip, IconButton, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeActionSheet, type HomeSheet } from '@/components/home/HomeActionSheet';
import { HomePreflightRail } from '@/components/home/HomePreflightRail';
import { MuscleFocusMap } from '@/components/home/MuscleFocusMap';
import { OverloadRunwayCard } from '@/components/home/OverloadRunwayCard';
import { PrWatchCard } from '@/components/home/PrWatchCard';
import { TodayWorkoutHero } from '@/components/home/TodayWorkoutHero';
import { WeekLogCard } from '@/components/home/WeekLogCard';
import { Reveal } from '@/components/ui/Reveal';
import { BRAND } from '@/constants/branding';
import { buildPlannedWeek, buildWorkoutHistoryInsights } from '@/domain/workouts/historyInsights';
import { getInProgressWorkoutSession, listWorkoutHistory } from '@/domain/workouts/historyStore';
import { buildProgressionTarget } from '@/domain/workouts/targetToBeat';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';

const COACH_NOTE = 'Today is simple: own the first top set, then let the plan do its job.';

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const actionSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const safeTop = Math.max(insets.top, spacing.xxl);
  const { user, preferences, program } = useActiveProgram();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [activeDraft, setActiveDraft] = useState<WorkoutSession | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [activeSheet, setActiveSheet] = useState<HomeSheet | null>(null);
  const day = program.days[dayIndex];
  const swapIndex = (dayIndex + 1) % program.days.length;

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([listWorkoutHistory(), getInProgressWorkoutSession()]).then(
        ([nextHistory, draft]) => {
          if (!mounted) return;
          setHistory(nextHistory);
          setActiveDraft(draft);
        },
      );
      return () => {
        mounted = false;
      };
    }, []),
  );

  const plannedWeek = useMemo(
    () => buildPlannedWeek(program.days, preferences.preferredDays),
    [preferences.preferredDays, program.days],
  );
  const insights = useMemo(
    () => buildWorkoutHistoryInsights(history, plannedWeek),
    [history, plannedWeek],
  );
  const target = useMemo(
    () =>
      buildProgressionTarget({
        prescription: day.prescriptions[0],
        history,
        userExperience: preferences.experience,
        nutritionContext: preferences.nutritionContext,
        isPriorityMuscle: day.focus.some((muscle) => preferences.musclePriorities.includes(muscle)),
      }),
    [
      day,
      history,
      preferences.experience,
      preferences.musclePriorities,
      preferences.nutritionContext,
    ],
  );

  function startDay(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/workout', params: { day: String(index) } });
  }

  function openSheet(sheet: HomeSheet) {
    Haptics.selectionAsync();
    setActiveSheet(sheet);
    requestAnimationFrame(() => actionSheetRef.current?.present());
  }

  function confirmSwap() {
    setDayIndex(swapIndex);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    actionSheetRef.current?.dismiss();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingTop: safeTop + spacing.lg,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <Reveal>
          <View style={styles.topBar}>
            <IconButton
              icon="menu"
              size={24}
              onPress={() => router.push('/settings')}
              accessibilityLabel="Open settings"
              style={styles.iconButton}
            />
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              {BRAND.appName}
            </Text>
            <View style={styles.topBarRight}>
              <Button
                compact
                mode="contained-tonal"
                icon="fire"
                onPress={() => openSheet('streak')}
                buttonColor={colors.surfacePressed}
                textColor={colors.textPrimary}
                style={styles.streakButton}
                contentStyle={styles.streakButtonContent}
                labelStyle={typography.captionBold}
              >
                {insights.streakDays}d
              </Button>
              <TouchableRipple
                onPress={() => router.push('/profile')}
                accessibilityLabel="Open profile"
                accessibilityRole="button"
                style={styles.avatarTouchable}
                borderless
              >
                <Avatar.Text size={32} label={user.displayName.slice(0, 1)} />
              </TouchableRipple>
            </View>
          </View>
        </Reveal>

        <Reveal index={1}>
          {activeDraft ? (
            <ActiveWorkoutCard session={activeDraft} onResume={() => router.push('/workout')} />
          ) : null}
        </Reveal>

        <Reveal index={2}>
          <View style={{ gap: 4 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>
              Ready to jump back to work, {user.displayName}?
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{COACH_NOTE}</Text>
          </View>
        </Reveal>

        <Reveal index={3}>
          {activeDraft ? null : (
            <TodayWorkoutHero
              day={day}
              targetRir={day.prescriptions[0].targetRir}
              target={target}
              units={preferences.units}
              hasPreviousTopSet={target.lastSignal != null}
              swapLabel={program.days[swapIndex].name}
              onStart={() => startDay(dayIndex)}
              onSwap={() => openSheet('swap')}
              onWeakPoint={() => openSheet('weakPoint')}
              onCustomWorkout={() => router.push('/custom-workout')}
            />
          )}
        </Reveal>

        <Reveal index={4}>
          <HomePreflightRail
            intensityMatchPct={insights.intensityMatchPct}
            sessionsThisWeek={insights.weekLog.filter((entry) => entry.status === 'done').length}
          />
        </Reveal>

        <Reveal index={5}>
          <OverloadRunwayCard target={target} units={preferences.units} />
        </Reveal>

        <Reveal index={6}>
          <MuscleFocusMap day={day} />
        </Reveal>

        <Reveal index={7}>
          <PrWatchCard records={insights.personalRecords} units={preferences.units} />
        </Reveal>

        <Reveal index={8}>
          <WeekLogCard
            entries={insights.weekLog}
            weekVolumeKg={insights.weekVolumeKg}
            intensityMatchPct={insights.intensityMatchPct}
            units={preferences.units}
          />
        </Reveal>
      </ScrollView>

      <HomeActionSheet
        activeSheet={activeSheet}
        modalRef={actionSheetRef}
        streakDays={insights.streakDays}
        currentDayName={day.name}
        swapLabel={program.days[swapIndex].name}
        onDismiss={() => setActiveSheet(null)}
        onConfirmSwap={confirmSwap}
      />
    </View>
  );
}

function ActiveWorkoutCard({
  session,
  onResume,
}: {
  session: WorkoutSession;
  onResume: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
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
    <Card
      mode="contained"
      style={{
        backgroundColor: colors.accentSoft,
        borderColor: colors.accent,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.xl,
      }}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.micro, { color: colors.accent }]}>ACTIVE WORKOUT</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>
              {session.dayName}
            </Text>
          </View>
          <Chip compact icon={session.status === 'paused' ? 'pause' : 'progress-clock'}>
            {completedSets}/{plannedSets} sets
          </Chip>
        </View>
        <Button mode="contained" icon="play" onPress={onResume}>
          Resume workout
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    margin: 0,
  },
  streakButton: {
    borderRadius: 12,
  },
  streakButtonContent: {
    height: 40,
    paddingHorizontal: 8,
  },
  avatarTouchable: {
    borderRadius: 999,
  },
});
