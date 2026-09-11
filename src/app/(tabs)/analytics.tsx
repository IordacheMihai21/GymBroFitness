import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LevelCard } from '@/components/profile/LevelCard';
import { PersonalRecordCard } from '@/components/profile/PersonalRecordCard';
import { StreakCard } from '@/components/profile/StreakCard';
import { Reveal } from '@/components/ui/Reveal';
import {
  DEMO_COMPLETED_AT,
  DEMO_PERSONAL_RECORDS,
  DEMO_TOTAL_WORKOUTS,
} from '@/domain/workouts/demoHistory';
import { computeLevel, computeStreak } from '@/domain/workouts/gamification';
import { useTheme } from '@/theme';

export default function AnalyticsScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const streakDays = computeStreak(DEMO_COMPLETED_AT);
  const level = computeLevel(DEMO_TOTAL_WORKOUTS);

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <Reveal>
        <Text style={[typography.title, { color: colors.textPrimary }]}>Analytics</Text>
      </Reveal>

      <Reveal index={1}>
        <StreakCard streakDays={streakDays} />
      </Reveal>

      <Reveal index={2}>
        <LevelCard level={level} totalWorkouts={DEMO_TOTAL_WORKOUTS} />
      </Reveal>

      <View style={{ gap: spacing.sm }}>
        <Reveal index={3}>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            Personal Records
          </Text>
        </Reveal>
        <View style={styles.prGrid}>
          {DEMO_PERSONAL_RECORDS.map((record, i) => (
            <Reveal key={record.id} index={4 + i} style={styles.prSlot}>
              <PersonalRecordCard record={record} />
            </Reveal>
          ))}
        </View>
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  prGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  prSlot: {
    minWidth: '46%',
    flexGrow: 1,
  },
});
