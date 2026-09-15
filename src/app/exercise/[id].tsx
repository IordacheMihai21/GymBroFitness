import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import { ActivityIndicator, Card, Chip, IconButton, List } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { getExercise } from '@/domain/exercises/catalog';
import { EXERCISE_LIBRARY } from '@/domain/exercises/library';
import { buildExerciseTrend, type ExerciseTrendPoint } from '@/domain/workouts/exerciseTrend';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const exerciseName = useMemo(() => resolveExerciseName(id), [id]);
  const trend = useMemo(() => buildExerciseTrend(history, id), [history, id]);
  const e1rmPoints = trend.filter((p): p is ExerciseTrendPoint & { e1rmKg: number } => p.e1rmKg != null);
  const latest = e1rmPoints.at(-1) ?? null;
  const first = e1rmPoints[0] ?? null;
  const trendDelta = latest && first ? latest.e1rmKg - first.e1rmKg : null;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const lineBaseline = e1rmPoints.length > 0 ? Math.min(...e1rmPoints.map((p) => p.e1rmKg)) - 2 : 0;
  const lineMax = e1rmPoints.length > 0 ? Math.max(...e1rmPoints.map((p) => p.e1rmKg)) - lineBaseline + 2 : 1;
  const lineData: lineDataItem[] = e1rmPoints.map((p) => ({ value: p.e1rmKg - lineBaseline, label: '' }));

  return (
    <Animated.View entering={FadeIn} style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 120,
          gap: spacing.lg,
        }}
      >
        <View style={styles.headerRow}>
          <IconButton mode="contained-tonal" icon="chevron-left" onPress={leave} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Exercise history</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {exerciseName}
            </Text>
          </View>
          <Chip compact mode="flat" icon="calendar-check">
            {trend.length}
          </Chip>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : e1rmPoints.length === 0 ? (
          <Card
            mode="contained"
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}
          >
            <Card.Content style={{ gap: spacing.sm }}>
              <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                No loaded sessions yet
              </Text>
              <Text style={[typography.body, { color: colors.textMuted }]}>
                Log a completed set with weight and reps for {exerciseName} and its e1RM trend will show here.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <Card
            mode="contained"
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}
          >
            <Card.Content style={{ gap: spacing.md }}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={[typography.micro, { color: colors.accent }]}>Strength trend</Text>
                  <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                    Estimated 1RM (Epley)
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.display, { color: colors.textPrimary }]}>
                    {Math.round(latest!.e1rmKg)}
                  </Text>
                  <Text style={[typography.micro, { color: colors.textMuted }]}>
                    {trendDelta != null ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)} kg` : 'kg e1RM'}
                  </Text>
                </View>
              </View>

              <View style={styles.lineChartFrame}>
                <LineChart
                  data={lineData}
                  height={130}
                  width={300}
                  maxValue={lineMax}
                  spacing={lineData.length > 1 ? 280 / (lineData.length - 1) : 0}
                  initialSpacing={0}
                  endSpacing={0}
                  thickness={3}
                  color={colors.accent}
                  curved={lineData.length > 2}
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
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>Sessions</Text>
          {[...trend].reverse().map((point) => (
            <List.Item
              key={point.sessionId}
              title={formatDate(point.date)}
              description={
                point.e1rmKg != null
                  ? `${point.completedSets} sets · ${formatVolume(point.volumeKg)} · e1RM ${Math.round(point.e1rmKg)} kg`
                  : `${point.completedSets} sets · ${formatVolume(point.volumeKg)}`
              }
              left={(props) => <List.Icon {...props} icon="dumbbell" color={colors.accent} />}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={[styles.sessionRow, { backgroundColor: colors.surfaceRaised, borderRadius: radius.md }]}
            />
          ))}
          {!loading && trend.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>
              No completed sessions for this exercise yet.
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * The workout engine only ever prescribes/logs exercises from the curated
 * `EXERCISE_CATALOG`, but this screen is also reachable by tapping any of
 * the 800+ browse-only `EXERCISE_LIBRARY` entries (free-exercise-db import) —
 * a disjoint id namespace. Resolve whichever dataset actually has the id
 * rather than assuming the catalog, so browsing a library-only exercise
 * shows its name and an honest "no sessions" state instead of crashing.
 */
function resolveExerciseName(id: string): string {
  return getExercise(id)?.name ?? EXERCISE_LIBRARY.find((e) => e.id === id)?.name ?? 'Exercise';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Saved session';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatVolume(volumeKg: number): string {
  return volumeKg >= 1000 ? `${(volumeKg / 1000).toFixed(1)}t` : `${Math.round(volumeKg)}kg`;
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
  lineChartFrame: {
    width: '100%',
    height: 144,
    overflow: 'hidden',
  },
  sessionRow: {
    paddingVertical: 4,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
