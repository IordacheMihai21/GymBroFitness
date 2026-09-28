import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  Searchbar,
  TextInput,
} from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDemoModal } from '@/components/exercise/ExerciseDemoModal';
import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { availableExercises, requireExercise } from '@/domain/exercises/catalog';
import { saveTemplate } from '@/domain/programs/templateStore';
import { buildTemplateFromProgramDay } from '@/domain/programs/templates';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import { validateCustomWorkoutSelection } from '@/domain/workouts/customWorkoutSelection';
import { buildCustomWorkoutDay } from '@/features/workout/workout.helpers';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { useTheme } from '@/theme';
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

    return availableExercises(preferences.equipment, excludedSlugs)
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
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.md,
        paddingBottom: insets.bottom + 96,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View style={styles.topBar}>
        <IconButton
          icon="arrow-left"
          mode="contained-tonal"
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <View style={{ flex: 1 }}>
          <Text style={[typography.micro, { color: colors.accent }]}>Workout builder</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Custom session</Text>
        </View>
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
          <TextInput
            mode="outlined"
            dense
            label="Workout name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setSaveStatus(null);
            }}
            style={{ backgroundColor: colors.surfaceRaised }}
          />

          <View style={styles.metricGrid}>
            <MetricBlock label="lifts" value={String(selectedExercises.length)} />
            <MetricBlock label="est. sets" value={String(totalSets)} />
            <MetricBlock label="form AI" value={String(formAiCount)} />
          </View>

          <View style={styles.primaryActions}>
            <Button
              mode="outlined"
              icon={savedTemplateId ? 'content-save-check-outline' : 'content-save-outline'}
              loading={savingWorkout}
              disabled={selectedExerciseIds.length === 0 || savingWorkout}
              onPress={saveCustomWorkout}
              contentStyle={styles.startButton}
              style={styles.primaryAction}
            >
              {savedTemplateId ? 'Update saved' : 'Save workout'}
            </Button>
            <Button
              mode="contained"
              icon="play"
              disabled={selectedExerciseIds.length === 0 || savingWorkout}
              onPress={startCustomWorkout}
              contentStyle={styles.startButton}
              style={styles.primaryAction}
            >
              Start
            </Button>
          </View>

          {saveStatus ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                typography.captionBold,
                { color: saveStatus.startsWith('Could not') ? colors.danger : colors.success },
              ]}
            >
              {saveStatus}
            </Text>
          ) : null}

          {routeSelectionIssue ? (
            <View
              style={[
                styles.routeIssue,
                { backgroundColor: colors.warningSoft, borderRadius: radius.lg },
              ]}
              accessibilityRole="alert"
            >
              <Text style={[typography.captionBold, { color: colors.warning }]}>Not added</Text>
              <Text style={[typography.caption, { color: colors.textPrimary }]}>
                {routeSelectionIssue}
              </Text>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      <BuilderSection eyebrow="Selected" title="Workout order">
        {selectedExercises.length === 0 ? (
          <View style={[styles.emptyPanel, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
              Choose exercises from the catalog below.
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              The workout starts as a one-off session. Save it as a template after finishing if it
              becomes a routine.
            </Text>
          </View>
        ) : (
          selectedExercises.map((exercise, index) => (
            <View key={`${exercise.id}-${index}`}>
              <View style={styles.selectedRow}>
                <View style={styles.orderColumn}>
                  <IconButton
                    icon="chevron-up"
                    size={15}
                    mode="contained-tonal"
                    disabled={index === 0}
                    onPress={() => moveExercise(index, -1)}
                    style={styles.orderButton}
                  />
                  <Text style={[typography.micro, { color: colors.textMuted }]}>{index + 1}</Text>
                  <IconButton
                    icon="chevron-down"
                    size={15}
                    mode="contained-tonal"
                    disabled={index === selectedExercises.length - 1}
                    onPress={() => moveExercise(index, 1)}
                    style={styles.orderButton}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                    {exercise.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {muscleLabels(exercise.primaryMuscles)} - {equipmentLabels(exercise.equipment)}
                  </Text>
                  {getVisionConfigForMovementPattern(exercise.movementPattern) ? (
                    <Chip compact mode="flat" icon="camera-outline" style={styles.formChip}>
                      Form AI
                    </Chip>
                  ) : null}
                </View>
                <IconButton
                  icon="motion-play-outline"
                  size={17}
                  mode="contained-tonal"
                  accessibilityLabel={`Preview ${exercise.name} technique`}
                  onPress={() => setPreviewExercise(exercise)}
                  style={styles.removeButton}
                />
                <IconButton
                  icon="trash-can-outline"
                  size={17}
                  mode="contained-tonal"
                  onPress={() => removeExercise(index)}
                  style={styles.removeButton}
                />
              </View>
              {index < selectedExercises.length - 1 ? <Divider /> : null}
            </View>
          ))
        )}
      </BuilderSection>

      <BuilderSection eyebrow="Catalog" title="Add exercises">
        <View ref={inputAnchorRef} collapsable={false}>
          <Searchbar
            placeholder="Search exercise, muscle, machine"
            value={query}
            onChangeText={setQuery}
            onFocus={revealInput}
            mode="bar"
            style={[styles.search, { backgroundColor: colors.surfaceRaised }]}
            inputStyle={{ color: colors.textPrimary }}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <Chip
            compact
            selected={muscleFilter == null}
            mode={muscleFilter == null ? 'flat' : 'outlined'}
            onPress={() => setMuscleFilter(null)}
          >
            All muscles
          </Chip>
          {MUSCLE_GROUPS.map((muscle) => (
            <Chip
              key={muscle}
              compact
              selected={muscleFilter === muscle}
              mode={muscleFilter === muscle ? 'flat' : 'outlined'}
              onPress={() => setMuscleFilter((current) => (current === muscle ? null : muscle))}
            >
              {MUSCLE_LABELS[muscle]}
            </Chip>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <Chip
            compact
            selected={equipmentFilter == null}
            mode={equipmentFilter == null ? 'flat' : 'outlined'}
            onPress={() => setEquipmentFilter(null)}
          >
            All equipment
          </Chip>
          {preferences.equipment.map((equipment) => (
            <Chip
              key={equipment}
              compact
              selected={equipmentFilter === equipment}
              mode={equipmentFilter === equipment ? 'flat' : 'outlined'}
              icon="dumbbell"
              onPress={() =>
                setEquipmentFilter((current) => (current === equipment ? null : equipment))
              }
            >
              {formatEquipment(equipment)}
            </Chip>
          ))}
        </ScrollView>

        {candidates.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No exercise matches the current filters.
          </Text>
        ) : (
          candidates.map((exercise, index) => (
            <View key={exercise.id}>
              <List.Item
                title={exercise.name}
                description={`${muscleLabels(exercise.primaryMuscles)} - ${equipmentLabels(exercise.equipment)} · Preview technique`}
                descriptionNumberOfLines={2}
                onPress={() => setPreviewExercise(exercise)}
                left={() => <ExerciseThumbnail exercise={exercise} />}
                right={(props) => (
                  <List.Icon {...props} icon="arrow-expand" color={colors.textMuted} />
                )}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                style={[styles.catalogRow, { backgroundColor: colors.surfaceRaised }]}
              />
              {getVisionConfigForMovementPattern(exercise.movementPattern) ? (
                <View style={styles.catalogBadgeRow}>
                  <Chip compact mode="flat" icon="camera-outline">
                    Form AI ready
                  </Chip>
                </View>
              ) : null}
              {index < candidates.length - 1 ? <View style={{ height: spacing.sm }} /> : null}
            </View>
          ))
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

function BuilderSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const { colors, radius, spacing, typography } = useTheme();

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
        <View>
          <Text style={[typography.micro, { color: colors.accent }]}>{eyebrow}</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        {children}
      </Card.Content>
    </Card>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metricBlock, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
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
  let score = exercise.exerciseType === 'compound' ? 8 : 0;
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    margin: 0,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBlock: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
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
  emptyPanel: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  routeIssue: {
    padding: 12,
    gap: 4,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  orderColumn: {
    alignItems: 'center',
    gap: 2,
  },
  orderButton: {
    width: 28,
    height: 28,
    margin: 0,
  },
  removeButton: {
    width: 48,
    height: 48,
    margin: 0,
  },
  search: {
    borderRadius: 16,
  },
  filterRail: {
    gap: 8,
    paddingRight: 16,
  },
  catalogRow: {
    borderRadius: 14,
  },
  catalogBadgeRow: {
    flexDirection: 'row',
    marginTop: -4,
    marginLeft: 56,
  },
  formChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
});
