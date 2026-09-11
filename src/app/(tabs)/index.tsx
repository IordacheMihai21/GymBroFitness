import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MesocycleCard } from '@/components/home/MesocycleCard';
import { PreFuelCard } from '@/components/home/PreFuelCard';
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
  DEMO_PRE_WORKOUT_LOG,
  DEMO_WEEK_LOG,
  DEMO_WEEK_VOLUME_KG,
} from '@/domain/workouts/demoHistory';
import { computeStreak } from '@/domain/workouts/gamification';
import { computeTargetToBeat } from '@/domain/workouts/targetToBeat';
import { useTheme } from '@/theme';

const QUOTE = 'Ain’t nothin’ to it but to do it.';

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const program = useMemo(() => generateProgram(DEMO_PREFERENCES, DEMO_USER_ID), []);
  const [dayIndex, setDayIndex] = useState(0);
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
    router.push({ pathname: '/workout', params: { day: String(index) } });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <Reveal>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Ionicons name="menu-outline" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            {BRAND.appName}
          </Text>
          <View style={styles.topBarRight}>
            <View style={[styles.streakPill, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
              <Ionicons name="flame" size={13} color={colors.warning} />
              <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                {streakDays}d
              </Text>
            </View>
            <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
              <View style={[styles.avatar, { backgroundColor: colors.surfacePressed }]}>
                <Text style={[typography.micro, { color: colors.textPrimary }]}>
                  {DEMO_DISPLAY_NAME.slice(0, 1)}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={{ gap: 2 }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>
            Ready to jump back to work, {DEMO_DISPLAY_NAME}?
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic' }]}>
            &ldquo;{QUOTE}&rdquo;
          </Text>
        </View>
      </Reveal>

      <Reveal index={2}>
        <PreFuelCard log={DEMO_PRE_WORKOUT_LOG} onPress={() => {}} />
      </Reveal>

      <Reveal index={3}>
        <TodayWorkoutHero
          day={day}
          targetRir={day.prescriptions[0].targetRir}
          target={target}
          swapLabel={program.days[swapIndex].name}
          onStart={() => startDay(dayIndex)}
          onSwap={() => setDayIndex(swapIndex)}
        />
      </Reveal>

      <Reveal index={4}>
        <WeekLogCard
          entries={DEMO_WEEK_LOG}
          weekVolumeKg={DEMO_WEEK_VOLUME_KG}
          intensityMatchPct={DEMO_INTENSITY_RIR_MATCH}
        />
      </Reveal>

      <Reveal index={5}>
        <MesocycleCard blockName={DEMO_MESOCYCLE_BLOCK.name} status={mesocycleStatus} />
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
