import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { ElementRef, RefObject } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { ALL_EXERCISES, availableExercises } from '@/domain/exercises/catalog';
import { rankReplacements } from '@/domain/exercises/replacement';
import { useTheme } from '@/theme';
import type { Exercise, TrainingPreferences } from '@/types';

type ExerciseSwapSheetProps = {
  modalRef: RefObject<ElementRef<typeof BottomSheetModal> | null>;
  /** The exercise being replaced; null while the sheet is closed. */
  original: Exercise | null;
  preferences: TrainingPreferences;
  usedExerciseIds: string[];
  onSelect: (exercise: Exercise) => void;
  onDismiss: () => void;
};

/**
 * Mid-workout swap: the machine is taken, or today it is the cable version
 * instead of dumbbells. Closest matches for the same muscles come first; typing
 * searches everything the lifter's equipment allows.
 */
export function ExerciseSwapSheet({
  modalRef,
  original,
  preferences,
  usedExerciseIds,
  onSelect,
  onDismiss,
}: ExerciseSwapSheetProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    if (!original) return [];
    const needle = query.trim().toLowerCase();
    if (needle) {
      return availableExercises(preferences.equipment, [], { includeExtended: true })
        .filter((item) => item.id !== original.id && item.name.toLowerCase().includes(needle))
        .slice(0, 40);
    }
    return rankReplacements({
      original,
      reason: 'equipment_unavailable',
      equipment: preferences.equipment,
      prefs: preferences,
      usedExerciseIds,
      pool: ALL_EXERCISES,
    })
      .slice(0, 30)
      .map((option) => option.exercise);
  }, [original, preferences, query, usedExerciseIds]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.52} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={['80%']}
      onDismiss={() => {
        setQuery('');
        onDismiss();
      }}
      keyboardBehavior="extend"
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      backdropComponent={renderBackdrop}
    >
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>
          Swap {original?.name ?? 'exercise'}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Same muscles first. Progress is tracked per exercise, so the new one starts its own
          history.
        </Text>
        <BottomSheetTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search, e.g. machine, cable, rope"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={[
            typography.body,
            styles.search,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.md,
            },
          ]}
        />
      </View>
      <BottomSheetFlatList
        data={options}
        keyExtractor={(item: Exercise) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <Text style={[typography.caption, { color: colors.textMuted, paddingTop: spacing.md }]}>
            Nothing matches with your equipment. Add equipment in Profile to see more.
          </Text>
        }
        renderItem={({ item }: { item: Exercise }) => (
          <Pressable
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`Swap to ${item.name}`}
            style={({ pressed }) => [
              styles.row,
              {
                borderBottomColor: colors.border,
                backgroundColor: pressed ? colors.surfacePressed : 'transparent',
              },
            ]}
          >
            <ExerciseThumbnail exercise={item} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {item.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')},{' '}
                {item.equipment.map((eq) => eq.replace(/_/g, ' ')).join(', ')}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 46,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
