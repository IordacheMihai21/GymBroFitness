import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ElementRef, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarSeries, type BarDatum } from '@/components/charts/BarSeries';
import { ProgressRing } from '@/components/charts/ProgressRing';
import { Sparkline } from '@/components/charts/Sparkline';
import { ExerciseStrip, type StripItem } from '@/components/home/ExerciseStrip';
import { HomeActionSheet, type HomeSheet } from '@/components/home/HomeActionSheet';
import { RecoveryMap } from '@/components/home/RecoveryMap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ListRow } from '@/components/ui/ListRow';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { Reveal } from '@/components/ui/Reveal';
import { Tile } from '@/components/ui/Tile';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { listBodyMeasurements } from '@/domain/body/bodyTrackingStore';
import type { BodyMeasurementEntry } from '@/domain/body/measurements';
import { requireExercise } from '@/domain/exercises/catalog';
import { dailyQuote } from '@/domain/motivation/dailyQuote';
import {
  bodyweightSnapshot,
  muscleFreshness,
  pickTodayPlan,
  weeklyVolumeSeries,
} from '@/domain/workouts/dashboard';
import type { WeekLogEntry } from '@/domain/workouts/demoHistory';
import { summarizeWorkoutSession } from '@/domain/workouts/history';
import { buildPlannedWeek, buildWorkoutHistoryInsights } from '@/domain/workouts/historyInsights';
import { getInProgressWorkoutSession, listWorkoutHistory } from '@/domain/workouts/historyStore';
import { buildProgressionTarget, formatDecisionTarget } from '@/domain/workouts/targetToBeat';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';
import { formatDate, formatMinutes } from '@/utils/dates';
import { displayLoad, formatLoad, formatVolumeLoad, unitLabel } from '@/utils/units';

const GAP = 12;

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const actionSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const { user, preferences, program } = useActiveProgram();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [activeDraft, setActiveDraft] = useState<WorkoutSession | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const [dayOverride, setDayOverride] = useState<number | null>(null);
  const [activeSheet, setActiveSheet] = useState<HomeSheet | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<BarDatum | null>(null);
  const todayPlan = useMemo(
    () => pickTodayPlan(program.days, preferences.preferredDays, history),
    [history, preferences.preferredDays, program.days],
  );
  const dayIndex = Math.min(dayOverride ?? todayPlan.dayIndex, program.days.length - 1);
  const day = program.days[dayIndex];
  const swapIndex = (dayIndex + 1) % program.days.length;
  const quote = useMemo(() => dailyQuote(), []);
  const units = preferences.units;
  const contentWidth = width - spacing.lg * 2;
  const halfWidth = (contentWidth - GAP) / 2;
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([
        listWorkoutHistory(),
        getInProgressWorkoutSession(),
        listBodyMeasurements().catch(() => []),
      ]).then(([nextHistory, draft, nextMeasurements]) => {
        if (!mounted) return;
        setHistory(nextHistory);
        setActiveDraft(draft);
        setMeasurements(nextMeasurements);
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
  const freshness = useMemo(() => muscleFreshness(history), [history]);
  const weekly = useMemo(() => weeklyVolumeSeries(history, 8), [history]);
  const bodyweight = useMemo(() => bodyweightSnapshot(measurements), [measurements]);
  const lastSession = useMemo(
    () =>
      insights.completedSessions[0]
        ? summarizeWorkoutSession(insights.completedSessions[0], units)
        : null,
    [insights.completedSessions, units],
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
  const records = useMemo(
    () =>
      [...insights.personalRecords]
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 3),
    [insights.personalRecords],
  );

  const totalSets = day.prescriptions.reduce((sum, p) => sum + p.workingSets, 0);
  const sessionsDone = insights.weekLog.filter((entry) => entry.status === 'done').length;
  const draftProgress = activeDraft ? sessionProgress(activeDraft) : null;
  const stripItems: StripItem[] = activeDraft
    ? activeDraft.exercises.map((performed) => {
        const done = performed.sets.filter((set) => set.completed && !set.skipped).length;
        return {
          key: performed.id,
          exercise: requireExercise(performed.exerciseId),
          detail: `${done}/${performed.sets.length} sets`,
          done: performed.sets.length > 0 && done >= performed.sets.length,
        };
      })
    : day.prescriptions.map((prescription, index) => ({
        key: `${prescription.exerciseId}-${index}`,
        exercise: requireExercise(prescription.exerciseId),
        detail: `${prescription.workingSets} × ${
          prescription.minReps === prescription.maxReps
            ? prescription.minReps
            : `${prescription.minReps}-${prescription.maxReps}`
        }`,
      }));

  const weekBars: BarDatum[] = weekly.map((point, index) => {
    const start = new Date(`${point.weekStart}T00:00:00`);
    return {
      key: point.weekStart,
      value: point.volumeKg,
      label: index === weekly.length - 1 ? 'Now' : `${start.getDate()}/${start.getMonth() + 1}`,
      detail: formatVolumeLoad(point.volumeKg, units),
      sessions: point.sessions,
    };
  });
  const thisWeek = weekly.at(-1);
  const lastWeek = weekly.at(-2);
  const volumeDelta =
    thisWeek && lastWeek && lastWeek.volumeKg > 0
      ? Math.round(((thisWeek.volumeKg - lastWeek.volumeKg) / lastWeek.volumeKg) * 100)
      : null;
  const shownWeek = selectedWeek ?? weekBars.at(-1) ?? null;
  const trend = insights.strengthTrend;
  const trendValues = trend?.points.map((point) => displayLoad(point.e1rmKg, units) ?? 0) ?? [];
  const tileInner = halfWidth - spacing.lg * 2;

  function startDay(index: number) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/workout', params: { day: String(index) } });
  }

  function openSheet(sheet: HomeSheet) {
    void Haptics.selectionAsync();
    setActiveSheet(sheet);
    requestAnimationFrame(() => actionSheetRef.current?.present());
  }

  function confirmSwap() {
    setDayOverride(swapIndex);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    actionSheetRef.current?.dismiss();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.x5l,
          paddingHorizontal: spacing.lg,
          gap: GAP,
        }}
      >
        <View style={styles.topRow}>
          <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>{today}</Text>
          <Pressable
            onPress={() => openSheet('streak')}
            accessibilityRole="button"
            accessibilityLabel={`${insights.streakDays} day streak`}
            hitSlop={8}
            style={[styles.streak, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons
              name="fire"
              size={16}
              color={insights.streakDays > 0 ? colors.warning : colors.textMuted}
            />
            <Text style={[typography.numeric, { color: colors.textPrimary, fontSize: 14 }]}>
              {insights.streakDays}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={[
              styles.avatar,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
              {user.displayName.slice(0, 1).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <Reveal index={0}>
          <Tile glow style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Text
                style={[
                  typography.captionBold,
                  {
                    color: activeDraft
                      ? colors.accent
                      : todayPlan.status === 'done' && dayOverride == null
                        ? colors.success
                        : colors.textSecondary,
                  },
                ]}
              >
                {activeDraft
                  ? 'In progress'
                  : todayPlan.status === 'today' || dayOverride != null
                    ? `Today, ${user.displayName}`
                    : `${todayPlan.status === 'done' ? 'Done for today' : 'Rest day'}. Next ${nextLabel(todayPlan.daysAway)}`}
              </Text>
              <Text style={[typography.display, { color: colors.textPrimary }]} numberOfLines={2}>
                {activeDraft?.dayName ?? day.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {draftProgress
                  ? `${draftProgress.done} of ${draftProgress.planned} sets done`
                  : day.focus.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}
              </Text>
            </View>

            {draftProgress ? (
              <ProgressLine
                progress={draftProgress.done / Math.max(1, draftProgress.planned)}
                spring
                height={4}
              />
            ) : (
              <View style={styles.heroStats}>
                <HeroStat value={String(day.prescriptions.length)} label="exercises" />
                <HeroStat value={String(totalSets)} label="sets" />
                <HeroStat value={`~${day.estimatedMinutes}`} label="min" />
              </View>
            )}

            <ExerciseStrip
              items={stripItems}
              onPressItem={(exercise) =>
                router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })
              }
            />

            {activeDraft ? null : (
              <View style={[styles.targetRow, { backgroundColor: colors.surfaceRaised }]}>
                <MaterialCommunityIcons name="target" size={18} color={colors.accent} />
                <Text
                  style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
                  numberOfLines={1}
                >
                  {target.exerciseName}
                </Text>
                <Text style={[typography.numeric, { color: colors.textPrimary, fontSize: 15 }]}>
                  {target.lastSignal ? formatDecisionTarget(target.decision, units) : 'Calibrate'}
                </Text>
              </View>
            )}

            <View style={{ gap: spacing.xs }}>
              <Button
                mode="contained"
                onPress={() => (activeDraft ? router.push('/workout') : startDay(dayIndex))}
                contentStyle={styles.primaryButton}
                labelStyle={typography.bodyBold}
              >
                {activeDraft
                  ? activeDraft.reviewStartedAt
                    ? 'Review workout'
                    : 'Resume workout'
                  : 'Start workout'}
              </Button>
              {activeDraft ? null : (
                <View style={styles.secondaryRow}>
                  <Button
                    mode="text"
                    compact
                    textColor={colors.textSecondary}
                    onPress={() => openSheet('swap')}
                  >
                    Switch to {program.days[swapIndex].name}
                  </Button>
                  <Button
                    mode="text"
                    compact
                    textColor={colors.textSecondary}
                    onPress={() => router.push('/custom-workout')}
                  >
                    Custom
                  </Button>
                </View>
              )}
            </View>
          </Tile>
        </Reveal>

        <Reveal index={1}>
          <Tile title="This week" onPress={() => router.push('/analytics')}>
            <View style={styles.weekRow}>
              <ProgressRing progress={sessionsDone / Math.max(1, plannedWeek.length)} size={78}>
                <AnimatedNumber
                  value={`${sessionsDone}/${plannedWeek.length}`}
                  style={[typography.numeric, { color: colors.textPrimary, fontSize: 18 }]}
                />
                <Text style={[typography.micro, { color: colors.textMuted }]}>sessions</Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: spacing.md }}>
                <WeekStrip entries={insights.weekLog} />
                <View style={styles.statsRow}>
                  <MiniStat value={formatVolumeLoad(insights.weekVolumeKg, units)} label="volume" />
                  <MiniStat
                    value={
                      insights.rirSetCount > 0
                        ? `${Math.round(insights.intensityMatchPct * 100)}%`
                        : '-'
                    }
                    label="RIR on target"
                  />
                </View>
              </View>
            </View>
          </Tile>
        </Reveal>

        <Reveal index={2}>
          <Tile
            title="Recovery"
            onPress={() => router.push('/body')}
            accessibilityLabel="Muscle recovery, open Body"
          >
            <RecoveryMap freshness={freshness} />
          </Tile>
        </Reveal>

        <Reveal index={3} style={styles.pair}>
          <Tile
            title="Strength"
            containerStyle={{ width: halfWidth }}
            onPress={
              trend
                ? () =>
                    router.push({ pathname: '/exercise/[id]', params: { id: trend.exerciseId } })
                : () => router.push('/analytics')
            }
            accessibilityLabel={trend ? `${trend.exerciseName} estimated 1RM` : 'Strength trend'}
          >
            {trend ? (
              <View style={{ gap: spacing.sm }}>
                <View>
                  <AnimatedNumber
                    value={`${displayLoad(trend.latestKg, units) ?? 0}`}
                    style={[typography.jumbo, styles.tileNumber, { color: colors.textPrimary }]}
                  />
                  <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={1}>
                    {unitLabel(units)} e1RM, {trend.exerciseName}
                  </Text>
                </View>
                <Sparkline values={trendValues} width={tileInner} height={40} />
                {trendValues.length < 2 ? (
                  <Text style={[typography.micro, { color: colors.textMuted }]}>
                    One session so far
                  </Text>
                ) : (
                  <Delta
                    value={displayLoad(trend.deltaKg, units) ?? 0}
                    suffix={` ${unitLabel(units)}`}
                  />
                )}
              </View>
            ) : (
              <EmptyTile icon="chart-line" text="Log a loaded lift twice to see your e1RM trend." />
            )}
          </Tile>
          <Tile
            title="Bodyweight"
            containerStyle={{ width: halfWidth }}
            onPress={() => router.push('/body-log')}
            accessibilityLabel="Bodyweight, open body log"
          >
            {bodyweight ? (
              <View style={{ gap: spacing.sm }}>
                <View>
                  <AnimatedNumber
                    value={`${displayLoad(bodyweight.latestKg, units) ?? 0}`}
                    style={[typography.jumbo, styles.tileNumber, { color: colors.textPrimary }]}
                  />
                  <Text style={[typography.micro, { color: colors.textMuted }]}>
                    {unitLabel(units)}, {formatDate(bodyweight.date)}
                  </Text>
                </View>
                <Sparkline
                  values={bodyweight.series}
                  width={tileInner}
                  height={40}
                  color={colors.textSecondary}
                />
                {bodyweight.deltaKg != null ? (
                  <Delta
                    value={displayLoad(bodyweight.deltaKg, units) ?? 0}
                    suffix={` ${unitLabel(units)}`}
                    neutral
                  />
                ) : null}
              </View>
            ) : (
              <EmptyTile icon="scale-bathroom" text="Weigh in to start your trend." />
            )}
          </Tile>
        </Reveal>

        <Reveal index={4}>
          <Tile
            title="Volume, last 8 weeks"
            aside={
              volumeDelta != null ? (
                <Text
                  style={[
                    typography.captionBold,
                    { color: volumeDelta >= 0 ? colors.success : colors.textMuted },
                  ]}
                >
                  {volumeDelta >= 0 ? '+' : ''}
                  {volumeDelta}% vs last week
                </Text>
              ) : null
            }
          >
            <View style={{ gap: 2 }}>
              <AnimatedNumber
                value={shownWeek?.detail ?? formatVolumeLoad(0, units)}
                style={[typography.jumbo, styles.tileNumber, { color: colors.textPrimary }]}
              />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {shownWeek
                  ? `${shownWeek.label === 'Now' ? 'This week' : `Week of ${shownWeek.label}`}, ${shownWeek.sessions} ${shownWeek.sessions === 1 ? 'session' : 'sessions'}`
                  : 'No sessions yet'}
              </Text>
            </View>
            <BarSeries data={weekBars} height={72} onSelect={setSelectedWeek} />
          </Tile>
        </Reveal>

        {lastSession ? (
          <Reveal index={5}>
            <Tile
              title="Last session"
              aside={
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {formatDate(lastSession.startedAt)}
                </Text>
              }
              onPress={() =>
                router.push({ pathname: '/history', params: { sessionId: lastSession.sessionId } })
              }
            >
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                {lastSession.dayName}
              </Text>
              <View style={styles.statsRow}>
                <MiniStat value={formatMinutes(lastSession.durationMinutes)} label="duration" />
                <MiniStat value={String(lastSession.completedSets)} label="sets" />
                <MiniStat value={formatVolumeLoad(lastSession.volumeKg, units)} label="volume" />
              </View>
              {lastSession.exerciseSummaries
                .filter((item) => item.completedSets > 0)
                .slice(0, 3)
                .map((item) => (
                  <View key={item.exerciseId} style={styles.bestRow}>
                    <Text
                      style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[typography.numeric, { color: colors.textPrimary, fontSize: 13 }]}>
                      {item.bestSetLabel}
                    </Text>
                  </View>
                ))}
            </Tile>
          </Reveal>
        ) : null}

        <Reveal index={6}>
          <Tile
            title="Recent records"
            aside={
              <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.warning} />
            }
          >
            {records.length === 0 ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Finish a loaded workout and your best lifts land here.
              </Text>
            ) : (
              <View>
                {records.map((record, index) => (
                  <ListRow
                    key={record.id}
                    title={requireExercise(record.exerciseId).name}
                    subtitle={formatDate(record.date)}
                    value={
                      record.loadKg != null && record.reps != null
                        ? `${formatLoad(record.loadKg, units)} × ${record.reps}`
                        : formatLoad(record.value, units)
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/exercise/[id]',
                        params: { id: record.exerciseId },
                      })
                    }
                    last={index === records.length - 1}
                  />
                ))}
              </View>
            )}
          </Tile>
        </Reveal>

        <Reveal
          index={7}
          style={{ gap: spacing.xs, paddingTop: spacing.md, paddingHorizontal: spacing.xs }}
        >
          <Text style={[typography.body, { color: colors.textMuted, fontStyle: 'italic' }]}>
            “{quote.text}”
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{quote.author}</Text>
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

function nextLabel(daysAway: number): string {
  if (daysAway <= 1) return 'tomorrow';
  const date = new Date();
  date.setDate(date.getDate() + daysAway);
  return `on ${date.toLocaleDateString(undefined, { weekday: 'long' })}`;
}

function sessionProgress(session: WorkoutSession) {
  return {
    done: session.exercises.reduce(
      (total, exercise) =>
        total + exercise.sets.filter((set) => set.completed && !set.skipped).length,
      0,
    ),
    planned: session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0),
  };
}

function HeroStat({ value, label }: { value: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.heroStat}>
      <AnimatedNumber
        value={value}
        style={[typography.jumbo, { color: colors.textPrimary, fontSize: 26, lineHeight: 30 }]}
      />
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AnimatedNumber
        value={value}
        style={[typography.numeric, { color: colors.textPrimary, fontSize: 15 }]}
      />
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Delta({
  value,
  suffix,
  neutral = false,
}: {
  value: number;
  suffix: string;
  neutral?: boolean;
}) {
  const { colors, typography } = useTheme();
  const up = value > 0;
  const color = neutral || value === 0 ? colors.textSecondary : up ? colors.success : colors.danger;
  return (
    <View style={styles.delta}>
      <MaterialCommunityIcons
        name={value === 0 ? 'minus' : up ? 'arrow-top-right' : 'arrow-bottom-right'}
        size={14}
        color={color}
      />
      <Text style={[typography.captionBold, { color }]}>
        {up ? '+' : ''}
        {Number(value.toFixed(1))}
        {suffix}
      </Text>
    </View>
  );
}

function EmptyTile({
  icon,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.emptyTile}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.textMuted} />
      <Text style={[typography.caption, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const WEEKDAY_INDEX = (new Date().getDay() + 6) % 7; // Monday = 0, matching the week log

function WeekStrip({ entries }: { entries: WeekLogEntry[] }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.weekStrip}>
      {entries.map((entry, index) => {
        const done = entry.status === 'done';
        const isToday = entry.status === 'today' || index === WEEKDAY_INDEX;
        const planned = entry.status === 'upcoming' || entry.status === 'today';
        return (
          <View
            key={entry.label}
            style={styles.weekDay}
            accessible
            accessibilityLabel={`${entry.label}${isToday ? ', today' : ''}: ${done ? `done, ${entry.splitName}` : planned ? `planned, ${entry.splitName}` : 'rest'}`}
          >
            <Text
              style={[typography.micro, { color: isToday ? colors.textPrimary : colors.textMuted }]}
            >
              {entry.label.slice(0, 1)}
            </Text>
            <View
              style={[
                styles.weekDot,
                done
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : planned
                    ? { borderColor: isToday ? colors.textPrimary : colors.borderStrong }
                    : { borderColor: 'transparent', backgroundColor: colors.surfaceRaised },
              ]}
            >
              {done ? (
                <MaterialCommunityIcons name="check" size={12} color={colors.onAccent} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    marginBottom: 4,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  primaryButton: {
    minHeight: 52,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pair: {
    flexDirection: 'row',
    gap: GAP,
  },
  tileNumber: {
    fontSize: 28,
    lineHeight: 32,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  emptyTile: {
    gap: 8,
    minHeight: 104,
    justifyContent: 'center',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    gap: 6,
  },
  weekDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
