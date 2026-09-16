import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { useTheme } from '@/theme';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type TrainingProgram } from '@/types';

export default function ProgramBuilderScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, preferences, saveProgram } = useActiveProgram();
  const [draft, setDraft] = useState(() =>
    createCustomProgramDraft({ userId: user.id, preferences, name: 'My Hypertrophy Program' }),
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
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
      router.replace('/program');
    } catch {
      setStatus('Could not save this program.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.md,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View style={styles.headerRow}>
        <IconButton mode="contained-tonal" icon="arrow-left" onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Manual programming</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Build Program</Text>
        </View>
        <Chip compact mode="flat" icon="calendar-week">
          {draft.days.length}d
        </Chip>
      </View>

      <Card
        mode="contained"
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radius.xl },
        ]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <TextInput
            mode="outlined"
            label="Program name"
            value={draft.name}
            onChangeText={(name) => updateDraft({ ...draft, name })}
          />

          <View style={styles.headerRow}>
            <View>
              <Text style={[typography.micro, { color: colors.accent }]}>Week structure</Text>
              <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                Training days
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>2-6 days</Text>
          </View>

          <View style={styles.chipRow}>
            {[2, 3, 4, 5, 6].map((days) => (
              <Chip
                key={days}
                selected={draft.days.length === days}
                mode={draft.days.length === days ? 'flat' : 'outlined'}
                onPress={() => updateDayCount(days)}
              >
                {days} days
              </Chip>
            ))}
          </View>

          {status ? (
            <Text style={[typography.captionBold, { color: saveIssue ? colors.warning : colors.textMuted }]}>
              {status}
            </Text>
          ) : saveIssue ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{saveIssue}</Text>
          ) : (
            <Text style={[typography.caption, { color: colors.accent }]}>Ready to save.</Text>
          )}
        </Card.Content>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRail}>
        {draft.days.map((day, index) => (
          <Chip
            key={day.id}
            selected={selectedDayIndex === index}
            mode={selectedDayIndex === index ? 'flat' : 'outlined'}
            icon={day.prescriptions.length > 0 ? 'check' : 'circle-outline'}
            onPress={() => setSelectedDayIndex(index)}
          >
            {day.name}
          </Chip>
        ))}
      </ScrollView>

      {selectedDay ? (
        <Card
          mode="contained"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.micro, { color: colors.accent }]}>Selected day</Text>
                <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                  {selectedDay.name}
                </Text>
              </View>
              <Chip compact mode="flat" icon="dumbbell">
                {selectedDay.prescriptions.length}
              </Chip>
            </View>

            <TextInput
              mode="outlined"
              label="Day name"
              value={selectedDay.name}
              onChangeText={(name) => updateDraft(renameCustomProgramDay(draft, selectedDayIndex, name))}
            />

            <View style={styles.metricGrid}>
              <Metric label="exercises" value={String(selectedDay.prescriptions.length)} />
              <Metric
                label="sets"
                value={String(
                  selectedDay.prescriptions.reduce((sum, item) => sum + item.workingSets, 0),
                )}
              />
              <Metric label="est." value={`${selectedDay.estimatedMinutes}m`} />
            </View>

            {selectedDay.prescriptions.length === 0 ? (
              <EmptyPanel
                title="No exercises yet"
                description="Search below and add at least one movement to this day."
              />
            ) : (
              selectedDay.prescriptions.map((prescription, index) => {
                const exercise = requireExercise(prescription.exerciseId);
                return (
                  <View key={`${prescription.exerciseId}-${index}`}>
                    <List.Item
                      title={exercise.name}
                      description={`${prescription.workingSets} x ${prescription.minReps}-${prescription.maxReps} · RIR ${prescription.targetRir} · ${formatMuscles(exercise.primaryMuscles)}`}
                      left={(props) => <List.Icon {...props} icon="dumbbell" color={colors.accent} />}
                      right={() => (
                        <View style={styles.rowActions}>
                          <IconButton
                            size={18}
                            icon="chevron-up"
                            disabled={index === 0}
                            onPress={() => moveExercise(index, -1)}
                          />
                          <IconButton
                            size={18}
                            icon="chevron-down"
                            disabled={index === selectedDay.prescriptions.length - 1}
                            onPress={() => moveExercise(index, 1)}
                          />
                          <IconButton
                            size={18}
                            icon="trash-can-outline"
                            iconColor={colors.danger}
                            onPress={() => removeExercise(index)}
                          />
                        </View>
                      )}
                      titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                      descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                    />
                    {index < selectedDay.prescriptions.length - 1 ? <Divider /> : null}
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>
      ) : null}

      <Card
        mode="contained"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Exercise catalog</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>Add to day</Text>
          </View>

          <Searchbar
            placeholder="Search exercise, muscle, equipment"
            value={query}
            onChangeText={setQuery}
            mode="bar"
            style={[styles.search, { backgroundColor: colors.surfaceRaised }]}
            inputStyle={{ color: colors.textPrimary }}
            placeholderTextColor={colors.textMuted}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip
              compact
              selected={muscleFilter == null}
              mode={muscleFilter == null ? 'flat' : 'outlined'}
              onPress={() => setMuscleFilter(null)}
            >
              All
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

          {candidates.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              No unused exercise matches this filter with your current equipment.
            </Text>
          ) : (
            candidates.map((exercise, index) => (
              <View key={exercise.id}>
                <List.Item
                  title={exercise.name}
                  description={`${formatMuscles(exercise.primaryMuscles)} · ${exercise.movementPattern.replace(/_/g, ' ')}`}
                  onPress={() => addExercise(exercise)}
                  left={(props) => <List.Icon {...props} icon="plus-circle" color={colors.accent} />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
                  titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                  descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                  style={[styles.candidateRow, { backgroundColor: colors.surfaceRaised }]}
                />
                {index < candidates.length - 1 ? <View style={{ height: spacing.sm }} /> : null}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="content-save-check-outline"
        loading={saving}
        disabled={saving || !!saveIssue}
        onPress={saveCustomProgram}
      >
        Save as active program
      </Button>
    </Animated.ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metric, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  const { colors, typography } = useTheme();

  return (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon="playlist-plus" color={colors.accent} />}
      titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
      descriptionStyle={[typography.caption, { color: colors.textMuted }]}
      style={[styles.emptyPanel, { backgroundColor: colors.surfaceRaised }]}
    />
  );
}

function formatMuscles(muscles: MuscleGroup[]): string {
  return muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayRail: {
    gap: 8,
    paddingRight: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  candidateRow: {
    borderRadius: 14,
  },
  emptyPanel: {
    borderRadius: 14,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
