import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { Card, Chip, List, Searchbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseListItem } from '@/components/exercise/ExerciseListItem';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { EXERCISE_LIBRARY, searchLibrary, type LibraryExercise } from '@/domain/exercises/library';
import { bodySlugsForMuscle } from '@/domain/muscles/muscleMap';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types';
import { useTheme } from '@/theme';

type LevelFilter = 'all' | LibraryExercise['level'];

const LEVEL_FILTERS: { label: string; value: LevelFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Expert', value: 'expert' },
];

export default function LibraryScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const baseResults = useMemo(
    () => searchLibrary(query, muscle, EXERCISE_LIBRARY),
    [query, muscle],
  );

  const results = useMemo(
    () =>
      level === 'all' ? baseResults : baseResults.filter((exercise) => exercise.level === level),
    [baseResults, level],
  );

  const selectedExercise = useMemo(
    () =>
      results.find((exercise) => exercise.id === selectedId) ?? results[0] ?? EXERCISE_LIBRARY[0],
    [results, selectedId],
  );

  const bodyData = useMemo(() => buildBodyData(selectedExercise), [selectedExercise]);
  const primaryLabel = selectedExercise.primaryMuscles
    .map((item) => MUSCLE_LABELS[item])
    .join(', ');
  const firstInstruction =
    selectedExercise.instructions[0] ?? 'Load with control and repeat with consistent form.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Exercise intelligence
                </Text>
                <Text style={[typography.title, { color: colors.textPrimary }]}>Atlas</Text>
              </View>
              <Chip compact mode="flat" icon="database-search">
                {EXERCISE_LIBRARY.length}
              </Chip>
            </View>

            <Searchbar
              mode="bar"
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              iconColor={colors.accent}
              inputStyle={[typography.body, { color: colors.textPrimary }]}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.search,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                },
              ]}
            />

            <SelectedExerciseCard
              exercise={selectedExercise}
              bodyData={bodyData}
              primaryLabel={primaryLabel}
              firstInstruction={firstInstruction}
              onViewHistory={() => router.push(`/exercise/${selectedExercise.id}`)}
            />

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.captionBold, { color: colors.textMuted }]}>Filters</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={LEVEL_FILTERS}
                keyExtractor={(item) => item.value}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => (
                  <Chip
                    selected={level === item.value}
                    mode={level === item.value ? 'flat' : 'outlined'}
                    onPress={() => setLevel(item.value)}
                  >
                    {item.label}
                  </Chip>
                )}
              />
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={MUSCLE_GROUPS}
                keyExtractor={(item) => item}
                contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.xs }}
                ListHeaderComponent={
                  <Chip
                    selected={muscle === null}
                    mode={muscle === null ? 'flat' : 'outlined'}
                    onPress={() => setMuscle(null)}
                  >
                    All muscles
                  </Chip>
                }
                ListHeaderComponentStyle={{ marginRight: spacing.sm }}
                renderItem={({ item }) => (
                  <Chip
                    selected={muscle === item}
                    mode={muscle === item ? 'flat' : 'outlined'}
                    onPress={() => setMuscle((current) => (current === item ? null : item))}
                  >
                    {MUSCLE_LABELS[item]}
                  </Chip>
                )}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.lg }}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
              No exercises match that search.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ExerciseListItem
              exercise={item}
              selected={item.id === selectedExercise.id}
              onPress={() => setSelectedId(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}

function SelectedExerciseCard({
  exercise,
  bodyData,
  primaryLabel,
  firstInstruction,
  onViewHistory,
}: {
  exercise: LibraryExercise;
  bodyData: ExtendedBodyPart[];
  primaryLabel: string;
  firstInstruction: string;
  onViewHistory: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const heroImage = exercise.images[0];

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
        <View style={styles.previewRow}>
          <Image
            source={heroImage ? { uri: heroImage } : undefined}
            style={[
              styles.heroImage,
              { backgroundColor: colors.surfacePressed, borderRadius: radius.lg },
            ]}
            contentFit="cover"
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[typography.micro, { color: colors.accent }]}>Selected movement</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={2}>
              {exercise.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {exercise.equipmentLabel} · {primaryLabel}
            </Text>
            <View style={styles.metaRow}>
              <Chip compact mode="flat">
                {exercise.level}
              </Chip>
              <Chip compact mode="flat">
                {exercise.mechanic ?? 'mixed'}
              </Chip>
            </View>
          </View>
        </View>

        <View style={styles.bodyAndCue}>
          <View style={styles.bodyPair}>
            <Body
              data={bodyData}
              colors={[`${colors.accent}66`, colors.accent]}
              side="front"
              scale={0.2}
              border="none"
              defaultFill={colors.surfacePressed}
            />
            <Body
              data={bodyData}
              colors={[`${colors.accent}66`, colors.accent]}
              side="back"
              scale={0.2}
              border="none"
              defaultFill={colors.surfacePressed}
            />
          </View>
          <View style={[styles.cuePanel, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[typography.micro, { color: colors.textMuted }]}>First cue</Text>
            <Text style={[typography.caption, { color: colors.textPrimary }]} numberOfLines={4}>
              {firstInstruction}
            </Text>
          </View>
        </View>

        <List.Item
          title="View training history"
          description="Session-by-session e1RM trend and logged sets for this exercise."
          onPress={onViewHistory}
          left={(props) => <List.Icon {...props} icon="chart-line" color={colors.accent} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
          descriptionStyle={[typography.caption, { color: colors.textMuted }]}
          style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
        />

        <List.Item
          title="Use as substitution reference"
          description="Compare target muscle, equipment, level, and mechanics before swapping a lift."
          left={(props) => <List.Icon {...props} icon="swap-horizontal" color={colors.accent} />}
          titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
          descriptionStyle={[typography.caption, { color: colors.textMuted }]}
          style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
        />
      </Card.Content>
    </Card>
  );
}

function buildBodyData(exercise: LibraryExercise): ExtendedBodyPart[] {
  const primary = exercise.primaryMuscles.flatMap((muscle) =>
    bodySlugsForMuscle(muscle).map((slug) => ({
      slug,
      intensity: 2,
    })),
  );
  const secondary = exercise.secondaryMuscles
    .filter((muscle) => !exercise.primaryMuscles.includes(muscle))
    .flatMap((muscle) =>
      bodySlugsForMuscle(muscle).map((slug) => ({
        slug,
        intensity: 1,
      })),
    );

  return [...primary, ...secondary];
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroImage: {
    width: 104,
    height: 104,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bodyAndCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bodyPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 118,
  },
  cuePanel: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  listPanel: {
    borderRadius: 14,
  },
});
