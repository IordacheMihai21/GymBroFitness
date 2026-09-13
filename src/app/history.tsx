import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, IconButton, List } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { summarizeWorkoutSession, type WorkoutHistorySummary } from '@/domain/workouts/history';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';

export default function HistoryScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      listWorkoutHistory()
        .then((next) => {
          if (mounted) setSessions(next);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const summaries = useMemo(() => sessions.map(summarizeWorkoutSession), [sessions]);
  const totalVolume = summaries.reduce((total, item) => total + item.volumeKg, 0);
  const totalSets = summaries.reduce((total, item) => total + item.completedSets, 0);
  const leaveHistory = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Animated.View entering={FadeIn} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={summaries}
        keyExtractor={(item) => item.sessionId}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 120,
          gap: spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            <View style={styles.headerRow}>
              <IconButton
                mode="contained-tonal"
                icon="chevron-left"
                onPress={leaveHistory}
              />
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Saved training log
                </Text>
                <Text style={[typography.title, { color: colors.textPrimary }]}>History</Text>
              </View>
              <Chip compact mode="flat" icon="history">
                {sessions.length}
              </Chip>
            </View>

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
                <View style={styles.metricRow}>
                  <HistoryMetric label="sessions" value={String(sessions.length)} />
                  <HistoryMetric label="sets" value={String(totalSets)} />
                  <HistoryMetric label="volume" value={formatVolume(totalVolume)} />
                </View>
              </Card.Content>
            </Card>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : (
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
                <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                  No saved sessions yet
                </Text>
                <Text style={[typography.body, { color: colors.textMuted }]}>
                  Finish a workout and it will show here with sets, volume, duration, and lift breakdown.
                </Text>
                <Button mode="contained" icon="dumbbell" onPress={leaveHistory}>
                  Back to training
                </Button>
              </Card.Content>
            </Card>
          )
        }
        renderItem={({ item }) => <HistorySessionCard summary={item} />}
      />
    </Animated.View>
  );
}

function HistorySessionCard({ summary }: { summary: WorkoutHistorySummary }) {
  const { colors, radius, spacing, typography } = useTheme();
  const topExercises = summary.exerciseSummaries.filter((item) => item.completedSets > 0).slice(0, 3);

  return (
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
          <View style={{ flex: 1 }}>
            <Text style={[typography.micro, { color: colors.accent }]}>
              {formatDate(summary.startedAt)}
            </Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>{summary.dayName}</Text>
          </View>
          <Chip compact mode="flat" icon="timer-outline">
            {summary.durationMinutes} min
          </Chip>
        </View>

        <View style={styles.chipRow}>
          <Chip compact mode="outlined">
            {summary.completedSets} sets
          </Chip>
          <Chip compact mode="outlined">
            {summary.exerciseCount} lifts
          </Chip>
          <Chip compact mode="outlined">
            {formatVolume(summary.volumeKg)}
          </Chip>
        </View>

        <View style={{ gap: spacing.xs }}>
          {topExercises.map((exercise) => (
            <List.Item
              key={exercise.exerciseId}
              title={exercise.name}
              description={`${exercise.completedSets} sets · ${formatVolume(exercise.volumeKg)} · best ${exercise.bestSetLabel}`}
              left={(props) => <List.Icon {...props} icon="dumbbell" color={colors.accent} />}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={styles.compactListItem}
            />
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.display, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
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
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactListItem: {
    paddingVertical: 0,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
