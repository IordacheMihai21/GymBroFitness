import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { Button, Card, Chip, IconButton, List, Searchbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseListItem } from '@/components/exercise/ExerciseListItem';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  EXERCISE_LIBRARY,
  loggableExerciseForReference,
  searchLibrary,
  type LibraryExercise,
} from '@/domain/exercises/library';
import {
  EMPTY_EXERCISE_LIBRARY_STATE,
  loadExerciseLibraryState,
  recordRecentExercise,
  toggleExerciseFavorite,
} from '@/domain/exercises/libraryStateStore';
import { bodySlugsForMuscle } from '@/domain/muscles/muscleMap';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types';
import { useTheme } from '@/theme';

type LevelFilter = 'all' | LibraryExercise['level'];
type ScopeFilter = 'all' | 'favorites' | 'recent';

const SCOPE_FILTERS: { label: string; value: ScopeFilter; icon: string }[] = [
  { label: 'All', value: 'all', icon: 'format-list-bulleted' },
  { label: 'Favorites', value: 'favorites', icon: 'star-outline' },
  { label: 'Recent', value: 'recent', icon: 'history' },
];

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
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryState, setLibraryState] = useState(EMPTY_EXERCISE_LIBRARY_STATE);
  const [libraryStateError, setLibraryStateError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      loadExerciseLibraryState()
        .then((state) => {
          if (!mounted) return;
          setLibraryState(state);
          setLibraryStateError(null);
        })
        .catch(() => {
          if (mounted) {
            setLibraryStateError('Favorites and recent exercises could not be loaded.');
          }
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const baseResults = useMemo(
    () => searchLibrary(query, muscle, EXERCISE_LIBRARY),
    [query, muscle],
  );

  const results = useMemo(() => {
    const scoped =
      scope === 'favorites'
        ? baseResults.filter((exercise) => libraryState.favoriteIds.includes(exercise.id))
        : scope === 'recent'
          ? libraryState.recentIds.flatMap((id) => {
              const exercise = baseResults.find((item) => item.id === id);
              return exercise ? [exercise] : [];
            })
          : baseResults;
    return level === 'all' ? scoped : scoped.filter((exercise) => exercise.level === level);
  }, [baseResults, level, libraryState.favoriteIds, libraryState.recentIds, scope]);

  const selectedExercise = useMemo(
    () =>
      results.find((exercise) => exercise.id === selectedId) ?? results[0] ?? EXERCISE_LIBRARY[0],
    [results, selectedId],
  );
  const loggableExercise = useMemo(
    () => loggableExerciseForReference(selectedExercise),
    [selectedExercise],
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
                <Text style={[typography.title, { color: colors.textPrimary }]}>Exercises</Text>
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

            {libraryStateError ? (
              <Text
                style={[typography.caption, { color: colors.danger }]}
                accessibilityRole="alert"
              >
                {libraryStateError}
              </Text>
            ) : null}

            {results.length > 0 ? (
              <SelectedExerciseCard
                exercise={selectedExercise}
                bodyData={bodyData}
                primaryLabel={primaryLabel}
                firstInstruction={firstInstruction}
                favorite={libraryState.favoriteIds.includes(selectedExercise.id)}
                onToggleFavorite={() => {
                  setLibraryStateError(null);
                  toggleExerciseFavorite(selectedExercise.id)
                    .then(setLibraryState)
                    .catch(() =>
                      setLibraryStateError('This favorite could not be saved. Try again.'),
                    );
                }}
                loggableExerciseName={loggableExercise?.name ?? null}
                onViewHistory={
                  loggableExercise
                    ? () => router.push(`/exercise/${loggableExercise.id}`)
                    : undefined
                }
                onAdd={
                  loggableExercise
                    ? () =>
                        router.push({
                          pathname: '/custom-workout',
                          params: { ids: loggableExercise.id, name: 'Quick workout' },
                        })
                    : undefined
                }
              />
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.captionBold, { color: colors.textMuted }]}>Filters</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={SCOPE_FILTERS}
                keyExtractor={(item) => item.value}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => (
                  <Chip
                    icon={item.icon}
                    selected={scope === item.value}
                    mode={scope === item.value ? 'flat' : 'outlined'}
                    onPress={() => setScope(item.value)}
                  >
                    {item.label}
                  </Chip>
                )}
              />
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
          <View style={{ padding: spacing.lg, gap: spacing.md, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
              No exercises match these filters.
            </Text>
            <Button
              mode="outlined"
              onPress={() => {
                setQuery('');
                setMuscle(null);
                setLevel('all');
                setScope('all');
              }}
            >
              Clear filters
            </Button>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ExerciseListItem
              exercise={item}
              selected={item.id === selectedExercise.id}
              onPress={() => {
                setSelectedId(item.id);
                setLibraryStateError(null);
                recordRecentExercise(item.id)
                  .then(setLibraryState)
                  .catch(() =>
                    setLibraryStateError('Recent exercises could not be updated. Try again.'),
                  );
              }}
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
  favorite,
  onToggleFavorite,
  loggableExerciseName,
  onViewHistory,
  onAdd,
}: {
  exercise: LibraryExercise;
  bodyData: ExtendedBodyPart[];
  primaryLabel: string;
  firstInstruction: string;
  favorite: boolean;
  onToggleFavorite: () => void;
  loggableExerciseName: string | null;
  onViewHistory?: () => void;
  onAdd?: () => void;
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
            accessibilityLabel={`${exercise.name} exercise reference`}
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={styles.headerRow}>
              <Text style={[typography.micro, { color: colors.accent }]}>Selected movement</Text>
              <IconButton
                icon={favorite ? 'star' : 'star-outline'}
                mode="contained-tonal"
                size={18}
                accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
                onPress={onToggleFavorite}
              />
            </View>
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
              <Chip
                compact
                mode={loggableExerciseName ? 'flat' : 'outlined'}
                icon={loggableExerciseName ? 'check-circle-outline' : 'book-open-variant'}
              >
                {loggableExerciseName ? 'Loggable' : 'Reference only'}
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
          title={onViewHistory ? 'View training history' : 'No linked training history'}
          description={
            onViewHistory
              ? `Linked to ${loggableExerciseName}. Open comparable logged sessions.`
              : 'This reference entry has not been reviewed and mapped to a loggable exercise.'
          }
          onPress={onViewHistory}
          left={(props) => <List.Icon {...props} icon="chart-line" color={colors.accent} />}
          right={(props) =>
            onViewHistory ? (
              <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
            ) : null
          }
          titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
          descriptionStyle={[typography.caption, { color: colors.textMuted }]}
          style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
        />

        {onAdd ? (
          <Button mode="contained" icon="playlist-plus" onPress={onAdd}>
            Add to quick workout
          </Button>
        ) : null}

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
