import { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { type ElementRef, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, IconButton, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeActionSheet, type HomeSheet } from '@/components/home/HomeActionSheet';
import { HomePreflightRail } from '@/components/home/HomePreflightRail';
import { MesocycleCard } from '@/components/home/MesocycleCard';
import { MuscleFocusMap } from '@/components/home/MuscleFocusMap';
import { OverloadRunwayCard } from '@/components/home/OverloadRunwayCard';
import { PrWatchCard } from '@/components/home/PrWatchCard';
import { RecoveryProtocolCard } from '@/components/home/RecoveryProtocolCard';
import { TodayWorkoutHero } from '@/components/home/TodayWorkoutHero';
import { WeekLogCard } from '@/components/home/WeekLogCard';
import { Reveal } from '@/components/ui/Reveal';
import { BRAND } from '@/constants/branding';
import { DEMO_DISPLAY_NAME, DEMO_PREFERENCES, DEMO_USER_ID } from '@/domain/programs/demoPreferences';
import { generateProgram } from '@/domain/programs/generator';
import { computeMesocycleStatus } from '@/domain/programs/mesocycle';
import {
  DEMO_COMPLETED_AT,
  DEMO_INTENSITY_RIR_MATCH,
  DEMO_LAST_TOP_SET_SESSION,
  DEMO_MESOCYCLE_BLOCK,
  DEMO_PERSONAL_RECORDS,
  DEMO_PRE_WORKOUT_LOG,
  DEMO_WEEK_LOG,
  DEMO_WEEK_VOLUME_KG,
} from '@/domain/workouts/demoHistory';
import { computeStreak } from '@/domain/workouts/gamification';
import { computeTargetToBeat } from '@/domain/workouts/targetToBeat';
import { useTheme } from '@/theme';

const COACH_NOTE = 'Today is simple: own the first top set, then let the plan do its job.';

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const actionSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const safeTop = Math.max(insets.top, spacing.xxl);

  const program = useMemo(() => generateProgram(DEMO_PREFERENCES, DEMO_USER_ID), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [activeSheet, setActiveSheet] = useState<HomeSheet | null>(null);
  const day = program.days[dayIndex];
  const swapIndex = (dayIndex + 1) % program.days.length;

  const streakDays = useMemo(() => computeStreak(DEMO_COMPLETED_AT), []);
  const mesocycleStatus = useMemo(() => computeMesocycleStatus(DEMO_MESOCYCLE_BLOCK), []);
  const target = useMemo(
    () =>
      computeTargetToBeat(
        day.prescriptions[0],
        DEMO_PREFERENCES.experience,
        DEMO_LAST_TOP_SET_SESSION,
      ),
    [day],
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
                {streakDays}d
              </Button>
              <TouchableRipple
                onPress={() => router.push('/profile')}
                style={styles.avatarTouchable}
                borderless
              >
                <Avatar.Text size={32} label={DEMO_DISPLAY_NAME.slice(0, 1)} />
              </TouchableRipple>
            </View>
          </View>
        </Reveal>

        <Reveal index={1}>
          <View style={{ gap: 4 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>
              Ready to jump back to work, {DEMO_DISPLAY_NAME}?
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {COACH_NOTE}
            </Text>
          </View>
        </Reveal>

        <Reveal index={2}>
          <TodayWorkoutHero
            day={day}
            targetRir={day.prescriptions[0].targetRir}
            target={target}
            swapLabel={program.days[swapIndex].name}
            onStart={() => startDay(dayIndex)}
            onSwap={() => openSheet('swap')}
            onWeakPoint={() => openSheet('weakPoint')}
          />
        </Reveal>

        <Reveal index={3}>
          <HomePreflightRail
            intensityMatchPct={DEMO_INTENSITY_RIR_MATCH}
            preWorkoutLog={DEMO_PRE_WORKOUT_LOG}
            status={mesocycleStatus}
            onFuelPress={() => openSheet('preFuel')}
          />
        </Reveal>

        <Reveal index={4}>
          <OverloadRunwayCard target={target} />
        </Reveal>

        <Reveal index={5}>
          <MuscleFocusMap day={day} />
        </Reveal>

        <Reveal index={6}>
          <PrWatchCard records={DEMO_PERSONAL_RECORDS} />
        </Reveal>

        <Reveal index={7}>
          <WeekLogCard
            entries={DEMO_WEEK_LOG}
            weekVolumeKg={DEMO_WEEK_VOLUME_KG}
            intensityMatchPct={DEMO_INTENSITY_RIR_MATCH}
          />
        </Reveal>

        <Reveal index={8}>
          <MesocycleCard blockName={DEMO_MESOCYCLE_BLOCK.name} status={mesocycleStatus} />
        </Reveal>

        <Reveal index={9}>
          <RecoveryProtocolCard status={mesocycleStatus} weekVolumeKg={DEMO_WEEK_VOLUME_KG} />
        </Reveal>
      </ScrollView>

      <HomeActionSheet
        activeSheet={activeSheet}
        modalRef={actionSheetRef}
        preWorkoutLog={DEMO_PRE_WORKOUT_LOG}
        streakDays={streakDays}
        currentDayName={day.name}
        swapLabel={program.days[swapIndex].name}
        onDismiss={() => setActiveSheet(null)}
        onConfirmSwap={confirmSwap}
      />
    </View>
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
