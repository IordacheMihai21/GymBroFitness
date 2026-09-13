import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Divider, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RestTimer } from '@/components/workout/RestTimer';
import { SetRow } from '@/components/workout/SetRow';
import { getExercise, requireExercise } from '@/domain/exercises/catalog';
import { DEMO_PREFERENCES, DEMO_USER_ID } from '@/domain/programs/demoPreferences';
import { generateProgram } from '@/domain/programs/generator';
import {
  detectPersonalRecords,
  sessionVolumeKg,
} from '@/domain/workouts/analytics';
import { DEMO_PERSONAL_RECORDS } from '@/domain/workouts/demoHistory';
import { summarizeWorkoutSession } from '@/domain/workouts/history';
import { saveWorkoutSession } from '@/domain/workouts/historyStore';
import { startWorkoutSession } from '@/domain/workouts/session';
import { useTheme } from '@/theme';
import type { PerformedExercise, PerformedSet, ProgramDay, WorkoutSession } from '@/types';

export default function WorkoutScreen() {
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const program = useMemo(() => generateProgram(DEMO_PREFERENCES, DEMO_USER_ID), []);
  const dayIndex = Number(dayParam ?? 0);
  const day = program.days[dayIndex] ?? program.days[0];

  return <WorkoutSessionView key={day.id} programName={program.name} day={day} />;
}

function WorkoutSessionView({ programName, day }: { programName: string; day: ProgramDay }) {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const safeTop = Math.max(insets.top, spacing.xxl);

  const [session, setSession] = useState(() => startWorkoutSession(day, DEMO_USER_ID));
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restToken, setRestToken] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newRecordCount, setNewRecordCount] = useState(0);

  const activeExercise = session.exercises[activeExerciseIndex] ?? session.exercises[0];
  const activeExerciseMeta = requireExercise(activeExercise.exerciseId);
  const activePrescription = activeExercise.prescription;
  const plannedSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = countCompletedSets(session.exercises);
  const progress = plannedSets > 0 ? completedSets / plannedSets : 0;
  const volume = sessionVolumeKg(session);
  const activeCompletedSets = activeExercise.sets.filter((set) => set.completed && !set.skipped).length;
  const targetLabel = `${activePrescription.minReps}-${activePrescription.maxReps} @ RIR ${activePrescription.targetRir}`;

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<PerformedSet>) {
    setSession((prev) => {
      const exercises = [...prev.exercises];
      const sets = [...exercises[exerciseIndex].sets];
      sets[setIndex] = { ...sets[setIndex], ...patch };
      exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
      return { ...prev, exercises };
    });
  }

  function copyPreviousSet(exerciseIndex: number, setIndex: number) {
    const previous = session.exercises[exerciseIndex]?.sets[setIndex - 1];
    if (!previous) return;
    Haptics.selectionAsync();
    updateSet(exerciseIndex, setIndex, {
      loadKg: previous.loadKg,
      reps: previous.reps,
      rir: previous.rir,
      durationSeconds: previous.durationSeconds,
    });
  }

  function toggleComplete(exerciseIndex: number, setIndex: number) {
    const exercise = session.exercises[exerciseIndex];
    const set = exercise.sets[setIndex];
    const nowCompleting = !set.completed;
    updateSet(exerciseIndex, setIndex, {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : null,
    });

    if (nowCompleting) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRestSeconds(exercise.prescription.restSeconds);
      setRestToken((t) => t + 1);
    }

    if (nowCompleting && setIndex === exercise.sets.length - 1) {
      const next = nextOpenExerciseIndex(session.exercises, exerciseIndex);
      if (next != null) setActiveExerciseIndex(next);
    }
  }

  async function finishSession() {
    if (isSaving || completedSets === 0) return;
    setIsSaving(true);
    setSaveError(null);

    const completedSession: WorkoutSession = {
      ...session,
      status: 'completed',
      finishedAt: new Date().toISOString(),
    };

    try {
      const saved = await saveWorkoutSession(completedSession);
      const records = detectPersonalRecords(saved, DEMO_PERSONAL_RECORDS, getExercise);
      setSession(saved);
      setNewRecordCount(records.length);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSession(completedSession);
      setSaveError('Session finished, but local history could not be updated.');
    } finally {
      setFinished(true);
      setIsSaving(false);
    }
  }

  if (finished) {
    const summary = summarizeWorkoutSession(session);

    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.xl }]}>
        <Card
          mode="contained"
          style={[
            styles.completeCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.micro, { color: colors.accent }]}>Session saved</Text>
              <Text style={[typography.title, { color: colors.textPrimary }]}>
                {day.name} complete
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {summary.completedSets} working sets logged with {formatVolume(summary.volumeKg)} total volume.
              </Text>
            </View>
            <View style={styles.completionStats}>
              <Chip compact mode="flat" icon="timer-check-outline">
                {summary.durationMinutes} min
              </Chip>
              <Chip compact mode="flat" icon="dumbbell">
                {summary.exerciseCount} lifts
              </Chip>
              {newRecordCount > 0 && (
                <Chip compact mode="flat" icon="trophy-outline">
                  {newRecordCount} PR
                </Chip>
              )}
            </View>
            {saveError != null && (
              <Text style={[typography.caption, { color: colors.warning }]}>{saveError}</Text>
            )}
            <ProgressBar
              progress={1}
              color={colors.accent}
              style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
            />
            <Button mode="contained-tonal" icon="history" onPress={() => router.push('/history')}>
              View history
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setSession(startWorkoutSession(day, DEMO_USER_ID));
                setActiveExerciseIndex(0);
                setFinished(false);
                setSaveError(null);
                setNewRecordCount(0);
              }}
            >
              Start another run
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: safeTop + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 220,
          gap: spacing.lg,
        }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{programName}</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{day.name}</Text>
          </View>
          <Button
            compact
            mode="contained-tonal"
            icon="flag-checkered"
            onPress={finishSession}
            disabled={completedSets === 0 || isSaving}
            loading={isSaving}
          >
            Finish
          </Button>
        </View>

        <Card
          mode="contained"
          style={[
            styles.commandCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.metricRow}>
              <Metric label="sets" value={`${completedSets}/${plannedSets}`} />
              <Metric label="volume" value={formatVolume(volume)} />
              <Metric label="rest" value={restSeconds != null ? formatRest(restSeconds) : 'ready'} />
            </View>
            <ProgressBar
              progress={progress}
              color={colors.accent}
              style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
            />
          </Card.Content>
        </Card>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exerciseRail}
        >
          {session.exercises.map((performed, index) => {
            const exercise = requireExercise(performed.exerciseId);
            const done = isExerciseDone(performed);
            return (
              <Chip
                key={performed.id}
                mode={index === activeExerciseIndex ? 'flat' : 'outlined'}
                selected={index === activeExerciseIndex}
                icon={done ? 'check' : 'dumbbell'}
                onPress={() => setActiveExerciseIndex(index)}
              >
                {shortExerciseName(exercise.name)}
              </Chip>
            );
          })}
        </ScrollView>

        <Card
          mode="contained"
          style={[
            styles.activeCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.header}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.micro, { color: colors.accent }]}>
                  Active lift · {activeCompletedSets}/{activeExercise.sets.length} sets
                </Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {activeExerciseMeta.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {targetLabel} · rest {formatRest(activePrescription.restSeconds)}
                </Text>
              </View>
              <Chip compact mode="flat" icon="timer-outline">
                {formatRest(activePrescription.restSeconds)}
              </Chip>
            </View>

            <Divider />

            <View style={styles.navigationRow}>
              <Button
                mode="contained-tonal"
                icon="chevron-left"
                onPress={() => setActiveExerciseIndex(Math.max(0, activeExerciseIndex - 1))}
                disabled={activeExerciseIndex === 0}
                style={styles.navButton}
              >
                Prev
              </Button>
              <Button
                mode="contained"
                icon="chevron-right"
                contentStyle={styles.nextButtonContent}
                onPress={() =>
                  setActiveExerciseIndex(Math.min(session.exercises.length - 1, activeExerciseIndex + 1))
                }
                disabled={activeExerciseIndex === session.exercises.length - 1}
                style={styles.navButton}
              >
                Next lift
              </Button>
            </View>

            <View style={{ gap: spacing.sm }}>
              {activeExercise.sets.map((set, setIndex) => (
                <SetRow
                  key={set.id}
                  set={set}
                  targetLabel={targetLabel}
                  onChange={(patch) => updateSet(activeExerciseIndex, setIndex, patch)}
                  onToggleComplete={() => toggleComplete(activeExerciseIndex, setIndex)}
                  onCopyPrevious={
                    setIndex > 0 ? () => copyPreviousSet(activeExerciseIndex, setIndex) : undefined
                  }
                />
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card mode="outlined">
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Session order
            </Text>
            {session.exercises.map((performed, index) => {
              const exercise = requireExercise(performed.exerciseId);
              const done = isExerciseDone(performed);
              return (
                <Button
                  key={performed.id}
                  mode={index === activeExerciseIndex ? 'contained-tonal' : 'text'}
                  icon={done ? 'check-circle' : 'circle-outline'}
                  onPress={() => setActiveExerciseIndex(index)}
                  contentStyle={styles.orderButtonContent}
                >
                  {index + 1}. {exercise.name}
                </Button>
              );
            })}
          </Card.Content>
        </Card>
      </ScrollView>

      {restSeconds != null && (
        <RestTimer
          key={restToken}
          secondsRemaining={restSeconds}
          onDismiss={() => setRestSeconds(null)}
          bottomOffset={insets.bottom + 96}
        />
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function countCompletedSets(exercises: PerformedExercise[]): number {
  return exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed && !set.skipped).length,
    0,
  );
}

function isExerciseDone(exercise: PerformedExercise): boolean {
  return exercise.sets.every((set) => set.completed || set.skipped);
}

function nextOpenExerciseIndex(
  exercises: PerformedExercise[],
  currentIndex: number,
): number | null {
  for (let i = currentIndex + 1; i < exercises.length; i += 1) {
    if (!isExerciseDone(exercises[i])) return i;
  }
  return null;
}

function shortExerciseName(name: string): string {
  return name
    .replace(/^Barbell /, '')
    .replace(/^Dumbbell /, 'DB ')
    .replace('Romanian Deadlift', 'RDL');
}

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, '0')}`;
}

function formatVolume(volumeKg: number): string {
  return volumeKg >= 1000 ? `${(volumeKg / 1000).toFixed(1)}t` : `${Math.round(volumeKg)}kg`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  commandCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  completeCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  completionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  exerciseRail: {
    gap: 8,
    paddingRight: 16,
  },
  activeCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    flex: 1,
  },
  nextButtonContent: {
    flexDirection: 'row-reverse',
  },
  orderButtonContent: {
    justifyContent: 'flex-start',
  },
});
