import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
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

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { availableExercises, requireExercise } from '@/domain/exercises/catalog';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { EquipmentType, Exercise, MuscleGroup } from '@/types';
import { MUSCLE_GROUPS } from '@/types';

export default function CustomWorkoutScreen() {
  const router = useRouter();
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { preferences } = useActiveProgram();
  const [name, setName] = useState('Custom Workout');
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | null>(null);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);
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

  function addExercise(exercise: Exercise) {
    setSelectedExerciseIds((current) => [...current, exercise.id]);
    Haptics.selectionAsync();
  }

  function removeExercise(index: number) {
    setSelectedExerciseIds((current) =>
      current.filter((_, candidateIndex) => candidateIndex !== index),
    );
    Haptics.selectionAsync();
  }

  function moveExercise(index: number, direction: -1 | 1) {
    setSelectedExerciseIds((current) => {
      const nextIndex = Math.min(current.length - 1, Math.max(0, index + direction));
      if (nextIndex === index) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(nextIndex, 0, moved);
      return next;
    });
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

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
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
            onChangeText={setName}
            style={{ backgroundColor: colors.surfaceRaised }}
          />

          <View style={styles.metricGrid}>
            <MetricBlock label="lifts" value={String(selectedExercises.length)} />
            <MetricBlock label="est. sets" value={String(totalSets)} />
            <MetricBlock label="mode" value="manual" />
          </View>

          <Button
            mode="contained"
            icon="play"
            disabled={selectedExerciseIds.length === 0}
            onPress={startCustomWorkout}
            contentStyle={styles.startButton}
          >
            Start custom workout
          </Button>
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
                </View>
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
        <Searchbar
          placeholder="Search exercise, muscle, machine"
          value={query}
          onChangeText={setQuery}
          mode="bar"
          style={[styles.search, { backgroundColor: colors.surfaceRaised }]}
          inputStyle={{ color: colors.textPrimary }}
          placeholderTextColor={colors.textMuted}
        />

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
                description={`${muscleLabels(exercise.primaryMuscles)} - ${equipmentLabels(exercise.equipment)}`}
                onPress={() => addExercise(exercise)}
                left={(props) => <List.Icon {...props} icon="plus-circle" color={colors.accent} />}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
                )}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                style={[styles.catalogRow, { backgroundColor: colors.surfaceRaised }]}
              />
              {index < candidates.length - 1 ? <View style={{ height: spacing.sm }} /> : null}
            </View>
          ))
        )}
      </BuilderSection>
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
  emptyPanel: {
    borderRadius: 14,
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
    width: 34,
    height: 34,
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
});
