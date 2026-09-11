import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RestTimer } from '@/components/workout/RestTimer';
import { SetRow } from '@/components/workout/SetRow';
import { requireExercise } from '@/domain/exercises/catalog';
import { DEMO_PREFERENCES, DEMO_USER_ID } from '@/domain/programs/demoPreferences';
import { generateProgram } from '@/domain/programs/generator';
import { startWorkoutSession } from '@/domain/workouts/session';
import { sessionVolumeKg, totalWorkingSets } from '@/domain/workouts/analytics';
import { useTheme } from '@/theme';
import type { PerformedSet, ProgramDay } from '@/types';

export default function WorkoutScreen() {
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const program = useMemo(() => generateProgram(DEMO_PREFERENCES, DEMO_USER_ID), []);
  const dayIndex = Number(dayParam ?? 0);
  const day = program.days[dayIndex] ?? program.days[0];

  // Keying by day.id forces a full remount (fresh session/timer state)
  // whenever the selected day changes, instead of syncing it in an effect.
  return <WorkoutSessionView key={day.id} programName={program.name} day={day} />;
}

function WorkoutSessionView({ programName, day }: { programName: string; day: ProgramDay }) {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState(() => startWorkoutSession(day, DEMO_USER_ID));
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restToken, setRestToken] = useState(0);
  const [finished, setFinished] = useState(false);

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<PerformedSet>) {
    setSession((prev) => {
      const exercises = [...prev.exercises];
      const sets = [...exercises[exerciseIndex].sets];
      sets[setIndex] = { ...sets[setIndex], ...patch };
      exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
      return { ...prev, exercises };
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
      setRestSeconds(exercise.prescription.restSeconds);
      setRestToken((t) => t + 1);
    }
  }

  if (finished) {
    const volume = sessionVolumeKg(session);
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.xl }]}>
        <Text style={[typography.title, { color: colors.textPrimary, textAlign: 'center' }]}>
          Workout complete
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          {totalWorkingSets(session)} working sets · {Math.round(volume)} kg total volume
        </Text>
        <PrimaryButton
          label="Done"
          onPress={() => {
            setSession(startWorkoutSession(day, DEMO_USER_ID));
            setFinished(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 160,
          gap: spacing.lg,
        }}
      >
        <View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{programName}</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{day.name}</Text>
        </View>

        {session.exercises.map((performed, exerciseIndex) => {
          const exercise = requireExercise(performed.exerciseId);
          const { prescription } = performed;
          const targetLabel = `${prescription.minReps}-${prescription.maxReps} reps @ RIR ${prescription.targetRir}`;
          const isCalibrating = performed.sets.every((s) => s.loadKg == null && !s.completed);

          return (
            <View
              key={performed.id}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: radius.xl,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                padding: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                {exercise.name}
              </Text>
              {isCalibrating && (
                <Text style={[typography.caption, { color: colors.accent }]}>
                  No history yet — log whatever feels right for {prescription.minReps}-
                  {prescription.maxReps} reps at RIR {prescription.targetRir}.
                </Text>
              )}
              {performed.sets.map((set, setIndex) => (
                <SetRow
                  key={set.id}
                  set={set}
                  targetLabel={targetLabel}
                  onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)}
                  onToggleComplete={() => toggleComplete(exerciseIndex, setIndex)}
                />
              ))}
            </View>
          );
        })}

        <PrimaryButton label="Finish Workout" fullWidth onPress={() => setFinished(true)} />
      </ScrollView>

      {restSeconds != null && (
        <View
          style={[styles.timerWrap, { bottom: insets.bottom + 96, paddingHorizontal: spacing.lg }]}
        >
          <RestTimer
            key={restToken}
            secondsRemaining={restSeconds}
            onDismiss={() => setRestSeconds(null)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  timerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
