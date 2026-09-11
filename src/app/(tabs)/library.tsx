import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseListItem } from '@/components/exercise/ExerciseListItem';
import { FilterChip } from '@/components/ui/FilterChip';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { EXERCISE_LIBRARY, searchLibrary } from '@/domain/exercises/library';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types';
import { useTheme } from '@/theme';

export default function LibraryScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);

  const results = useMemo(
    () => searchLibrary(query, muscle, EXERCISE_LIBRARY),
    [query, muscle],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>Exercise Library</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          style={[
            typography.body,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              color: colors.textPrimary,
            },
          ]}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MUSCLE_GROUPS}
          keyExtractor={(item) => item}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
          ListHeaderComponent={
            <FilterChip label="All" active={muscle === null} onPress={() => setMuscle(null)} />
          }
          ListHeaderComponentStyle={{ marginRight: spacing.sm }}
          renderItem={({ item }) => (
            <FilterChip
              label={MUSCLE_LABELS[item]}
              active={muscle === item}
              onPress={() => setMuscle((current) => (current === item ? null : item))}
            />
          )}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + 120,
          gap: spacing.sm,
        }}
        renderItem={({ item }) => <ExerciseListItem exercise={item} />}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            No exercises match that search.
          </Text>
        }
      />
    </View>
  );
}
