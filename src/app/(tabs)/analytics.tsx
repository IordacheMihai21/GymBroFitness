import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { bodySlugsForMuscle, heatColorForVolumeZone } from '@/domain/muscles/muscleMap';
import {
  classifyWeeklyVolume,
  volumeZoneLabel,
  type VolumeLandmarks,
  type VolumeZone,
} from '@/domain/workouts/volumeLandmarks';
import { VolumeLandmarkGauge } from '@/components/muscles/VolumeLandmarkGauge';
import { InfoHint } from '@/components/ui/InfoHint';
import { buildActivityHeatmap } from '@/domain/workouts/activityHeatmap';
import { buildPlannedWeek, buildWorkoutHistoryInsights } from '@/domain/workouts/historyInsights';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { ActivityHeatmapCard } from '@/components/progress/ActivityHeatmapCard';
import { ListRow } from '@/components/ui/ListRow';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { Reveal } from '@/components/ui/Reveal';
import { Segmented } from '@/components/ui/Segmented';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Pill } from '@/components/ui/Pill';
import { Tile } from '@/components/ui/Tile';
import { sessionVolumeKg } from '@/domain/workouts/analytics';
import { buildExerciseTrend, type ExerciseTrendPoint } from '@/domain/workouts/exerciseTrend';
import { requireExercise } from '@/domain/exercises/catalog';
import { formatDate } from '@/utils/dates';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { MuscleGroup, WorkoutSession } from '@/types';
import { displayLoad, formatVolumeLoad, unitLabel } from '@/utils/units';

type Period = '4w' | '12w' | 'block';

type MuscleLoad = {
  muscle: MuscleGroup;
  sets: number;
  zone: VolumeZone;
  mev: number;
  mrv: number;
  /** 0 at MEV, 1 at MRV, clamped to [0,1] for gauge rendering. */
  gaugeFraction: number;
  landmarks: VolumeLandmarks;
};

const PERIODS = [
  { label: '4W', value: '4w' },
  { label: '12W', value: '12w' },
  { label: 'All', value: 'block' },
] as const satisfies readonly { label: string; value: Period }[];

export default function AnalyticsScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('4w');
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [lineChartWidth, setLineChartWidth] = useState(0);
  const [liftId, setLiftId] = useState<string | null>(null);
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
  const muscleSetMap = insights.weeklySetsByMuscle;
  const muscleLoads = useMemo(() => computeMuscleLoads(muscleSetMap), [muscleSetMap]);
  const hasMuscleLoads = muscleLoads.length > 0;
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
  const liftOptions = useMemo(
    () => buildLiftOptions(insights.completedSessions),
    [insights.completedSessions],
  );
  const activeLiftId = liftId ?? insights.strengthTrend?.exerciseId ?? liftOptions[0]?.id ?? null;
  const activeLift = liftOptions.find((option) => option.id === activeLiftId) ?? null;
  const allTimeVolume = useMemo(
    () =>
      insights.completedSessions.reduce((total, session) => total + sessionVolumeKg(session), 0),
    [insights.completedSessions],
  );
  const trendValues = valuesForPeriod(
    activeLift?.points.map((point) => ({
      sessionId: point.sessionId,
      date: point.date,
      value: point.e1rmKg,
    })) ?? [],
    period,
  );
  const hasAnyStrengthPoint = trendValues.length > 0;
  const hasTrend = trendValues.length >= 2;
  const chartValues = hasTrend
    ? trendValues.map((point) => displayLoad(point.value, preferences.units) ?? 0)
    : [0, 0, 0, 0];
  const lineBaseline = Math.min(...chartValues) - 2;
  const lineData = buildLineData(chartValues, lineBaseline, (index) => {
    const source = trendValues[index];
    if (source) router.push({ pathname: '/history', params: { sessionId: source.sessionId } });
  });
  const lineMaxValue = Math.max(...chartValues) - lineBaseline + 2;
  const trendDelta = hasTrend
    ? (chartValues[chartValues.length - 1] ?? 0) - (chartValues[0] ?? 0)
    : 0;
  const trendMetricText = hasTrend
    ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}`
    : hasAnyStrengthPoint
      ? (displayLoad(trendValues[trendValues.length - 1].value, preferences.units) ?? 0).toFixed(1)
      : '-';
  const decisionItems = buildDecisionItems({
    trendName: activeLift?.name,
    hasTrend,
    hasAnyStrengthPoint,
    trendDelta,
    muscleLoads,
    units: preferences.units,
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: 12,
      }}
    >
      <Reveal style={{ marginBottom: spacing.sm }}>
        <Text style={[typography.display, { color: colors.textPrimary }]}>Progress</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          From your completed workouts
        </Text>
      </Reveal>

      <Reveal index={1}>
        <Tile glow title="All time">
          <View style={styles.statRow}>
            <BigStat value={String(insights.totalWorkouts)} label="workouts" />
            <BigStat value={formatVolumeLoad(allTimeVolume, preferences.units)} label="lifted" />
            <BigStat value={String(insights.personalRecords.length)} label="records" />
          </View>
          <View style={{ gap: 6 }}>
            <View style={styles.headerRow}>
              <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                {level.tier.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {level.nextTier
                  ? `${level.nextTier.minWorkouts - insights.totalWorkouts} workouts to ${level.nextTier.name}`
                  : 'Top level reached'}
              </Text>
            </View>
            <ProgressLine progress={level.progress} height={4} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {streakDays > 0 ? `${streakDays} day streak going` : 'Train today to start a streak'}
            </Text>
          </View>
        </Tile>
      </Reveal>

      <Reveal index={2}>
        <Tile>
          <View style={{ gap: spacing.sm }}>
            <View style={styles.inlineHint}>
              <Text
                style={[typography.heading, { color: colors.textPrimary, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {liftOptions.length > 1 ? 'Estimated 1RM' : (activeLift?.name ?? 'Estimated 1RM')}
              </Text>
              <InfoHint term="e1rm" />
            </View>
            {liftOptions.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.liftRail}
                style={{ marginHorizontal: -spacing.lg }}
              >
                {liftOptions.map((option) => (
                  <Pill
                    key={option.id}
                    label={option.name}
                    active={option.id === activeLiftId}
                    onPress={() => setLiftId(option.id)}
                  />
                ))}
              </ScrollView>
            ) : null}
            <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          </View>
          {hasAnyStrengthPoint ? (
            <View style={styles.trendValueRow}>
              <Text style={[typography.jumbo, { color: colors.textPrimary }]}>
                {trendMetricText}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {unitLabel(preferences.units)} e1RM{hasTrend ? ' change' : ''}
              </Text>
            </View>
          ) : null}

          <View
            style={styles.lineChartFrame}
            onLayout={(event) => setLineChartWidth(event.nativeEvent.layout.width)}
          >
            {hasTrend && lineChartWidth > 0 ? (
              <LineChart
                data={lineData}
                height={130}
                width={Math.max(1, lineChartWidth - 8)}
                maxValue={lineMaxValue}
                spacing={Math.max(24, (lineChartWidth - 16) / Math.max(1, lineData.length - 1))}
                initialSpacing={0}
                endSpacing={0}
                thickness={2}
                color={colors.accent}
                curved
                areaChart
                startFillColor={colors.accent}
                endFillColor={colors.accent}
                startOpacity={0.16}
                endOpacity={0}
                hideAxesAndRules
                hideYAxisText
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisLabelWidth={0}
                labelsExtraHeight={0}
                dataPointsColor={colors.accent}
                dataPointsRadius={3}
                disableScroll
                backgroundColor="transparent"
              />
            ) : (
              <View
                style={[styles.emptyChart, { borderColor: colors.border, borderRadius: radius.lg }]}
              >
                <Text
                  style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
                >
                  {hasAnyStrengthPoint
                    ? 'One session saved. Repeat the lift to draw a trend.'
                    : 'Log the same loaded lift twice to draw a trend.'}
                </Text>
              </View>
            )}
          </View>
          {hasTrend ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Tap a point to open that workout.
            </Text>
          ) : null}
        </Tile>
      </Reveal>

      <Reveal index={3}>
        <Tile>
          <ActivityHeatmapCard heatmap={activityHeatmap} units={preferences.units} />
        </Tile>
      </Reveal>

      <Reveal index={4}>
        <Tile>
          <View style={styles.headerRow}>
            <View style={[styles.inlineHint, { flex: 1 }]}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>This week</Text>
              <InfoHint term="volumeLandmarks" />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {insights.rirSetCount > 0
                ? `${Math.round(insights.intensityMatchPct * 100)}% RIR on target`
                : 'No RIR logged'}
            </Text>
          </View>

          <View style={styles.bodyRow}>
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="front"
              scale={0.34}
              border="none"
              defaultFill={colors.surfaceRaised}
              defaultStroke={colors.border}
            />
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="back"
              scale={0.34}
              border="none"
              defaultFill={colors.surfaceRaised}
              defaultStroke={colors.border}
            />
          </View>

          {hasMuscleLoads ? (
            <View style={{ gap: spacing.md }}>
              {muscleLoads.slice(0, 6).map((item) => (
                <View key={item.muscle} style={{ gap: 6 }}>
                  <View style={styles.headerRow}>
                    <Text style={[typography.body, { color: colors.textPrimary }]}>
                      {MUSCLE_LABELS[item.muscle]}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {item.sets} sets, {volumeZoneLabel(item.zone).toLowerCase()}
                    </Text>
                  </View>
                  <VolumeLandmarkGauge
                    landmarks={item.landmarks}
                    weeklySets={item.sets}
                    zone={item.zone}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Finish a workout to compare your direct sets with general weekly ranges.
            </Text>
          )}
        </Tile>
      </Reveal>

      <Reveal index={5}>
        <Tile title="Next steps">
          <View>
            {decisionItems.map((item, index) => (
              <ListRow
                key={item.title}
                title={item.title}
                subtitle={item.description}
                last={index === decisionItems.length - 1}
              />
            ))}
          </View>
        </Tile>
      </Reveal>

      <Reveal index={6}>
        <Tile
          title="Personal records"
          aside={<MaterialCommunityIcons name="trophy-outline" size={18} color={colors.warning} />}
        >
          {insights.personalRecords.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Finish loaded workouts and your best e1RM per lift shows up here.
            </Text>
          ) : (
            <View>
              {insights.personalRecords.map((record, index) => (
                <ListRow
                  key={record.id}
                  title={requireExercise(record.exerciseId).name}
                  subtitle={formatDate(record.date)}
                  value={`${displayLoad(record.value, preferences.units) ?? 0} ${unitLabel(preferences.units)}`}
                  onPress={() =>
                    router.push({ pathname: '/exercise/[id]', params: { id: record.exerciseId } })
                  }
                  last={index === insights.personalRecords.length - 1}
                />
              ))}
            </View>
          )}
        </Tile>
      </Reveal>
    </ScrollView>
  );
}

type LiftOption = {
  id: string;
  name: string;
  points: (ExerciseTrendPoint & { e1rmKg: number })[];
};

/** Lifts with at least one loaded e1RM, most-logged first, so the picker leads with staples. */
function buildLiftOptions(sessions: WorkoutSession[]): LiftOption[] {
  const ids = new Set<string>();
  for (const session of sessions) {
    for (const performed of session.exercises) ids.add(performed.exerciseId);
  }
  return [...ids]
    .map((id) => ({
      id,
      name: requireExercise(id).name,
      points: buildExerciseTrend(sessions, id).filter(
        (point): point is ExerciseTrendPoint & { e1rmKg: number } => point.e1rmKg != null,
      ),
    }))
    .filter((option) => option.points.length > 0)
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function BigStat({ value, label }: { value: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AnimatedNumber
        value={value}
        style={[typography.jumbo, { color: colors.textPrimary, fontSize: 26, lineHeight: 30 }]}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
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
        landmarks: classification.landmarks,
      };
    })
    .sort(
      (a, b) => b.sets - a.sets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]),
    );
}

type TrendValue = { sessionId: string; date: string; value: number };

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
  units,
}: {
  trendName?: string;
  hasTrend: boolean;
  hasAnyStrengthPoint: boolean;
  trendDelta: number;
  muscleLoads: MuscleLoad[];
  units: 'kg' | 'lb';
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
        ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}${unitLabel(units)} e1RM across the selected window.`
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
        ? `${doseFlag.sets} direct sets this week against a general ${doseFlag.mev}-${doseFlag.mrv} set reference; this is not a personalized recovery limit.`
        : 'Log this week’s sessions to compare direct sets with general reference ranges.',
    },
  ];
}

function buildLineData(
  values: number[],
  baseline: number,
  onSelect: (index: number) => void,
): lineDataItem[] {
  return values.map((value, index) => ({
    value: value - baseline,
    label: '',
    onPress: () => onSelect(index),
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
  inlineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  liftRail: {
    gap: 8,
    paddingHorizontal: 16,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  trendValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  lineChartFrame: {
    width: '100%',
    height: 144,
    overflow: 'hidden',
  },
  emptyChart: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
});
