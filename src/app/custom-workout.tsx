import { useMemo, useState, type ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, IconButton, Searchbar, TextInput } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDemoModal } from '@/components/exercise/ExerciseDemoModal';
import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { Pill } from '@/components/ui/Pill';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { availableExercises, isAutoProgrammed, requireExercise } from '@/domain/exercises/catalog';
import { saveTemplate } from '@/domain/programs/templateStore';
import { buildTemplateFromProgramDay } from '@/domain/programs/templates';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import { validateCustomWorkoutSelection } from '@/domain/workouts/customWorkoutSelection';
import { buildCustomWorkoutDay } from '@/features/workout/workout.helpers';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { inputTheme, useTheme } from '@/theme';
import type { EquipmentType, Exercise, MuscleGroup } from '@/types';
import { MUSCLE_GROUPS } from '@/types';

export default function CustomWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    ids?: string | string[];
    name?: string | string[];
  }>();
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { preferences, loading } = useActiveProgram();
  const { scrollRef, inputAnchorRef, onScroll, revealInput } = useKeyboardAwareScroll(
    Math.max(insets.top, spacing.xxl),
  );
  const [name, setName] = useState(() => firstParam(params.name) || 'Custom Workout');
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | null>(null);
  const [selectedExerciseIdsOverride, setSelectedExerciseIdsOverride] = useState<string[] | null>(
    null,
  );
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const routeSelection = useMemo(
    () =>
      loading ? null : validateCustomWorkoutSelection(routeExerciseIds(params.ids), preferences),
    [loading, params.ids, preferences],
  );
  const selectedExerciseIds = useMemo(
    () => selectedExerciseIdsOverride ?? routeSelection?.ids ?? [],
    [routeSelection, selectedExerciseIdsOverride],
  );
  const routeSelectionIssue = routeSelection?.issue ?? null;

  const selectedSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);
  const previewAlreadySelected = previewExercise ? selectedSet.has(previewExercise.id) : false;
  const candidates = useMemo(() => {
    const excludedSlugs = [
      ...preferences.excludedExerciseSlugs,
      ...preferences.discomfortExerciseSlugs,
    ];
    const normalizedQuery = query.trim().toLowerCase();

    return availableExercises(preferences.equipment, excludedSlugs, { includeExtended: true })
      .filter((exercise) => !selectedSet.has(exercise.id))
      .filter((exercise) => matchesQuery(exercise, normalizedQuery))
      .filter((exercise) =>
        muscleFilter
          ? exercise.primaryMuscles.includes(muscleFilter) ||
            exercise.secondaryMuscles.includes(muscleFilter)
          : true,
      )
      .filter((exercise) => (equipmentFilter ? exercise.equipment.includes(equipmentFilter) : true))
      .sort(
        (a, b) =>
          scoreExercise(b, preferences.musclePriorities) -
            scoreExercise(a, preferences.musclePriorities) || a.name.localeCompare(b.name),
      )
      .slice(0, 18);
  }, [equipmentFilter, muscleFilter, preferences, query, selectedSet]);

  const selectedExercises = useMemo(
    () => selectedExerciseIds.map((id) => requireExercise(id)),
    [selectedExerciseIds],
  );
  const totalSets = selectedExercises.reduce(
    (sum, exercise) => sum + (exercise.exerciseType === 'compound' ? 3 : 2),
    0,
  );
  const formAiCount = selectedExercises.filter((exercise) =>
    getVisionConfigForMovementPattern(exercise.movementPattern),
  ).length;

  function addExercise(exercise: Exercise) {
    setSelectedExerciseIdsOverride((current) =>
      (current ?? selectedExerciseIds).includes(exercise.id)
        ? (current ?? selectedExerciseIds)
        : [...(current ?? selectedExerciseIds), exercise.id],
    );
    setPreviewExercise(null);
    setSaveStatus(null);
    Haptics.selectionAsync();
  }

  function removeExercise(index: number) {
    setSelectedExerciseIdsOverride((current) =>
      (current ?? selectedExerciseIds).filter((_, candidateIndex) => candidateIndex !== index),
    );
    setSaveStatus(null);
    Haptics.selectionAsync();
  }

  function moveExercise(index: number, direction: -1 | 1) {
    setSelectedExerciseIdsOverride((current) => {
      const source = current ?? selectedExerciseIds;
      const nextIndex = Math.min(source.length - 1, Math.max(0, index + direction));
      if (nextIndex === index) return current;
      const next = [...source];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setSaveStatus(null);
    Haptics.selectionAsync();
  }

  function startCustomWorkout() {
    if (selectedExerciseIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/workout',
      params: {
        custom: '1',
        ids: selectedExerciseIds.join(','),
        name: name.trim() || 'Custom Workout',
      },
    });
  }

  async function saveCustomWorkout() {
    const workoutName = name.trim() || 'Custom Workout';
    const day = buildCustomWorkoutDay({
      enabled: true,
      idsParam: selectedExerciseIds.join(','),
      nameParam: workoutName,
      preferences,
    });
    if (!day) return;

    setSavingWorkout(true);
    setSaveStatus(null);
    try {
      const template = buildTemplateFromProgramDay(day, workoutName);
      const saved = await saveTemplate(
        savedTemplateId ? { ...template, id: savedTemplateId } : template,
      );
      setSavedTemplateId(saved.id);
      setSaveStatus(`“${saved.name}” saved in Plan.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSaveStatus('Could not save this workout. Try again.');
    } finally {
      setSavingWorkout(false);
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
        paddingBottom: insets.bottom + 96,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <View>
        <IconButton
          icon="chevron-left"
          iconColor={colors.textPrimary}
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={[typography.display, { color: colors.textPrimary }]}>New workout</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {selectedExercises.length === 0
            ? 'Pick exercises below.'
            : `${selectedExercises.length} ${selectedExercises.length === 1 ? 'exercise' : 'exercises'}, about ${totalSets} sets${formAiCount > 0 ? `, ${formAiCount} with Form AI` : ''}`}
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <TextInput
          theme={inputTheme}
          mode="outlined"
          dense
          label="Workout name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setSaveStatus(null);
          }}
          style={{ backgroundColor: colors.background }}
        />

        <View style={styles.primaryActions}>
          <Button
            mode="outlined"
            loading={savingWorkout}
            disabled={selectedExerciseIds.length === 0 || savingWorkout}
            onPress={saveCustomWorkout}
            contentStyle={styles.startButton}
            style={styles.primaryAction}
          >
            {savedTemplateId ? 'Update saved' : 'Save'}
          </Button>
          <Button
            mode="contained"
            disabled={selectedExerciseIds.length === 0 || savingWorkout}
            onPress={startCustomWorkout}
            contentStyle={styles.startButton}
            style={styles.primaryActionWide}
          >
            Start workout
          </Button>
        </View>

        {saveStatus ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              typography.caption,
              { color: saveStatus.startsWith('Could not') ? colors.danger : colors.success },
            ]}
          >
            {saveStatus}
          </Text>
        ) : null}

        {routeSelectionIssue ? (
          <View
            style={[styles.routeIssue, { borderLeftColor: colors.warning }]}
            accessibilityRole="alert"
          >
            <Text style={[typography.captionBold, { color: colors.warning }]}>Not added</Text>
            <Text style={[typography.caption, { color: colors.textPrimary }]}>
              {routeSelectionIssue}
            </Text>
          </View>
        ) : null}
      </View>

      <BuilderSection title="Order">
        {selectedExercises.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Nothing picked yet. This runs as a one-off workout unless you save it.
          </Text>
        ) : (
          selectedExercises.map((exercise, index) => (
            <View key={`${exercise.id}-${index}`}>
              <View style={styles.selectedRow}>
                <View style={styles.orderColumn}>
                  <IconButton
                    icon="chevron-up"
                    size={16}
                    iconColor={colors.textMuted}
                    disabled={index === 0}
                    accessibilityLabel={`Move ${exercise.name} up`}
                    onPress={() => moveExercise(index, -1)}
                    style={styles.orderButton}
                  />
                  <IconButton
                    icon="chevron-down"
                    size={16}
                    iconColor={colors.textMuted}
                    disabled={index === selectedExercises.length - 1}
                    accessibilityLabel={`Move ${exercise.name} down`}
                    onPress={() => moveExercise(index, 1)}
                    style={styles.orderButton}
                  />
                </View>
                <Text style={[typography.numeric, { color: colors.textMuted, width: 20 }]}>
                  {index + 1}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                    {exercise.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {muscleLabels(exercise.primaryMuscles)}, {equipmentLabels(exercise.equipment)}
                    {getVisionConfigForMovementPattern(exercise.movementPattern) ? ', Form AI' : ''}
                  </Text>
                </View>
                <IconButton
                  icon="play-circle-outline"
                  size={20}
                  iconColor={colors.textSecondary}
                  accessibilityLabel={`Preview ${exercise.name} technique`}
                  onPress={() => setPreviewExercise(exercise)}
                  style={styles.removeButton}
                />
                <IconButton
                  icon="close"
                  size={20}
                  iconColor={colors.textMuted}
                  accessibilityLabel={`Remove ${exercise.name}`}
                  onPress={() => removeExercise(index)}
                  style={styles.removeButton}
                />
              </View>
              {index < selectedExercises.length - 1 ? (
                <View style={[styles.hairline, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
          ))
        )}
      </BuilderSection>

      <BuilderSection title="Add exercises">
        <View ref={inputAnchorRef} collapsable={false}>
          <Searchbar
            placeholder="Search exercise, muscle, machine"
            value={query}
            onChangeText={setQuery}
            onFocus={revealInput}
            mode="bar"
            style={[styles.search, { backgroundColor: colors.surface, borderRadius: radius.lg }]}
            inputStyle={[typography.body, { color: colors.textPrimary, minHeight: 0 }]}
            iconColor={colors.textMuted}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <Pill
            label="All muscles"
            active={muscleFilter == null}
            onPress={() => setMuscleFilter(null)}
          />
          {MUSCLE_GROUPS.map((muscle) => (
            <Pill
              key={muscle}
              label={MUSCLE_LABELS[muscle]}
              active={muscleFilter === muscle}
              onPress={() => setMuscleFilter((current) => (current === muscle ? null : muscle))}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <Pill
            label="All equipment"
            active={equipmentFilter == null}
            onPress={() => setEquipmentFilter(null)}
          />
          {preferences.equipment.map((equipment) => (
            <Pill
              key={equipment}
              label={formatEquipment(equipment)}
              active={equipmentFilter === equipment}
              onPress={() =>
                setEquipmentFilter((current) => (current === equipment ? null : equipment))
              }
            />
          ))}
        </ScrollView>

        {candidates.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No exercise matches the current filters.
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
                  styles.catalogRow,
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
                    {muscleLabels(exercise.primaryMuscles)}, {equipmentLabels(exercise.equipment)}
                    {getVisionConfigForMovementPattern(exercise.movementPattern) ? ', Form AI' : ''}
                  </Text>
                </View>
                <MaterialCommunityIcons name="plus" size={22} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </BuilderSection>

      <ExerciseDemoModal
        key={previewExercise?.id ?? 'closed'}
        exercise={previewExercise}
        actionLabel={previewAlreadySelected ? 'Done' : 'Add to workout'}
        actionIcon={previewAlreadySelected ? 'check' : 'playlist-plus'}
        onAction={previewAlreadySelected ? () => setPreviewExercise(null) : addExercise}
        onDismiss={() => setPreviewExercise(null)}
      />
    </Animated.ScrollView>
  );
}

function BuilderSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

function matchesQuery(exercise: Exercise, query: string): boolean {
  if (!query) return true;
  const haystack = [
    exercise.name,
    exercise.slug,
    ...exercise.aliases,
    ...exercise.primaryMuscles,
    ...exercise.secondaryMuscles,
    ...exercise.equipment,
  ]
    .join(' ')
    .replace(/_/g, ' ')
    .toLowerCase();
  return haystack.includes(query);
}

function scoreExercise(exercise: Exercise, priorities: MuscleGroup[]): number {
  // Curated exercises carry full coaching data, so they lead ties.
  let score = (exercise.exerciseType === 'compound' ? 8 : 0) + (isAutoProgrammed(exercise) ? 4 : 0);
  for (const muscle of exercise.primaryMuscles) {
    if (priorities.includes(muscle)) score += 20;
  }
  return score;
}

function muscleLabels(muscles: MuscleGroup[]): string {
  return muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
}

function equipmentLabels(equipment: EquipmentType[]): string {
  return equipment.slice(0, 3).map(formatEquipment).join(', ');
}

function formatEquipment(value: EquipmentType): string {
  return value
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function routeExerciseIds(value: string | string[] | undefined): string[] {
  return firstParam(value)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: -12,
  },
  startButton: {
    minHeight: 52,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryAction: {
    flex: 1,
  },
  primaryActionWide: {
    flex: 2,
  },
  routeIssue: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 2,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  orderColumn: {
    alignItems: 'center',
    marginLeft: -8,
  },
  orderButton: {
    width: 32,
    height: 28,
    margin: 0,
  },
  removeButton: {
    width: 44,
    height: 44,
    margin: 0,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  search: {
    elevation: 0,
    height: 48,
  },
  filterRail: {
    gap: 8,
    paddingRight: 16,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
  },
});
