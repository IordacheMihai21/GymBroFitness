import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart, type barDataItem, type lineDataItem } from 'react-native-gifted-charts';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { Card, Chip, List, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import { DEMO_PREFERENCES, DEMO_USER_ID } from '@/domain/programs/demoPreferences';
import { generateProgram } from '@/domain/programs/generator';
import { computeMesocycleStatus } from '@/domain/programs/mesocycle';
import { LevelCard } from '@/components/profile/LevelCard';
import { PersonalRecordCard } from '@/components/profile/PersonalRecordCard';
import { StreakCard } from '@/components/profile/StreakCard';
import { Reveal } from '@/components/ui/Reveal';
import {
  DEMO_COMPLETED_AT,
  DEMO_INTENSITY_RIR_MATCH,
  DEMO_MESOCYCLE_BLOCK,
  DEMO_PERSONAL_RECORDS,
  DEMO_TOTAL_WORKOUTS,
  DEMO_WEEK_LOG,
} from '@/domain/workouts/demoHistory';
import { computeLevel, computeStreak } from '@/domain/workouts/gamification';
import { useTheme } from '@/theme';
import type { MuscleGroup, ProgramDay } from '@/types';

type Period = '4w' | '12w' | 'block';

type MuscleLoad = {
  muscle: MuscleGroup;
  sets: number;
  score: number;
  status: 'lagging' | 'productive' | 'high';
};

const PERIODS: { label: string; value: Period }[] = [
  { label: '4W', value: '4w' },
  { label: '12W', value: '12w' },
  { label: 'Block', value: 'block' },
];

const MUSCLE_TO_SLUG: Record<MuscleGroup, Slug> = {
  chest: 'chest',
  back: 'upper-back',
  shoulders: 'deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  abs: 'abs',
  lower_back: 'lower-back',
};

const E1RM_SERIES: Record<Period, number[]> = {
  '4w': [104.5, 105.2, 106.8, 108.4, 110],
  '12w': [96.8, 98.2, 100.1, 101.6, 103.9, 104.5, 105.2, 106.8, 108.4, 110],
  block: [100.1, 101.6, 103.9, 104.5, 105.2, 106.8, 108.4, 110],
};

export default function AnalyticsScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('4w');

  const program = useMemo(() => generateProgram(DEMO_PREFERENCES, DEMO_USER_ID), []);
  const streakDays = computeStreak(DEMO_COMPLETED_AT);
  const level = computeLevel(DEMO_TOTAL_WORKOUTS);
  const mesocycleStatus = computeMesocycleStatus(DEMO_MESOCYCLE_BLOCK);
  const muscleLoads = useMemo(() => computeMuscleLoads(program.days), [program.days]);
  const maxMuscleSets = Math.max(...muscleLoads.map((item) => item.sets), 1);
  const bodyData: ExtendedBodyPart[] = muscleLoads.map((item) => ({
    slug: MUSCLE_TO_SLUG[item.muscle],
    intensity: item.score >= 75 ? 2 : 1,
  }));
  const lineBaseline = Math.min(...E1RM_SERIES[period]) - 2;
  const lineData = buildLineData(E1RM_SERIES[period], lineBaseline);
  const lineMaxValue = Math.max(...E1RM_SERIES[period]) - lineBaseline + 2;
  const barData = buildBarData(muscleLoads, colors.accent, colors.warning);
  const trendDelta = E1RM_SERIES[period].at(-1)! - E1RM_SERIES[period][0];

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <Reveal>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Training intelligence</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Analytics</Text>
          </View>
          <Chip compact mode="flat" icon="calendar-clock">
            W{mesocycleStatus.currentWeek}/{mesocycleStatus.totalWeeks}
          </Chip>
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.periodRow}>
          {PERIODS.map((item) => (
            <Chip
              key={item.value}
              selected={period === item.value}
              onPress={() => setPeriod(item.value)}
              mode={period === item.value ? 'flat' : 'outlined'}
            >
              {item.label}
            </Chip>
          ))}
        </View>
      </Reveal>

      <Reveal index={2}>
        <Card
          mode="contained"
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[typography.micro, { color: colors.accent }]}>Strength trend</Text>
                <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                  Bench e1RM is climbing
                </Text>
              </View>
              <View style={styles.metricRight}>
                <Text style={[typography.display, { color: colors.textPrimary }]}>
                  +{trendDelta.toFixed(1)}
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted }]}>kg e1RM</Text>
              </View>
            </View>

            <View style={styles.lineChartFrame}>
              <LineChart
                data={lineData}
                height={130}
                width={300}
                maxValue={lineMaxValue}
                spacing={period === '4w' ? 58 : 32}
                initialSpacing={0}
                endSpacing={0}
                thickness={3}
                color={colors.accent}
                curved
                areaChart
                startFillColor={colors.accent}
                endFillColor={colors.accent}
                startOpacity={0.2}
                endOpacity={0.02}
                hideAxesAndRules
                hideYAxisText
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisLabelWidth={0}
                labelsExtraHeight={0}
                dataPointsColor={colors.accent}
                dataPointsRadius={4}
                disableScroll
                backgroundColor="transparent"
              />
            </View>

            <List.Item
              title="Keep load progression conservative"
              description="The trend is up, but rep quality matters more than another jump this week."
              left={(props) => <List.Icon {...props} icon="trending-up" color={colors.accent} />}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
            />
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={3}>
        <Card
          mode="contained"
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[typography.micro, { color: colors.accent }]}>Hypertrophy balance</Text>
                <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                  Weekly muscle dose
                </Text>
              </View>
              <Chip compact mode="flat" icon="target">
                {Math.round(DEMO_INTENSITY_RIR_MATCH * 100)}% RIR
              </Chip>
            </View>

            <View style={styles.bodyRow}>
              <Body
                data={bodyData}
                colors={[`${colors.accent}77`, colors.accent]}
                side="front"
                scale={0.34}
                border="none"
                defaultFill={colors.surfacePressed}
              />
              <Body
                data={bodyData}
                colors={[`${colors.accent}77`, colors.accent]}
                side="back"
                scale={0.34}
                border="none"
                defaultFill={colors.surfacePressed}
              />
            </View>

            <View style={styles.barChartFrame}>
              <BarChart
                data={barData}
                height={130}
                width={300}
                maxValue={maxMuscleSets + 2}
                barWidth={24}
                spacing={18}
                roundedTop
                roundedBottom
                hideAxesAndRules
                hideYAxisText
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisLabelWidth={0}
                disableScroll
                backgroundColor="transparent"
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              {muscleLoads.slice(0, 5).map((item) => (
                <View key={item.muscle} style={styles.muscleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                      {MUSCLE_LABELS[item.muscle]}
                    </Text>
                    <Text style={[typography.micro, { color: colors.textMuted }]}>
                      {item.sets} direct sets · {statusCopy(item.status)}
                    </Text>
                  </View>
                  <View style={styles.progressColumn}>
                    <Text style={[typography.micro, { color: colors.textMuted }]}>
                      {item.score}/100
                    </Text>
                    <ProgressBar
                      progress={item.score / 100}
                      color={item.status === 'lagging' ? colors.warning : colors.accent}
                      style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={4}>
        <Card
          mode="contained"
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Decision queue
            </Text>
            <DecisionItem
              icon="chart-bell-curve"
              title="Bench: getting stronger"
              description="Keep 42.5kg as the next top-set load until you own the full rep range."
            />
            <DecisionItem
              icon="alert-decagram-outline"
              title="Hamstrings: low direct work"
              description="Add one hinge slot or keep Lower B strict before adding chest volume."
            />
            <DecisionItem
              icon="calendar-sync"
              title={`Deload in ${mesocycleStatus.daysToDeload} days`}
              description="Do not chase extra volume unless performance is still rising."
            />
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={5}>
        <StreakCard streakDays={streakDays} />
      </Reveal>

      <Reveal index={6}>
        <LevelCard level={level} totalWorkouts={DEMO_TOTAL_WORKOUTS} />
      </Reveal>

      <View style={{ gap: spacing.sm }}>
        <Reveal index={7}>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            Personal records
          </Text>
        </Reveal>
        <View style={styles.prGrid}>
          {DEMO_PERSONAL_RECORDS.map((record, i) => (
            <Reveal key={record.id} index={8 + i} style={styles.prSlot}>
              <PersonalRecordCard record={record} />
            </Reveal>
          ))}
        </View>
      </View>
    </Animated.ScrollView>
  );
}

function DecisionItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  const { colors, typography } = useTheme();

  return (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon={icon} color={colors.accent} />}
      titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
      descriptionStyle={[typography.caption, { color: colors.textMuted }]}
    />
  );
}

function computeMuscleLoads(days: ProgramDay[]): MuscleLoad[] {
  const setsByMuscle = new Map<MuscleGroup, number>();
  for (const day of days) {
    for (const prescription of day.prescriptions) {
      const exercise = requireExercise(prescription.exerciseId);
      for (const muscle of exercise.primaryMuscles) {
        const multiplier = DEMO_WEEK_LOG.some((entry) => entry.splitName === day.name && entry.status === 'done')
          ? 1
          : 0.55;
        setsByMuscle.set(
          muscle,
          (setsByMuscle.get(muscle) ?? 0) + Math.round(prescription.workingSets * multiplier),
        );
      }
    }
  }

  return [...setsByMuscle.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      score: scoreMuscleDose(sets),
      status: statusForSets(sets),
    }))
    .sort((a, b) => b.sets - a.sets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]));
}

function scoreMuscleDose(sets: number): number {
  if (sets <= 4) return Math.max(30, sets * 10);
  if (sets <= 10) return 55 + (sets - 5) * 8;
  return Math.min(100, 92 + (sets - 10) * 2);
}

function statusForSets(sets: number): MuscleLoad['status'] {
  if (sets < 6) return 'lagging';
  if (sets > 12) return 'high';
  return 'productive';
}

function statusCopy(status: MuscleLoad['status']): string {
  if (status === 'lagging') return 'needs attention';
  if (status === 'high') return 'watch fatigue';
  return 'productive range';
}

function buildLineData(values: number[], baseline: number): lineDataItem[] {
  return values.map((value, index) => ({
    value: value - baseline,
    label: '',
  }));
}

function buildBarData(
  muscles: MuscleLoad[],
  accent: string,
  warning: string,
): barDataItem[] {
  return muscles.slice(0, 6).map((item) => ({
    value: item.sets,
    label: MUSCLE_LABELS[item.muscle].slice(0, 3),
    frontColor: item.status === 'lagging' ? warning : accent,
  }));
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  lineChartFrame: {
    width: '100%',
    height: 144,
    overflow: 'hidden',
  },
  barChartFrame: {
    width: '100%',
    height: 154,
    overflow: 'hidden',
  },
  listPanel: {
    borderRadius: 14,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressColumn: {
    width: 112,
    gap: 5,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
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
