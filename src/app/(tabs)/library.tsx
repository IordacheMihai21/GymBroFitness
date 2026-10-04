import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton, Menu, Searchbar } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { ExerciseDemoStage } from '@/components/exercise/ExerciseDemoStage';
import { ExerciseListItem } from '@/components/exercise/ExerciseListItem';
import { ExerciseMuscleMap } from '@/components/exercise/ExerciseMuscleMap';
import { ListRow } from '@/components/ui/ListRow';
import { Pill } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  BROWSABLE_EXERCISE_LIBRARY,
  loggableExerciseForReference,
  preferredLibraryImages,
  searchLibrary,
  type LibraryExercise,
  workoutReadyLibrary,
} from '@/domain/exercises/library';
import {
  EMPTY_EXERCISE_LIBRARY_STATE,
  loadExerciseLibraryState,
  recordRecentExercise,
  toggleExerciseFavorite,
} from '@/domain/exercises/libraryStateStore';
import { isAutoProgrammed } from '@/domain/exercises/catalog';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '@/types';
import { useTheme } from '@/theme';

type LevelFilter = 'all' | LibraryExercise['level'];
type ScopeFilter = 'all' | 'workout-ready' | 'favorites' | 'recent';

const SCOPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Loggable', value: 'workout-ready' },
  { label: 'Starred', value: 'favorites' },
  { label: 'Recent', value: 'recent' },
] as const satisfies readonly { label: string; value: ScopeFilter }[];

const LEVEL_LABELS: Record<LibraryExercise['level'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

const LEVEL_FILTERS: { label: string; value: LevelFilter }[] = [
  { label: 'Any level', value: 'all' },
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
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
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
      scope === 'workout-ready'
        ? workoutReadyLibrary(baseResults)
        : scope === 'favorites'
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: spacing.md }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text style={[typography.display, { color: colors.textPrimary }]}>Exercises</Text>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {results.length} of {BROWSABLE_EXERCISE_LIBRARY.length}
              </Text>
            </View>

            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Searchbar
                mode="bar"
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises"
                iconColor={colors.textMuted}
                inputStyle={[typography.body, { color: colors.textPrimary, minHeight: 0 }]}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.search,
                  { backgroundColor: colors.surface, borderRadius: radius.lg },
                ]}
              />
              <Segmented options={SCOPE_FILTERS} value={scope} onChange={setScope} />
            </View>

            {libraryStateError ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.danger, paddingHorizontal: spacing.lg },
                ]}
                accessibilityRole="alert"
              >
                {libraryStateError}
              </Text>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
            >
              <Menu
                visible={levelMenuOpen}
                onDismiss={() => setLevelMenuOpen(false)}
                anchor={
                  <Pill
                    label={level === 'all' ? 'Any level' : LEVEL_LABELS[level]}
                    active={level !== 'all'}
                    trailingIcon="chevron-down"
                    onPress={() => setLevelMenuOpen(true)}
                    accessibilityLabel="Filter by level"
                  />
                }
              >
                {LEVEL_FILTERS.map((item) => (
                  <Menu.Item
                    key={item.value}
                    title={item.label}
                    leadingIcon={level === item.value ? 'check' : undefined}
                    onPress={() => {
                      setLevel(item.value);
                      setLevelMenuOpen(false);
                    }}
                  />
                ))}
              </Menu>
              <View style={[styles.railDivider, { backgroundColor: colors.border }]} />
              <Pill label="All muscles" active={muscle === null} onPress={() => setMuscle(null)} />
              {MUSCLE_GROUPS.map((item) => (
                <Pill
                  key={item}
                  label={MUSCLE_LABELS[item]}
                  active={muscle === item}
                  onPress={() => setMuscle((current) => (current === item ? null : item))}
                />
              ))}
            </ScrollView>
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
          <ExerciseListItem exercise={item} onPress={() => openDetail(item)} />
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

  const images = preferredLibraryImages(exercise);
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
            iconColor={colors.textSecondary}
            accessibilityLabel="Close exercise details"
            onPress={onDismiss}
          />
          <View style={styles.modalHeaderCopy} />
          <IconButton
            icon={favorite ? 'star' : 'star-outline'}
            iconColor={favorite ? colors.accent : colors.textSecondary}
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

          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{exercise.name}</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {[
                primaryLabel || 'Other',
                exercise.equipmentLabel,
                capitalize(exercise.level),
                exercise.mechanic ? capitalize(exercise.mechanic) : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {!loggableExercise
                ? 'Reference only, not loggable yet'
                : isAutoProgrammed(loggableExercise)
                  ? 'You can log this in workouts'
                  : 'You can log this, but automatic plans do not use it'}
              {formAiReady ? '. Form AI supported.' : '.'}
            </Text>
          </View>

          <ExerciseMuscleMap
            exerciseName={exercise.name}
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
          />

          <View style={styles.copySection}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>How to do it</Text>
            {exercise.instructions.slice(0, 4).map((instruction, index) => (
              <View key={instruction} style={styles.cueRow}>
                <Text style={[typography.numeric, { color: colors.textMuted, width: 20 }]}>
                  {index + 1}
                </Text>
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
                  {instruction}
                </Text>
              </View>
            ))}
          </View>

          {loggableExercise ? (
            <View
              style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
            >
              <ListRow
                title="Your history with this lift"
                subtitle={`Logged as ${loggableExercise.name}`}
                onPress={() => onViewHistory(loggableExercise)}
                last
              />
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.modalFooter,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          {formAiReady && loggableExercise ? (
            <Button
              mode="outlined"
              onPress={() => onFormCheck(loggableExercise)}
              style={styles.footerSecondary}
            >
              Form check
            </Button>
          ) : null}
          {loggableExercise ? (
            <Button
              mode="contained"
              onPress={() => onAdd(loggableExercise)}
              style={styles.footerPrimary}
              contentStyle={styles.footerButtonContent}
            >
              Start with this
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
    elevation: 0,
    height: 48,
  },
  railDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  modalSafeArea: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 4,
  },
  modalHeaderCopy: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  modalScroll: { flex: 1 },
  copySection: { gap: 12 },
  cueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerSecondary: { flex: 1 },
  footerPrimary: { flex: 1.4 },
  footerButtonContent: { minHeight: 48 },
});

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
