import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  ProgressBar,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { EXERCISE_CATALOG, getExercise } from '@/domain/exercises/catalog';
import { EXERCISE_LIBRARY, type LibraryExercise } from '@/domain/exercises/library';
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
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { EquipmentType, Exercise, MuscleGroup, Units, WorkoutSession } from '@/types';
import { displayLoad, formatLoad, formatVolumeLoad, unitLabel } from '@/utils/units';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = String(id ?? '');
  const { colors, spacing, typography } = useTheme();
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
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 120,
        gap: spacing.lg,
      }}
    >
      <View style={styles.headerRow}>
        <IconButton
          mode="contained-tonal"
          icon="chevron-left"
          accessibilityLabel="Back"
          onPress={leave}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Exercise dossier</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {resolved.name}
          </Text>
        </View>
        <Chip compact mode="flat" icon="calendar-check">
          {intelligence.totalSessions}
        </Chip>
      </View>

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
  const { colors, radius, spacing, typography } = useTheme();
  const muscles = catalogExercise?.primaryMuscles ?? libraryExercise?.primaryMuscles ?? [];
  const image = libraryExercise?.images[0];

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.lg }}>
        <View style={styles.heroRow}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={[
                styles.heroImage,
                { borderRadius: radius.lg, backgroundColor: colors.surfacePressed },
              ]}
              contentFit="cover"
            />
          ) : null}
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
            <Text style={[typography.micro, { color: colors.accent }]}>Movement profile</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={2}>
              {name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {catalogExercise
                ? `${formatEquipment(catalogExercise.equipment)} · ${trackingLabel(catalogExercise)}`
                : (libraryExercise?.equipmentLabel ?? 'Reference exercise')}
            </Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {muscles.slice(0, 4).map((muscle) => (
            <Chip key={muscle} compact mode="flat" icon="target">
              {MUSCLE_LABELS[muscle]}
            </Chip>
          ))}
          <Chip
            compact
            mode={formAiReady ? 'flat' : 'outlined'}
            icon={formAiReady ? 'camera-outline' : 'camera-off-outline'}
          >
            {formAiReady ? 'Form AI ready' : 'No Form AI'}
          </Chip>
        </View>

        <View style={styles.metricGrid}>
          <MetricBlock label="sessions" value={String(intelligence.totalSessions)} />
          <MetricBlock
            label="best load"
            value={
              intelligence.bestLoadKg != null ? formatLoad(intelligence.bestLoadKg, units) : '--'
            }
          />
          <MetricBlock
            label="e1RM"
            value={
              intelligence.bestE1rmKg != null ? formatLoad(intelligence.bestE1rmKg, units) : '--'
            }
          />
          <MetricBlock label="volume" value={formatVolumeLoad(intelligence.totalVolumeKg, units)} />
        </View>

        <View
          style={[
            styles.nextActionPanel,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
        >
          <Text style={[typography.micro, { color: colors.accent }]}>Next action</Text>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
            {intelligence.nextAction}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Button
            compact
            mode="contained"
            icon="play"
            disabled={!catalogExercise}
            onPress={onStartLift}
            style={styles.actionButton}
          >
            Start lift
          </Button>
          <Button
            compact
            mode="outlined"
            icon="camera-outline"
            disabled={!formAiReady}
            onPress={onFormCheck}
            style={styles.actionButton}
          >
            Form check
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
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
  const { colors, radius, spacing, typography } = useTheme();
  const [chartWidth, setChartWidth] = useState(0);

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Strength trend</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Estimated 1RM
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typography.display, { color: colors.textPrimary }]}>
              {latest ? displayLoad(latest.e1rmKg, units) : '--'}
            </Text>
            <Text style={[typography.micro, { color: colors.textMuted }]}>
              {trendDelta != null
                ? `${trendDelta >= 0 ? '+' : ''}${displayLoad(trendDelta, units)} ${unitLabel(units)}`
                : unitLabel(units)}
            </Text>
          </View>
        </View>

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
                thickness={3}
                color={colors.accent}
                curved={points.length > 2}
                areaChart
                startFillColor={colors.accent}
                endFillColor={colors.accent}
                startOpacity={0.2}
                endOpacity={0.02}
                hideYAxisText
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisLabelWidth={0}
                dataPointsColor={colors.accent}
                dataPointsRadius={4}
                disableScroll
                backgroundColor="transparent"
              />
            ) : null}
          </View>
        ) : (
          <EmptyPanel
            icon="chart-line"
            title={hasAnyTrend ? 'No loaded e1RM yet' : 'No completed sessions yet'}
            description={
              hasAnyTrend
                ? 'This lift has logged work, but no loaded low-rep sets for a reliable e1RM.'
                : 'Finish this exercise once and the trend will appear here.'
            }
          />
        )}
        {points.length > 0 ? (
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            Tap a point to open its source session.
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function ProgressionCard({ target, units }: { target: TargetToBeat | null; units: Units }) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Progression engine</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>Next target</Text>
          </View>
          <Chip compact mode="flat" icon={target ? 'trending-up' : 'radar'}>
            {target ? progressionActionLabel(target.decision.action) : 'calibrate'}
          </Chip>
        </View>

        {target ? (
          <>
            <View
              style={[
                styles.nextActionPanel,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
            >
              <Text style={[typography.micro, { color: colors.accent }]}>Target</Text>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                {formatDecisionTarget(target.decision, units)}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Last: {formatProgressionSignal(target.lastSignal, units)}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {target.decision.explanation}
            </Text>
          </>
        ) : (
          <EmptyPanel
            icon="radar"
            title="No progression target yet"
            description="Finish this lift once with load, reps, and RIR to generate a real target."
          />
        )}
      </Card.Content>
    </Card>
  );
}

function LatestSessionCard({
  session,
  units,
}: {
  session: ExerciseSessionSummary | null;
  units: Units;
}) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Latest work</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              {session?.dayName ?? 'No session yet'}
            </Text>
          </View>
          {session ? (
            <Chip compact mode="flat" icon="calendar">
              {formatDate(session.performedAt)}
            </Chip>
          ) : null}
        </View>

        {session ? (
          <>
            <View style={styles.metricGrid}>
              <MetricBlock label="sets" value={String(session.completedSets)} />
              <MetricBlock label="volume" value={formatVolumeLoad(session.volumeKg, units)} />
              <MetricBlock label="best" value={session.bestSetLabel} />
              <MetricBlock
                label="RIR"
                value={session.averageRir != null ? String(session.averageRir) : '--'}
              />
            </View>
            <View style={{ gap: spacing.xs }}>
              {session.sets.slice(0, 5).map((set) => (
                <SetSnapshotRow key={`${session.sessionId}-${set.setNumber}`} set={set} />
              ))}
            </View>
          </>
        ) : (
          <EmptyPanel
            icon="clipboard-plus-outline"
            title="No work logged"
            description="Start this lift from the action above to build its baseline."
          />
        )}
      </Card.Content>
    </Card>
  );
}

function FormCard({ intelligence }: { intelligence: ExerciseIntelligence }) {
  const { colors, radius, spacing, typography } = useTheme();
  const coverage =
    intelligence.totalSets > 0 ? intelligence.form.analyzedSetCount / intelligence.totalSets : 0;

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Execution quality</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>Form AI</Text>
          </View>
          <Chip compact mode="flat" icon="camera-outline">
            {intelligence.form.averageScore != null
              ? `${intelligence.form.averageScore}/100`
              : 'off'}
          </Chip>
        </View>
        <ProgressBar
          progress={Math.max(0, Math.min(1, coverage))}
          color={colors.accent}
          style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {intelligence.form.analyzedSetCount} analyzed sets · {intelligence.form.analyzedRepCount}{' '}
          reps
        </Text>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
          {intelligence.form.mostCommonIssue ??
            (intelligence.form.averageScore != null
              ? 'No repeated issue detected.'
              : 'Run a supported camera set to attach technique data.')}
        </Text>
      </Card.Content>
    </Card>
  );
}

function CoachingCard({
  catalogExercise,
  libraryExercise,
}: {
  catalogExercise: Exercise | null;
  libraryExercise: LibraryExercise | null;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const instructions = catalogExercise?.instructions ?? libraryExercise?.instructions ?? [];
  const mistakes = catalogExercise?.commonMistakes ?? [];

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View>
          <Text style={[typography.micro, { color: colors.accent }]}>Atlas notes</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>Execution cues</Text>
        </View>

        {instructions.slice(0, 3).map((item, index) => (
          <List.Item
            key={`instruction-${index}`}
            title={`Cue ${index + 1}`}
            description={item}
            left={(props) => (
              <List.Icon {...props} icon="check-circle-outline" color={colors.accent} />
            )}
            titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
            descriptionStyle={[typography.caption, { color: colors.textMuted }]}
          />
        ))}

        {catalogExercise ? (
          <>
            <Divider />
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>Progression</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {catalogExercise.progressionInstructions}
            </Text>
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>Watch for</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {mistakes.slice(0, 3).join(' · ')}
            </Text>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function AlternativesCard({
  exercise,
  onOpenExercise,
}: {
  exercise: Exercise | null;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const alternatives = exercise ? buildAlternatives(exercise) : [];

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View>
          <Text style={[typography.micro, { color: colors.accent }]}>Swap logic</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>Alternatives</Text>
        </View>

        {alternatives.length > 0 ? (
          alternatives.slice(0, 6).map((item, index) => (
            <View key={`${item.reason}-${item.exercise.id}`}>
              <List.Item
                title={item.exercise.name}
                description={`${item.reason} · ${formatMuscles(item.exercise.primaryMuscles)}`}
                onPress={() => onOpenExercise(item.exercise.id)}
                left={(props) => (
                  <List.Icon {...props} icon="swap-horizontal" color={colors.accent} />
                )}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
                )}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              />
              {index < Math.min(alternatives.length, 6) - 1 ? <Divider /> : null}
            </View>
          ))
        ) : (
          <EmptyPanel
            icon="swap-horizontal"
            title="No mapped swaps"
            description="This reference exercise is not in the programmable catalog yet."
          />
        )}
      </Card.Content>
    </Card>
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
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View>
          <Text style={[typography.micro, { color: colors.accent }]}>History</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>Saved sessions</Text>
        </View>
        {sessions.length > 0 ? (
          sessions.slice(0, 8).map((session, index) => (
            <View key={session.sessionId}>
              <List.Item
                title={`${session.dayName} · ${formatDate(session.performedAt)}`}
                description={`${session.completedSets} sets · ${formatVolumeLoad(session.volumeKg, units)} · best ${session.bestSetLabel}`}
                onPress={() => onOpenSession(session.sessionId)}
                left={(props) => <List.Icon {...props} icon="history" color={colors.accent} />}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
                )}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              />
              {index < Math.min(sessions.length, 8) - 1 ? <Divider /> : null}
            </View>
          ))
        ) : (
          <EmptyPanel
            icon="history"
            title="No completed sessions"
            description="Your saved work for this exercise will appear here."
          />
        )}
      </Card.Content>
    </Card>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metricBlock, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.numeric, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SetSnapshotRow({ set }: { set: ExerciseSetSnapshot }) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[styles.setRow, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
        Set {set.setNumber}
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{set.label}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>
        RIR {set.rir ?? '--'}
        {set.formScore != null ? ` · Form ${set.formScore}` : ''}
      </Text>
    </View>
  );
}

function EmptyPanel({
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
      style={[styles.emptyPanel, { backgroundColor: colors.surfaceRaised }]}
    />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroImage: {
    width: 88,
    height: 88,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBlock: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 130,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  nextActionPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  lineChartFrame: {
    width: '100%',
    height: 144,
    overflow: 'hidden',
  },
  progress: {
    height: 7,
    borderRadius: 999,
  },
  setRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
    gap: 2,
  },
  emptyPanel: {
    borderRadius: 14,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
