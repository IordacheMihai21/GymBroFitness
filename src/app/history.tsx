import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Stat } from '@/components/ui/Stat';
import { deleteTemplate, listTemplates } from '@/domain/programs/templateStore';
import type { WorkoutTemplate } from '@/domain/programs/templates';
import { summarizeWorkoutSession, type WorkoutHistorySummary } from '@/domain/workouts/history';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { useTheme } from '@/theme';
import type { Units, WorkoutSession } from '@/types';
import { formatVolumeLoad } from '@/utils/units';

export default function HistoryScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const selectedSessionId = typeof sessionId === 'string' ? sessionId : null;
  const { preferences } = useTrainingProfile();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([listWorkoutHistory(), listTemplates()])
      .then(([nextSessions, nextTemplates]) => {
        if (!mounted) return;
        setSessions(nextSessions);
        setTemplates(nextTemplates);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(refresh);

  const startTemplate = (templateId: string) =>
    router.push({ pathname: '/workout', params: { templateId } });

  const removeTemplate = async (templateId: string) => {
    await deleteTemplate(templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const summaries = useMemo(
    () => sessions.map((session) => summarizeWorkoutSession(session, preferences.units)),
    [preferences.units, sessions],
  );
  const totalVolume = summaries.reduce((total, item) => total + item.volumeKg, 0);
  const totalSets = summaries.reduce((total, item) => total + item.completedSets, 0);
  const leaveHistory = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const goToExercise = (exerciseId: string) => router.push(`/exercise/${exerciseId}`);

  return (
    <Animated.View entering={FadeIn} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={summaries}
        keyExtractor={(item) => item.sessionId}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.xl, paddingBottom: spacing.md }}>
            <View>
              <IconButton
                icon="chevron-left"
                iconColor={colors.textPrimary}
                accessibilityLabel="Back"
                onPress={leaveHistory}
                style={styles.backButton}
              />
              <Text style={[typography.display, { color: colors.textPrimary }]}>History</Text>
            </View>

            <View style={styles.metricRow}>
              <Stat value={String(sessions.length)} label="workouts" />
              <Stat value={String(totalSets)} label="sets" />
              <Stat value={formatVolumeLoad(totalVolume, preferences.units)} label="volume" />
            </View>

            {templates.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  Saved workouts
                </Text>
                <View>
                  {templates.map((template, index) => (
                    <TemplateRow
                      key={template.id}
                      template={template}
                      onStart={() => startTemplate(template.id)}
                      onDelete={() => removeTemplate(template.id)}
                      last={index === templates.length - 1}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {summaries.length > 0 ? (
              <Text style={[typography.heading, { color: colors.textPrimary }]}>Workouts</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                No workouts yet
              </Text>
              <Text style={[typography.body, { color: colors.textMuted }]}>
                Finish a workout and it shows up here with sets, volume, time and every lift.
              </Text>
              <Button mode="contained" onPress={leaveHistory} style={styles.emptyButton}>
                Back to training
              </Button>
            </View>
          )
        }
        renderItem={({ item }) => (
          <HistorySessionCard
            summary={item}
            units={preferences.units}
            onSelectExercise={goToExercise}
            selected={item.sessionId === selectedSessionId}
          />
        )}
      />
    </Animated.View>
  );
}

function HistorySessionCard({
  summary,
  units,
  onSelectExercise,
  selected,
}: {
  summary: WorkoutHistorySummary;
  units: Units;
  onSelectExercise: (exerciseId: string) => void;
  selected: boolean;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const exercises = summary.exerciseSummaries.filter((item) => item.completedSets > 0);

  return (
    <View
      style={[
        styles.session,
        {
          borderTopColor: colors.border,
          paddingVertical: spacing.lg,
          gap: spacing.sm,
        },
        selected && {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderTopColor: 'transparent',
          paddingHorizontal: spacing.md,
          marginHorizontal: -spacing.md,
        },
      ]}
    >
      <View>
        <Text style={[typography.caption, { color: selected ? colors.accent : colors.textMuted }]}>
          {formatDate(summary.startedAt)}
        </Text>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{summary.dayName}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {summary.durationMinutes} min, {summary.completedSets} sets,{' '}
          {formatVolumeLoad(summary.volumeKg, units)}
        </Text>
      </View>

      <View>
        {exercises.map((exercise) => (
          <Pressable
            key={exercise.exerciseId}
            onPress={() => onSelectExercise(exercise.exerciseId)}
            accessibilityRole="button"
            accessibilityLabel={`${exercise.name}, ${exercise.completedSets} sets, best ${exercise.bestSetLabel}`}
            style={({ pressed }) => [styles.exerciseRow, pressed && { opacity: 0.6 }]}
          >
            <Text
              style={[typography.body, { color: colors.textPrimary, flex: 1 }]}
              numberOfLines={1}
            >
              {exercise.completedSets} x {exercise.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {exercise.bestSetLabel}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TemplateRow({
  template,
  onStart,
  onDelete,
  last,
}: {
  template: WorkoutTemplate;
  onStart: () => void;
  onDelete: () => void;
  last: boolean;
}) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.templateRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {template.day.prescriptions.length} exercises, about {template.day.estimatedMinutes} min
        </Text>
      </View>
      <IconButton
        icon="delete-outline"
        size={20}
        iconColor={colors.textMuted}
        accessibilityLabel={`Delete ${template.name}`}
        onPress={onDelete}
      />
      <Button mode="outlined" compact onPress={onStart}>
        Start
      </Button>
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

const styles = StyleSheet.create({
  backButton: {
    marginLeft: -12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  session: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 36,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 64,
    paddingVertical: 6,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
