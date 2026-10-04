import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, IconButton, Searchbar, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDemoModal } from '@/components/exercise/ExerciseDemoModal';
import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { Pill } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import { exerciseCandidatesForProgramDay } from '@/domain/programs/programEditing';
import {
  addExerciseToCustomProgramDay,
  createCustomProgramDraft,
  customProgramSaveIssue,
  moveExerciseInCustomProgramDay,
  normalizeCustomProgram,
  removeExerciseFromCustomProgramDay,
  renameCustomProgramDay,
  setCustomProgramDayCount,
} from '@/domain/programs/customProgramBuilder';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { useBackDestination } from '@/hooks/useBackDestination';
import { inputTheme, useTheme } from '@/theme';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type TrainingProgram } from '@/types';

const DAY_COUNT_OPTIONS = [
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
] as const;

type DayCount = (typeof DAY_COUNT_OPTIONS)[number]['value'];

export default function ProgramBuilderScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const backToProgram = useBackDestination('/program');
  const { user, preferences, saveProgram } = useActiveProgram();
  const { scrollRef, inputAnchorRef, onScroll, revealInput } = useKeyboardAwareScroll(
    Math.max(insets.top, spacing.xxl),
  );
  const [draft, setDraft] = useState(() =>
    createCustomProgramDraft({ userId: user.id, preferences, name: 'My Hypertrophy Program' }),
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);
  const selectedDay = draft.days[selectedDayIndex] ?? draft.days[0];
  const saveIssue = customProgramSaveIssue(draft);
  const candidates = useMemo(() => {
    if (!selectedDay) return [];
    return exerciseCandidatesForProgramDay(selectedDay, preferences, query)
      .filter((exercise) =>
        muscleFilter
          ? exercise.primaryMuscles.includes(muscleFilter) ||
            exercise.secondaryMuscles.includes(muscleFilter)
          : true,
      )
      .slice(0, 12);
  }, [muscleFilter, preferences, query, selectedDay]);

  function updateDraft(next: TrainingProgram) {
    setDraft(next);
    setStatus(null);
    if (selectedDayIndex > next.days.length - 1) {
      setSelectedDayIndex(Math.max(0, next.days.length - 1));
    }
  }

  function updateDayCount(days: number) {
    updateDraft(setCustomProgramDayCount(draft, days));
  }

  function addExercise(exercise: Exercise) {
    updateDraft(addExerciseToCustomProgramDay(draft, selectedDayIndex, exercise, preferences));
  }

  function addPreviewedExercise(exercise: Exercise) {
    addExercise(exercise);
    setPreviewExercise(null);
  }

  function removeExercise(index: number) {
    updateDraft(removeExerciseFromCustomProgramDay(draft, selectedDayIndex, index));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    updateDraft(moveExerciseInCustomProgramDay(draft, selectedDayIndex, index, direction));
  }

  async function saveCustomProgram() {
    const issue = customProgramSaveIssue(draft);
    if (issue) {
      setStatus(issue);
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await saveProgram(normalizeCustomProgram({ ...draft, name: draft.name.trim() }));
      backToProgram();
    } catch {
      setStatus('Could not save this program.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <View>
        <IconButton
          icon="chevron-left"
          iconColor={colors.textPrimary}
          accessibilityLabel="Back to plan"
          onPress={backToProgram}
          style={styles.backButton}
        />
        <Text style={[typography.display, { color: colors.textPrimary }]}>Build a plan</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Pick your days, then add exercises to each one.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <TextInput
          theme={inputTheme}
          mode="outlined"
          label="Plan name"
          value={draft.name}
          onChangeText={(name) => updateDraft({ ...draft, name })}
          style={{ backgroundColor: colors.background }}
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Days a week</Text>
          <Segmented
            options={DAY_COUNT_OPTIONS}
            value={String(draft.days.length) as DayCount}
            onChange={(value) => updateDayCount(Number(value))}
          />
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRail}
        >
          {draft.days.map((day, index) => (
            <Pill
              key={day.id}
              label={
                day.prescriptions.length > 0
                  ? `${day.name} (${day.prescriptions.length})`
                  : day.name
              }
              active={selectedDayIndex === index}
              onPress={() => setSelectedDayIndex(index)}
            />
          ))}
        </ScrollView>

        {selectedDay ? (
          <View style={{ gap: spacing.md }}>
            <TextInput
              theme={inputTheme}
              mode="outlined"
              dense
              label="Day name"
              value={selectedDay.name}
              onChangeText={(name) =>
                updateDraft(renameCustomProgramDay(draft, selectedDayIndex, name))
              }
              style={{ backgroundColor: colors.background }}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {selectedDay.prescriptions.length} exercises,{' '}
              {selectedDay.prescriptions.reduce((sum, item) => sum + item.workingSets, 0)} sets,
              about {selectedDay.estimatedMinutes} min
            </Text>

            {selectedDay.prescriptions.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted }]}>
                No exercises yet. Add at least one from the list below.
              </Text>
            ) : (
              <View>
                {selectedDay.prescriptions.map((prescription, index) => {
                  const exercise = requireExercise(prescription.exerciseId);
                  const last = index === selectedDay.prescriptions.length - 1;
                  return (
                    <View
                      key={`${prescription.exerciseId}-${index}`}
                      style={[
                        styles.exerciseRow,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <ExerciseThumbnail exercise={exercise} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[typography.bodyBold, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {exercise.name}
                        </Text>
                        <Text
                          style={[typography.caption, { color: colors.textMuted }]}
                          numberOfLines={2}
                        >
                          {prescription.workingSets} x {prescription.minReps}-{prescription.maxReps}
                          , RIR {prescription.targetRir}. {formatMuscles(exercise.primaryMuscles)}
                        </Text>
                      </View>
                      <View style={styles.rowActions}>
                        <IconButton
                          size={18}
                          icon="chevron-up"
                          iconColor={colors.textMuted}
                          disabled={index === 0}
                          accessibilityLabel={`Move ${exercise.name} up`}
                          onPress={() => moveExercise(index, -1)}
                          style={styles.rowAction}
                        />
                        <IconButton
                          size={18}
                          icon="chevron-down"
                          iconColor={colors.textMuted}
                          disabled={last}
                          accessibilityLabel={`Move ${exercise.name} down`}
                          onPress={() => moveExercise(index, 1)}
                          style={styles.rowAction}
                        />
                        <IconButton
                          size={18}
                          icon="close"
                          iconColor={colors.textMuted}
                          accessibilityLabel={`Remove ${exercise.name}`}
                          onPress={() => removeExercise(index)}
                          style={styles.rowAction}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>
          Add to {selectedDay?.name ?? 'day'}
        </Text>

        <View ref={inputAnchorRef} collapsable={false}>
          <Searchbar
            placeholder="Search exercise, muscle, equipment"
            value={query}
            onChangeText={setQuery}
            onFocus={revealInput}
            mode="bar"
            iconColor={colors.textMuted}
            style={[styles.search, { backgroundColor: colors.surface, borderRadius: radius.lg }]}
            inputStyle={[typography.body, { color: colors.textPrimary, minHeight: 0 }]}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRail}
        >
          <Pill label="All" active={muscleFilter == null} onPress={() => setMuscleFilter(null)} />
          {MUSCLE_GROUPS.map((muscle) => (
            <Pill
              key={muscle}
              label={MUSCLE_LABELS[muscle]}
              active={muscleFilter === muscle}
              onPress={() => setMuscleFilter((current) => (current === muscle ? null : muscle))}
            />
          ))}
        </ScrollView>

        {candidates.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No unused exercise matches this filter with your equipment.
          </Text>
        ) : (
          <View>
            {candidates.map((exercise, index) => (
              <Pressable
                key={exercise.id}
                onPress={() => setPreviewExercise(exercise)}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${exercise.name}`}
                style={({ pressed }) => [
                  styles.exerciseRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth:
                      index === candidates.length - 1 ? 0 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <ExerciseThumbnail exercise={exercise} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[typography.bodyBold, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {exercise.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatMuscles(exercise.primaryMuscles)},{' '}
                    {exercise.movementPattern.replace(/_/g, ' ')}
                  </Text>
                </View>
                <MaterialCommunityIcons name="plus" size={22} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        {status || saveIssue ? (
          <Text style={[typography.caption, { color: status ? colors.warning : colors.textMuted }]}>
            {status ?? saveIssue}
          </Text>
        ) : null}
        <Button
          mode="contained"
          loading={saving}
          disabled={saving || !!saveIssue}
          onPress={saveCustomProgram}
          contentStyle={styles.primaryContent}
        >
          Save and use this plan
        </Button>
      </View>

      <ExerciseDemoModal
        key={previewExercise?.id ?? 'closed'}
        exercise={previewExercise}
        actionLabel={`Add to ${selectedDay?.name ?? 'day'}`}
        onAction={addPreviewedExercise}
        onDismiss={() => setPreviewExercise(null)}
      />
    </Animated.ScrollView>
  );
}

function formatMuscles(muscles: MuscleGroup[]): string {
  return muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: -12,
  },
  dayRail: {
    gap: 8,
    paddingRight: 16,
  },
  search: {
    elevation: 0,
    height: 48,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -8,
  },
  rowAction: {
    margin: 0,
  },
  primaryContent: {
    minHeight: 52,
  },
});
