import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, IconButton, List, Searchbar } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { ExerciseDemoStage } from '@/components/exercise/ExerciseDemoStage';
import { ExerciseListItem } from '@/components/exercise/ExerciseListItem';
import { ExerciseMuscleMap } from '@/components/exercise/ExerciseMuscleMap';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  BROWSABLE_EXERCISE_LIBRARY,
  loggableExerciseForReference,
  referenceImageUrl,
  searchLibrary,
  type LibraryExercise,
} from '@/domain/exercises/library';
import {
  EMPTY_EXERCISE_LIBRARY_STATE,
  loadExerciseLibraryState,
  recordRecentExercise,
  toggleExerciseFavorite,
} from '@/domain/exercises/libraryStateStore';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '@/types';
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
  const [detailExercise, setDetailExercise] = useState<LibraryExercise | null>(null);
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
    () => searchLibrary(query, muscle, BROWSABLE_EXERCISE_LIBRARY),
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

  function openDetail(exercise: LibraryExercise) {
    setDetailExercise(exercise);
    setLibraryStateError(null);
    recordRecentExercise(exercise.id)
      .then(setLibraryState)
      .catch(() => setLibraryStateError('Recent exercises could not be updated. Try again.'));
  }

  function openQuickWorkout(exercise: Exercise) {
    setDetailExercise(null);
    router.push({
      pathname: '/custom-workout',
      params: { ids: exercise.id, name: 'Quick workout' },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Find, compare, and add movements
                </Text>
                <Text style={[typography.title, { color: colors.textPrimary }]}>Exercises</Text>
              </View>
              <Chip compact mode="flat" icon="database-search">
                {BROWSABLE_EXERCISE_LIBRARY.length}
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

            <View style={{ gap: spacing.sm }}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={SCOPE_FILTERS}
                keyExtractor={(item) => item.value}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => (
                  <Chip
                    compact
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
                    compact
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
                    compact
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
                    compact
                    selected={muscle === item}
                    mode={muscle === item ? 'flat' : 'outlined'}
                    onPress={() => setMuscle((current) => (current === item ? null : item))}
                  >
                    {MUSCLE_LABELS[item]}
                  </Chip>
                )}
              />
            </View>

            <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
              {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
            </Text>
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
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ExerciseListItem exercise={item} onPress={() => openDetail(item)} />
          </View>
        )}
      />

      <LibraryExerciseDetailModal
        key={detailExercise?.id ?? 'closed'}
        exercise={detailExercise}
        favorite={detailExercise ? libraryState.favoriteIds.includes(detailExercise.id) : false}
        onToggleFavorite={() => {
          if (!detailExercise) return;
          setLibraryStateError(null);
          toggleExerciseFavorite(detailExercise.id)
            .then(setLibraryState)
            .catch(() => setLibraryStateError('This favorite could not be saved. Try again.'));
        }}
        onDismiss={() => setDetailExercise(null)}
        onAdd={openQuickWorkout}
        onViewHistory={(exercise) => {
          setDetailExercise(null);
          router.push(`/exercise/${exercise.id}`);
        }}
        onFormCheck={(exercise) => {
          setDetailExercise(null);
          router.push({
            pathname: '/form-check/[exerciseId]',
            params: { exerciseId: exercise.id },
          });
        }}
      />
    </View>
  );
}

function LibraryExerciseDetailModal({
  exercise,
  favorite,
  onToggleFavorite,
  onDismiss,
  onAdd,
  onViewHistory,
  onFormCheck,
}: {
  exercise: LibraryExercise | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  onDismiss: () => void;
  onAdd: (exercise: Exercise) => void;
  onViewHistory: (exercise: Exercise) => void;
  onFormCheck: (exercise: Exercise) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const reduceMotion = useReducedMotion();

  if (!exercise) return null;

  const images = exercise.images.map(referenceImageUrl);
  const loggableExercise = loggableExerciseForReference(exercise);
  const formAiReady = Boolean(
    loggableExercise && getVisionConfigForMovementPattern(loggableExercise.movementPattern),
  );
  const primaryLabel = exercise.primaryMuscles.map((item) => MUSCLE_LABELS[item]).join(', ');

  return (
    <Modal
      visible
      animationType={reduceMotion ? 'fade' : 'slide'}
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <IconButton
            icon="close"
            mode="contained-tonal"
            accessibilityLabel="Close exercise details"
            onPress={onDismiss}
          />
          <View style={styles.modalHeaderCopy}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Exercise details</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={2}>
              {exercise.name}
            </Text>
          </View>
          <IconButton
            icon={favorite ? 'star' : 'star-outline'}
            mode="contained-tonal"
            accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
            onPress={onToggleFavorite}
          />
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.x4l,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ExerciseDemoStage images={images} exerciseName={exercise.name} />

          <View style={styles.chipRow}>
            <Chip compact icon="target">
              {primaryLabel || 'Other'}
            </Chip>
            <Chip compact icon="dumbbell">
              {exercise.equipmentLabel}
            </Chip>
            <Chip compact mode="flat">
              {exercise.level}
            </Chip>
            <Chip compact mode="flat">
              {exercise.mechanic ?? 'mixed'}
            </Chip>
            <Chip
              compact
              mode={loggableExercise ? 'flat' : 'outlined'}
              icon={loggableExercise ? 'check-circle-outline' : 'book-open-variant'}
            >
              {loggableExercise ? 'Loggable' : 'Reference only'}
            </Chip>
            {formAiReady ? (
              <Chip compact mode="flat" icon="camera-outline">
                Form AI
              </Chip>
            ) : null}
          </View>

          <ExerciseMuscleMap
            exerciseName={exercise.name}
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
          />

          <View style={styles.copySection}>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              How to perform it
            </Text>
            {exercise.instructions.slice(0, 4).map((instruction, index) => (
              <View key={instruction} style={styles.cueRow}>
                <View style={[styles.cueNumber, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[typography.captionBold, { color: colors.accent }]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
                  {instruction}
                </Text>
              </View>
            ))}
          </View>

          <List.Item
            title={loggableExercise ? 'View training history' : 'No linked training history'}
            description={
              loggableExercise
                ? `Linked to ${loggableExercise.name}. Open comparable logged sessions.`
                : 'This reference entry has not been reviewed and mapped to a loggable exercise.'
            }
            onPress={loggableExercise ? () => onViewHistory(loggableExercise) : undefined}
            left={(props) => <List.Icon {...props} icon="chart-line" color={colors.accent} />}
            right={(props) =>
              loggableExercise ? (
                <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
              ) : null
            }
            titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
            descriptionStyle={[typography.caption, { color: colors.textMuted }]}
            style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
          />
        </ScrollView>

        <View
          style={[
            styles.modalFooter,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <Button mode="text" onPress={onDismiss} style={styles.footerSecondary}>
            Close
          </Button>
          {formAiReady && loggableExercise ? (
            <Button
              mode="outlined"
              icon="camera-outline"
              onPress={() => onFormCheck(loggableExercise)}
              style={styles.footerSecondary}
            >
              Form check
            </Button>
          ) : null}
          {loggableExercise ? (
            <Button
              mode="contained"
              icon="playlist-plus"
              onPress={() => onAdd(loggableExercise)}
              style={styles.footerPrimary}
              contentStyle={styles.footerButtonContent}
            >
              Add to workout
            </Button>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
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
  modalSafeArea: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderCopy: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  modalScroll: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  copySection: { gap: 12 },
  cueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cueNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listPanel: {
    borderRadius: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerSecondary: { flex: 0.8 },
  footerPrimary: { flex: 1.2 },
  footerButtonContent: { minHeight: 48 },
});
