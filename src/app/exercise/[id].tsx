import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import { ActivityIndicator, Button, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ListRow } from '@/components/ui/ListRow';
import { Stat } from '@/components/ui/Stat';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { EXERCISE_CATALOG, getExercise, isAutoProgrammed } from '@/domain/exercises/catalog';
import {
  EXERCISE_LIBRARY,
  preferredLibraryImages,
  referenceExerciseForCatalog,
  type LibraryExercise,
} from '@/domain/exercises/library';
import { ExerciseDemoStage } from '@/components/exercise/ExerciseDemoStage';
import { buildExerciseTrend, type ExerciseTrendPoint } from '@/domain/workouts/exerciseTrend';
import {
  buildExerciseIntelligence,
  type ExerciseIntelligence,
  type ExerciseSessionSummary,
  type ExerciseSetSnapshot,
} from '@/domain/workouts/exerciseIntelligence';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import {
  buildLatestExerciseProgressionTarget,
  formatDecisionTarget,
  formatProgressionSignal,
  progressionActionLabel,
  type TargetToBeat,
} from '@/domain/workouts/targetToBeat';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import { sideBalance, type SideBalance } from '@/domain/workouts/sides';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { EquipmentType, Exercise, MuscleGroup, Units, WorkoutSession } from '@/types';
import { displayLoad, formatLoad, formatVolumeLoad, unitLabel } from '@/utils/units';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = String(id ?? '');
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences } = useActiveProgram();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      listWorkoutHistory()
        .then((next) => {
          if (mounted) setHistory(next);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const resolved = useMemo(() => resolveExercise(exerciseId), [exerciseId]);
  const intelligence = useMemo(
    () => buildExerciseIntelligence(history, exerciseId, preferences.units),
    [exerciseId, history, preferences.units],
  );
  const trend = useMemo(() => buildExerciseTrend(history, exerciseId), [history, exerciseId]);
  const progressionTarget = useMemo(
    () =>
      buildLatestExerciseProgressionTarget({
        exerciseId,
        history,
        userExperience: preferences.experience,
        nutritionContext: preferences.nutritionContext,
      }),
    [exerciseId, history, preferences.experience, preferences.nutritionContext],
  );
  const e1rmPoints = trend.filter(
    (p): p is ExerciseTrendPoint & { e1rmKg: number } => p.e1rmKg != null,
  );
  const chartPoints = e1rmPoints.slice(-8);
  const chartDisplayPoints = chartPoints.map((point) => ({
    ...point,
    e1rmKg: displayLoad(point.e1rmKg, preferences.units) ?? 0,
  }));
  const latest = e1rmPoints.at(-1) ?? null;
  const first = e1rmPoints[0] ?? null;
  const trendDelta = latest && first ? latest.e1rmKg - first.e1rmKg : null;
  const formConfig = resolved.catalogExercise
    ? getVisionConfigForMovementPattern(resolved.catalogExercise.movementPattern)
    : undefined;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const lineBaseline =
    chartDisplayPoints.length > 0 ? Math.min(...chartDisplayPoints.map((p) => p.e1rmKg)) - 2 : 0;
  const lineMax =
    chartDisplayPoints.length > 0
      ? Math.max(...chartDisplayPoints.map((p) => p.e1rmKg)) - lineBaseline + 2
      : 1;
  const lineData: lineDataItem[] = chartDisplayPoints.map((p) => ({
    value: p.e1rmKg - lineBaseline,
    label: '',
    onPress: () => router.push({ pathname: '/history', params: { sessionId: p.sessionId } }),
  }));

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 120,
        gap: spacing.xl,
      }}
    >
      <IconButton
        icon="chevron-left"
        iconColor={colors.textPrimary}
        accessibilityLabel="Back"
        onPress={leave}
        style={styles.backButton}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <HeroCard
            name={resolved.name}
            catalogExercise={resolved.catalogExercise}
            libraryExercise={resolved.libraryExercise}
            intelligence={intelligence}
            units={preferences.units}
            formAiReady={!!formConfig}
            onStartLift={() =>
              resolved.catalogExercise &&
              router.push({
                pathname: '/workout',
                params: {
                  custom: '1',
                  ids: resolved.catalogExercise.id,
                  name: resolved.catalogExercise.name,
                },
              })
            }
            onFormCheck={() =>
              resolved.catalogExercise &&
              router.push({
                pathname: '/form-check/[exerciseId]',
                params: { exerciseId: resolved.catalogExercise.id },
              })
            }
          />

          <TrendCard
            points={lineData}
            lineMax={lineMax}
            latest={latest}
            trendDelta={trendDelta}
            hasAnyTrend={trend.length > 0}
            units={preferences.units}
          />

          <ProgressionCard target={progressionTarget} units={preferences.units} />

          <SideBalanceCard balance={sideBalance(history, exerciseId)} />

          <LatestSessionCard session={intelligence.latestSession} units={preferences.units} />

          <FormCard intelligence={intelligence} />

          <CoachingCard
            catalogExercise={resolved.catalogExercise}
            libraryExercise={resolved.libraryExercise}
          />

          <AlternativesCard
            exercise={resolved.catalogExercise}
            onOpenExercise={(nextId) => router.push(`/exercise/${nextId}`)}
          />

          <SessionsCard
            sessions={intelligence.sessions}
            units={preferences.units}
            onOpenSession={(sourceSessionId) =>
              router.push({ pathname: '/history', params: { sessionId: sourceSessionId } })
            }
          />
        </>
      )}
    </Animated.ScrollView>
  );
}

function HeroCard({
  name,
  catalogExercise,
  libraryExercise,
  intelligence,
  units,
  formAiReady,
  onStartLift,
  onFormCheck,
}: {
  name: string;
  catalogExercise: Exercise | null;
  libraryExercise: LibraryExercise | null;
  intelligence: ExerciseIntelligence;
  units: Units;
  formAiReady: boolean;
  onStartLift: () => void;
  onFormCheck: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const muscles = catalogExercise?.primaryMuscles ?? libraryExercise?.primaryMuscles ?? [];
  // The same demonstration source the library and workout use: RepDB for
  // catalog exercises, then the reference dataset.
  const demoImages = catalogExercise
    ? (referenceExerciseForCatalog(catalogExercise)?.images ?? [])
    : libraryExercise
      ? preferredLibraryImages(libraryExercise)
      : [];
  const meta = [
    formatMuscles(muscles.slice(0, 4)),
    catalogExercise
      ? `${formatEquipment(catalogExercise.equipment)}, ${trackingLabel(catalogExercise).toLowerCase()}`
      : (libraryExercise?.equipmentLabel ?? 'Reference exercise'),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.heroRow}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <Text style={[typography.display, { color: colors.textPrimary }]}>{name}</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{meta}</Text>
          {catalogExercise && !isAutoProgrammed(catalogExercise) ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Add it to workouts yourself. Automatic plans stick to the core exercise set.
            </Text>
          ) : null}
          {formAiReady ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Form AI supported</Text>
          ) : null}
        </View>
      </View>

      {demoImages.length > 0 ? <ExerciseDemoStage images={demoImages} exerciseName={name} /> : null}

      <View style={styles.statRow}>
        <Stat value={String(intelligence.totalSessions)} label="sessions" />
        <Stat
          value={intelligence.bestLoadKg != null ? formatLoad(intelligence.bestLoadKg, units) : '-'}
          label="best load"
        />
        <Stat
          value={intelligence.bestE1rmKg != null ? formatLoad(intelligence.bestE1rmKg, units) : '-'}
          label="best e1RM"
          emphasis={intelligence.bestE1rmKg != null}
        />
      </View>

      <View style={[styles.note, { borderLeftColor: colors.accent }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Next time</Text>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
          {intelligence.nextAction}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Button
          mode="contained"
          disabled={!catalogExercise}
          onPress={onStartLift}
          style={styles.actionButton}
          contentStyle={styles.actionContent}
        >
          Start this lift
        </Button>
        {formAiReady ? (
          <Button
            mode="outlined"
            onPress={onFormCheck}
            style={styles.actionButton}
            contentStyle={styles.actionContent}
          >
            Form check
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.headerRow}>
        <Text style={[typography.heading, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  const { colors, typography } = useTheme();
  return <Text style={[typography.caption, { color: colors.textMuted }]}>{children}</Text>;
}

function TrendCard({
  points,
  lineMax,
  latest,
  trendDelta,
  hasAnyTrend,
  units,
}: {
  points: lineDataItem[];
  lineMax: number;
  latest: (ExerciseTrendPoint & { e1rmKg: number }) | null;
  trendDelta: number | null;
  hasAnyTrend: boolean;
  units: Units;
}) {
  const { colors, typography } = useTheme();
  const [chartWidth, setChartWidth] = useState(0);

  return (
    <Section title="Estimated 1RM">
      {latest ? (
        <View style={styles.trendValueRow}>
          <Text style={[typography.jumbo, { color: colors.textPrimary }]}>
            {displayLoad(latest.e1rmKg, units)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {trendDelta != null
              ? `${unitLabel(units)}, ${trendDelta >= 0 ? '+' : ''}${displayLoad(trendDelta, units)} since first`
              : unitLabel(units)}
          </Text>
        </View>
      ) : null}

      {points.length > 0 ? (
        <View
          style={styles.lineChartFrame}
          onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
        >
          {chartWidth > 0 ? (
            <LineChart
              data={points}
              height={130}
              width={Math.max(1, chartWidth - 8)}
              maxValue={lineMax}
              spacing={points.length > 1 ? (chartWidth - 16) / (points.length - 1) : 0}
              initialSpacing={0}
              endSpacing={0}
              thickness={2}
              color={colors.accent}
              curved={points.length > 2}
              areaChart
              startFillColor={colors.accent}
              endFillColor={colors.accent}
              startOpacity={0.16}
              endOpacity={0}
              hideRules
              hideYAxisText
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisLabelWidth={0}
              dataPointsColor={colors.accent}
              dataPointsRadius={3}
              disableScroll
              backgroundColor="transparent"
            />
          ) : null}
        </View>
      ) : (
        <EmptyText>
          {hasAnyTrend
            ? 'Logged, but no loaded low-rep sets yet, so there is no reliable e1RM.'
            : 'Finish this exercise once and the trend shows up here.'}
        </EmptyText>
      )}
      {points.length > 0 ? <EmptyText>Tap a point to open that workout.</EmptyText> : null}
    </Section>
  );
}

/** "Load jumps held: 3 of 4. Next jump comes a rep early." from what the engine learned. */
function jumpLine(target: TargetToBeat): string | null {
  const held = target.decision.supportingMetrics.loadJumpsHeld;
  const mode = target.decision.supportingMetrics.loadJumpMode;
  if (typeof held !== 'string') return null;
  const [kept, total] = held.split('/').map(Number);
  if (!total) return null;
  const tail =
    mode === 'early'
      ? ' Next jump comes a rep early.'
      : mode === 'patient'
        ? ' Next jump waits for a confirming session.'
        : '';
  return `Load jumps held: ${kept} of ${total}.${tail}`;
}

/** Left vs right for exercises logged one side at a time; hidden until there is data. */
function SideBalanceCard({ balance }: { balance: SideBalance | null }) {
  const { colors, typography } = useTheme();
  if (!balance) return null;
  const weakerLabel = balance.weaker === 'left' ? 'Left' : 'Right';
  return (
    <Section
      title="Left vs right"
      right={
        <Text
          style={[
            typography.captionBold,
            { color: balance.weaker ? colors.warning : colors.success },
          ]}
        >
          {balance.weaker ? `${weakerLabel} ${balance.gapPercent}% behind` : 'Balanced'}
        </Text>
      }
    >
      <Text style={[typography.title, { color: colors.textPrimary }]}>
        {balance.leftReps} L · {balance.rightReps} R
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        Reps over {balance.sets} sets in the last {balance.sessions}{' '}
        {balance.sessions === 1 ? 'session' : 'sessions'}.
      </Text>
      <EmptyText>
        {balance.weaker
          ? `Start each set with your ${weakerLabel.toLowerCase()} side and stop the other side at the same reps. Progression already follows the weaker side.`
          : 'Both sides are within 5% of each other. Keep starting with your weaker side.'}
      </EmptyText>
    </Section>
  );
}

function ProgressionCard({ target, units }: { target: TargetToBeat | null; units: Units }) {
  const { colors, typography } = useTheme();

  return (
    <Section
      title="Next target"
      right={
        target ? (
          <Text style={[typography.captionBold, { color: colors.accent }]}>
            {progressionActionLabel(target.decision.action)}
          </Text>
        ) : null
      }
    >
      {target ? (
        <>
          <Text style={[typography.title, { color: colors.textPrimary }]}>
            {formatDecisionTarget(target.decision, units)}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Last time: {formatProgressionSignal(target.lastSignal, units)}
          </Text>
          {jumpLine(target) ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {jumpLine(target)}
            </Text>
          ) : null}
          <EmptyText>{target.decision.explanation}</EmptyText>
        </>
      ) : (
        <EmptyText>Finish this lift once with load, reps and RIR to get a target.</EmptyText>
      )}
    </Section>
  );
}

function LatestSessionCard({
  session,
  units,
}: {
  session: ExerciseSessionSummary | null;
  units: Units;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Section
      title="Last session"
      right={
        session ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {session.dayName}, {formatDate(session.performedAt)}
          </Text>
        ) : null
      }
    >
      {session ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.statRow}>
            <Stat value={String(session.completedSets)} label="sets" />
            <Stat value={formatVolumeLoad(session.volumeKg, units)} label="volume" />
            <Stat
              value={session.averageRir != null ? String(session.averageRir) : '-'}
              label="avg RIR"
            />
          </View>
          <View>
            {session.sets.slice(0, 5).map((set, index, shown) => (
              <SetSnapshotRow
                key={`${session.sessionId}-${set.setNumber}`}
                set={set}
                last={index === shown.length - 1}
              />
            ))}
          </View>
        </View>
      ) : (
        <EmptyText>Nothing logged yet. Start this lift to set a baseline.</EmptyText>
      )}
    </Section>
  );
}

function FormCard({ intelligence }: { intelligence: ExerciseIntelligence }) {
  const { colors, typography } = useTheme();

  return (
    <Section
      title="Form"
      right={
        intelligence.form.averageScore != null ? (
          <Text style={[typography.numeric, { color: colors.textPrimary }]}>
            {intelligence.form.averageScore}/100
          </Text>
        ) : null
      }
    >
      <EmptyText>
        {intelligence.form.averageScore != null
          ? `${intelligence.form.analyzedSetCount} sets and ${intelligence.form.analyzedRepCount} reps analyzed. ${intelligence.form.mostCommonIssue ?? 'No repeated issue.'}`
          : 'Film a set with Form check to see technique scores here.'}
      </EmptyText>
    </Section>
  );
}

function CoachingCard({
  catalogExercise,
  libraryExercise,
}: {
  catalogExercise: Exercise | null;
  libraryExercise: LibraryExercise | null;
}) {
  const { colors, spacing, typography } = useTheme();
  const instructions = catalogExercise?.instructions ?? libraryExercise?.instructions ?? [];
  const mistakes = catalogExercise?.commonMistakes ?? [];

  return (
    <Section title="How to do it">
      <View style={{ gap: spacing.md }}>
        {instructions.slice(0, 3).map((item, index) => (
          <View key={`instruction-${index}`} style={styles.cueRow}>
            <Text style={[typography.numeric, { color: colors.textMuted, width: 20 }]}>
              {index + 1}
            </Text>
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </View>

      {catalogExercise ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>How to progress</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {catalogExercise.progressionInstructions}
          </Text>
          {mistakes.length > 0 ? (
            <>
              <Text
                style={[typography.bodyBold, { color: colors.textPrimary, marginTop: spacing.sm }]}
              >
                Watch for
              </Text>
              {mistakes.slice(0, 3).map((mistake) => (
                <Text key={mistake} style={[typography.body, { color: colors.textSecondary }]}>
                  {mistake}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </Section>
  );
}

function AlternativesCard({
  exercise,
  onOpenExercise,
}: {
  exercise: Exercise | null;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const alternatives = exercise ? buildAlternatives(exercise) : [];
  const shown = alternatives.slice(0, 6);

  return (
    <Section title="Alternatives">
      {shown.length > 0 ? (
        <View>
          {shown.map((item, index) => (
            <ListRow
              key={`${item.reason}-${item.exercise.id}`}
              title={item.exercise.name}
              subtitle={`${item.reason}, ${formatMuscles(item.exercise.primaryMuscles)}`}
              onPress={() => onOpenExercise(item.exercise.id)}
              last={index === shown.length - 1}
            />
          ))}
        </View>
      ) : (
        <EmptyText>This reference exercise is not in the programmable catalog yet.</EmptyText>
      )}
    </Section>
  );
}

function SessionsCard({
  sessions,
  units,
  onOpenSession,
}: {
  sessions: ExerciseSessionSummary[];
  units: Units;
  onOpenSession: (sessionId: string) => void;
}) {
  const shown = sessions.slice(0, 8);

  return (
    <Section title="History">
      {shown.length > 0 ? (
        <View>
          {shown.map((session, index) => (
            <ListRow
              key={session.sessionId}
              title={`${formatDate(session.performedAt)}, ${session.dayName}`}
              subtitle={`${session.completedSets} sets, ${formatVolumeLoad(session.volumeKg, units)}, best ${session.bestSetLabel}`}
              onPress={() => onOpenSession(session.sessionId)}
              last={index === shown.length - 1}
            />
          ))}
        </View>
      ) : (
        <EmptyText>Your saved work for this exercise shows up here.</EmptyText>
      )}
    </Section>
  );
}

function SetSnapshotRow({ set, last }: { set: ExerciseSetSnapshot; last: boolean }) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.setRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[typography.numeric, { color: colors.textMuted, width: 24 }]}>
        {set.setNumber}
      </Text>
      <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{set.label}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        RIR {set.rir ?? '-'}
        {set.formScore != null ? `, form ${set.formScore}` : ''}
      </Text>
    </View>
  );
}

function resolveExercise(id: string): {
  name: string;
  catalogExercise: Exercise | null;
  libraryExercise: LibraryExercise | null;
} {
  const catalogExercise = getExercise(id) ?? null;
  const libraryExercise =
    EXERCISE_LIBRARY.find((exercise) => exercise.id === id) ??
    EXERCISE_LIBRARY.find((exercise) => exercise.name === catalogExercise?.name) ??
    null;

  return {
    name: catalogExercise?.name ?? libraryExercise?.name ?? 'Exercise',
    catalogExercise,
    libraryExercise,
  };
}

function buildAlternatives(exercise: Exercise): { reason: string; exercise: Exercise }[] {
  const seen = new Set<string>();
  const collect = (reason: string, slugs: string[]) =>
    slugs.flatMap((slug) => {
      const next = EXERCISE_CATALOG.find((candidate) => candidate.slug === slug);
      if (!next || seen.has(next.id)) return [];
      seen.add(next.id);
      return [{ reason, exercise: next }];
    });

  return [
    ...collect('Equivalent', exercise.equivalentAlternatives),
    ...collect('Easier', exercise.easierAlternatives),
    ...collect('Harder', exercise.harderAlternatives),
  ];
}

function trackingLabel(exercise: Exercise): string {
  switch (exercise.trackingType) {
    case 'weight_reps':
      return 'Load + reps';
    case 'bodyweight_reps':
      return 'Bodyweight reps';
    case 'weighted_bodyweight':
      return 'Weighted bodyweight';
    case 'time':
      return 'Timed hold';
  }
}

function formatEquipment(equipment: EquipmentType[]): string {
  if (equipment.length === 0) return 'No equipment';
  return equipment
    .slice(0, 3)
    .map((item) => item.replaceAll('_', ' '))
    .join(', ');
}

function formatMuscles(muscles: MuscleGroup[]): string {
  return muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Saved session';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: -12,
    marginBottom: -8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  note: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  actionContent: {
    minHeight: 50,
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
  cueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 8,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
