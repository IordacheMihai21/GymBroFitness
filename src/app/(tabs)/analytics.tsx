import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  BarChart,
  LineChart,
  type barDataItem,
  type lineDataItem,
} from 'react-native-gifted-charts';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { Card, Chip, List, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { bodySlugsForMuscle, heatColorForVolumeZone } from '@/domain/muscles/muscleMap';
import { computeMesocycleStatus } from '@/domain/programs/mesocycle';
import {
  classifyWeeklyVolume,
  volumeZoneLabel,
  type VolumeZone,
} from '@/domain/workouts/volumeLandmarks';
import { buildActivityHeatmap } from '@/domain/workouts/activityHeatmap';
import {
  buildPlannedWeek,
  buildWorkoutHistoryInsights,
  fallbackSetsByProgram,
} from '@/domain/workouts/historyInsights';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { ActivityHeatmapCard } from '@/components/progress/ActivityHeatmapCard';
import { LevelCard } from '@/components/profile/LevelCard';
import { PersonalRecordCard } from '@/components/profile/PersonalRecordCard';
import { StreakCard } from '@/components/profile/StreakCard';
import { Reveal } from '@/components/ui/Reveal';
import { DEMO_MESOCYCLE_BLOCK } from '@/domain/workouts/demoHistory';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { MuscleGroup, WorkoutSession } from '@/types';

type Period = '4w' | '12w' | 'block';

type MuscleLoad = {
  muscle: MuscleGroup;
  sets: number;
  zone: VolumeZone;
  mev: number;
  mrv: number;
  /** 0 at MEV, 1 at MRV — clamped to [0,1] for gauge rendering. */
  gaugeFraction: number;
};

const PERIODS: { label: string; value: Period }[] = [
  { label: '4W', value: '4w' },
  { label: '12W', value: '12w' },
  { label: 'Block', value: 'block' },
];

export default function AnalyticsScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('4w');
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const { preferences, program } = useActiveProgram();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      listWorkoutHistory().then((next) => {
        if (mounted) setHistory(next);
      });
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
  const activityHeatmap = useMemo(() => buildActivityHeatmap(history), [history]);
  const streakDays = insights.streakDays;
  const level = insights.level;
  const mesocycleStatus = computeMesocycleStatus(DEMO_MESOCYCLE_BLOCK);
  const muscleSetMap = useMemo(() => {
    if (insights.weekVolumeKg > 0) return insights.weeklySetsByMuscle;
    const completedDayNames = new Set(
      insights.weekLog.filter((entry) => entry.status === 'done').map((entry) => entry.splitName),
    );
    return fallbackSetsByProgram(program.days, completedDayNames);
  }, [insights.weekLog, insights.weekVolumeKg, insights.weeklySetsByMuscle, program.days]);
  const muscleLoads = useMemo(() => computeMuscleLoads(muscleSetMap), [muscleSetMap]);
  const maxMuscleSets = Math.max(...muscleLoads.map((item) => item.sets), 1);
  const bodyData: ExtendedBodyPart[] = muscleLoads.flatMap((item) => {
    const fill = heatColorForVolumeZone(item.zone);
    return bodySlugsForMuscle(item.muscle).map((slug) => ({
      slug,
      intensity: item.zone === 'below_mv' ? 1 : 2,
      styles: {
        fill: withAlpha(fill, item.zone === 'below_mv' ? '77' : 'B8'),
        stroke: fill,
        strokeWidth: 0.35,
      },
    }));
  });
  const trendValues = valuesForPeriod(
    insights.strengthTrend?.points.map((point) => ({
      date: point.date,
      value: point.e1rmKg,
    })) ?? [],
    period,
  );
  const hasAnyStrengthPoint = trendValues.length > 0;
  const hasTrend = trendValues.length >= 2;
  const chartValues = hasTrend ? trendValues.map((point) => point.value) : [0, 0, 0, 0];
  const lineBaseline = Math.min(...chartValues) - 2;
  const lineData = buildLineData(chartValues, lineBaseline);
  const lineMaxValue = Math.max(...chartValues) - lineBaseline + 2;
  const barData = buildBarData(muscleLoads);
  const trendDelta = hasTrend
    ? (chartValues[chartValues.length - 1] ?? 0) - (chartValues[0] ?? 0)
    : 0;
  const trendMetricText = hasTrend
    ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}`
    : hasAnyStrengthPoint
      ? trendValues[trendValues.length - 1].value.toFixed(1)
      : '0.0';
  const decisionItems = buildDecisionItems({
    trendName: insights.strengthTrend?.exerciseName,
    hasTrend,
    hasAnyStrengthPoint,
    trendDelta,
    muscleLoads,
    daysToDeload: mesocycleStatus.daysToDeload,
  });

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
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Training intelligence
            </Text>
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
                  {insights.strengthTrend
                    ? `${insights.strengthTrend.exerciseName} e1RM`
                    : 'No strength trend yet'}
                </Text>
              </View>
              <View style={styles.metricRight}>
                <Text style={[typography.display, { color: colors.textPrimary }]}>
                  {trendMetricText}
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted }]}>kg e1RM</Text>
              </View>
            </View>

            <View style={styles.lineChartFrame}>
              {hasTrend ? (
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
              ) : (
                <View style={[styles.emptyChartPanel, { backgroundColor: colors.surfaceRaised }]}>
                  <View style={[styles.emptyChartLine, { backgroundColor: colors.surfacePressed }]}>
                    <View style={[styles.emptyChartDot, { backgroundColor: colors.accent }]} />
                  </View>
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                    {hasAnyStrengthPoint ? 'One saved point logged' : 'No loaded sets yet'}
                  </Text>
                  <Text
                    style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
                  >
                    Complete one more loaded session for this lift to draw a real e1RM trend.
                  </Text>
                </View>
              )}
            </View>

            <List.Item
              title={
                hasTrend ? 'Keep load progression evidence-based' : 'Calibrating trend quality'
              }
              description={
                hasTrend
                  ? 'The chart now uses saved workout history, not demo projection data.'
                  : 'A real line appears after two comparable loaded sessions for the same exercise.'
              }
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
                <Text style={[typography.micro, { color: colors.accent }]}>Volume landmarks</Text>
                <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                  {insights.weekVolumeKg > 0
                    ? 'Logged sets vs. MEV–MRV'
                    : 'Programmed sets vs. MEV–MRV'}
                </Text>
              </View>
              <Chip compact mode="flat" icon="target">
                {Math.round(insights.intensityMatchPct * 100)}% RIR
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
                defaultStroke={colors.border}
              />
              <Body
                data={bodyData}
                colors={[`${colors.accent}77`, colors.accent]}
                side="back"
                scale={0.34}
                border="none"
                defaultFill={colors.surfacePressed}
                defaultStroke={colors.border}
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
                      {item.sets} sets/wk · {volumeZoneLabel(item.zone)} (MEV {item.mev}–MRV{' '}
                      {item.mrv})
                    </Text>
                  </View>
                  <View style={styles.progressColumn}>
                    <Text style={[typography.micro, { color: colors.textMuted }]}>
                      {item.sets} sets
                    </Text>
                    <ProgressBar
                      progress={Math.min(1, item.gaugeFraction)}
                      color={zoneColor(item.zone)}
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
        <ActivityHeatmapCard heatmap={activityHeatmap} />
      </Reveal>

      <Reveal index={5}>
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
            {decisionItems.map((item) => (
              <DecisionItem key={item.title} {...item} />
            ))}
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={6}>
        <StreakCard streakDays={streakDays} />
      </Reveal>

      <Reveal index={7}>
        <LevelCard level={level} totalWorkouts={insights.totalWorkouts} />
      </Reveal>

      <View style={{ gap: spacing.sm }}>
        <Reveal index={8}>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            Personal records
          </Text>
        </Reveal>
        <View style={styles.prGrid}>
          {insights.personalRecords.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>
              Finish loaded workouts and best e1RM records will appear here.
            </Text>
          ) : null}
          {insights.personalRecords.map((record, i) => (
            <Reveal key={record.id} index={9 + i} style={styles.prSlot}>
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

function computeMuscleLoads(setsByMuscle: Partial<Record<MuscleGroup, number>>): MuscleLoad[] {
  return (Object.entries(setsByMuscle) as [MuscleGroup, number][])
    .filter(([, sets]) => sets > 0)
    .map(([muscle, sets]) => {
      const classification = classifyWeeklyVolume(muscle, sets);
      return {
        muscle,
        sets,
        zone: classification.zone,
        mev: classification.landmarks.mev,
        mrv: classification.landmarks.mrv,
        gaugeFraction: classification.gaugeFraction,
      };
    })
    .sort(
      (a, b) => b.sets - a.sets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]),
    );
}

type TrendValue = { date: string; value: number };

function valuesForPeriod(points: TrendValue[], period: Period): TrendValue[] {
  if (period === 'block') return points;
  const days = period === '4w' ? 28 : 84;
  const latest = points[points.length - 1];
  if (!latest) return [];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - days);
  return points.filter((point) => new Date(point.date) >= cutoff);
}

function buildDecisionItems({
  trendName,
  hasTrend,
  hasAnyStrengthPoint,
  trendDelta,
  muscleLoads,
  daysToDeload,
}: {
  trendName?: string;
  hasTrend: boolean;
  hasAnyStrengthPoint: boolean;
  trendDelta: number;
  muscleLoads: MuscleLoad[];
  daysToDeload: number;
}) {
  const doseFlag =
    muscleLoads.find((item) => item.zone === 'below_mv' || item.zone === 'maintenance') ??
    muscleLoads.find((item) => item.zone === 'excessive' || item.zone === 'frontier');

  return [
    {
      icon: 'chart-bell-curve',
      title:
        hasTrend && trendName
          ? `${trendName}: ${trendDelta >= 0 ? 'rising' : 'sliding'}`
          : hasAnyStrengthPoint && trendName
            ? `${trendName}: baseline set`
            : 'Strength trend: needs data',
      description: hasTrend
        ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}kg e1RM across the selected window.`
        : hasAnyStrengthPoint
          ? 'One loaded session is saved. Repeat the lift to unlock direction, not just a snapshot.'
          : 'Complete repeated loaded sessions for one lift to unlock trend-based decisions.',
    },
    {
      icon: 'alert-decagram-outline',
      title: doseFlag
        ? `${MUSCLE_LABELS[doseFlag.muscle]}: ${volumeZoneLabel(doseFlag.zone)}`
        : 'Weekly volume: no hard sets logged',
      description: doseFlag
        ? `${doseFlag.sets} sets this week against MEV ${doseFlag.mev} and MRV ${doseFlag.mrv}.`
        : 'Log this week’s sessions to compare actual muscle dose against landmarks.',
    },
    {
      icon: 'calendar-sync',
      title: `Deload in ${daysToDeload} days`,
      description:
        'Use this as a planned checkpoint, then let performance and recovery signals override it.',
    },
  ];
}

function zoneColor(zone: VolumeZone): string {
  return heatColorForVolumeZone(zone);
}

function buildLineData(values: number[], baseline: number): lineDataItem[] {
  return values.map((value, index) => ({
    value: value - baseline,
    label: '',
  }));
}

function buildBarData(muscles: MuscleLoad[]): barDataItem[] {
  return muscles.slice(0, 6).map((item) => ({
    value: item.sets,
    label: MUSCLE_LABELS[item.muscle].slice(0, 3),
    frontColor: zoneColor(item.zone),
  }));
}

function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
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
  emptyChartPanel: {
    minHeight: 144,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  emptyChartLine: {
    width: '72%',
    height: 2,
    justifyContent: 'center',
  },
  emptyChartDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    alignSelf: 'center',
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
