import { useMemo, useState, type ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, IconButton, Searchbar, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDemoModal } from '@/components/exercise/ExerciseDemoModal';
import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { StepperControl } from '@/components/program/ProgramBlocks';
import { Pill } from '@/components/ui/Pill';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import {
  addProgramPrescription,
  buildManualPrescription,
  exerciseCandidatesForProgramDay,
  moveProgramPrescription,
  removeProgramPrescription,
  updateProgramPrescription,
} from '@/domain/programs/programEditing';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { useBackDestination } from '@/hooks/useBackDestination';
import { inputTheme, useTheme } from '@/theme';
import type {
  Exercise,
  ExercisePrescription,
  MuscleGroup,
  ProgramDay,
  SetTechnique,
  TrainingProgram,
} from '@/types';

const TECHNIQUE_OPTIONS: SetTechnique[] = [
  'standard',
  'drop_set',
  'rest_pause',
  'myo_reps',
  'cluster_set',
  'top_backoff',
];

const TECHNIQUE_LABELS: Record<SetTechnique, string> = {
  standard: 'Standard',
  drop_set: 'Drop set',
  rest_pause: 'Rest-pause',
  myo_reps: 'Myo-reps',
  cluster_set: 'Cluster',
  top_backoff: 'Top + backoff',
};

export default function ProgramDayEditorScreen() {
  const router = useRouter();
  const backToProgram = useBackDestination('/program');
  const params = useLocalSearchParams<{ day?: string | string[] }>();
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { preferences, program, saveProgram } = useActiveProgram();
  const { scrollRef, inputAnchorRef, onScroll, revealInput } = useKeyboardAwareScroll(
    Math.max(insets.top, spacing.xxl),
  );
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  const dayIndex = useMemo(() => parseDayParam(params.day), [params.day]);
  const selectedDay = program.days[dayIndex];
  const previewAlreadySelected = Boolean(
    previewExercise &&
    selectedDay?.prescriptions.some(
      (prescription) => prescription.exerciseId === previewExercise.id,
    ),
  );
  const dayStats = useMemo(() => summarizeDay(selectedDay), [selectedDay]);
  const candidates = useMemo(() => {
    if (!selectedDay) return [];
    return exerciseCandidatesForProgramDay(selectedDay, preferences, query)
      .filter((exercise) =>
        muscleFilter
          ? exercise.primaryMuscles.includes(muscleFilter) ||
            exercise.secondaryMuscles.includes(muscleFilter)
          : true,
      )
      .slice(0, 8);
  }, [muscleFilter, preferences, query, selectedDay]);

  async function persistProgram(nextProgram: TrainingProgram, message: string) {
    setSaving(true);
    setStatus(null);
    try {
      await saveProgram(nextProgram);
      setStatus(message);
    } catch {
      setStatus('Could not save day changes.');
    } finally {
      setSaving(false);
    }
  }

  function patchPrescription(index: number, patch: Partial<ExercisePrescription>) {
    persistProgram(updateProgramPrescription(program, dayIndex, index, patch), 'Day saved.');
  }

  function movePrescription(index: number, direction: -1 | 1) {
    persistProgram(
      moveProgramPrescription(program, dayIndex, index, index + direction),
      'Order saved.',
    );
  }

  function removePrescription(index: number) {
    persistProgram(removeProgramPrescription(program, dayIndex, index), 'Exercise removed.');
  }

  function addExercise(exercise: Exercise) {
    if (!selectedDay) return;
    const prescription = buildManualPrescription(
      exercise,
      selectedDay.prescriptions.length,
      preferences,
    );
    persistProgram(
      addProgramPrescription(program, dayIndex, prescription),
      `${exercise.name} added.`,
    );
    setPreviewExercise(null);
  }

  function startDay() {
    router.push({ pathname: '/workout', params: { day: String(dayIndex) } });
  }

  if (!selectedDay) {
    return (
      <View
        style={[
          styles.emptyScreen,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, spacing.xxl),
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Day not found</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          This program day is no longer available.
        </Text>
        <Button mode="contained" icon="arrow-left" onPress={backToProgram}>
          Back
        </Button>
      </View>
    );
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
      <View style={{ gap: spacing.md }}>
        <IconButton
          icon="chevron-left"
          iconColor={colors.textPrimary}
          accessibilityLabel="Back to plan"
          onPress={backToProgram}
          style={styles.backButton}
        />
        <View style={{ gap: spacing.xs, marginTop: -spacing.md }}>
          <Text style={[typography.display, { color: colors.textPrimary }]}>
            {selectedDay.name}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {selectedDay.prescriptions.length} exercises, {dayStats.sets} sets, about{' '}
            {selectedDay.estimatedMinutes} min
          </Text>
          {selectedDay.focus.length > 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {muscleLabels(selectedDay.focus)}. Changes save automatically.
            </Text>
          ) : null}
          {status ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{status}</Text>
          ) : null}
        </View>
        <Button mode="contained" onPress={startDay} contentStyle={styles.primaryContent}>
          Start {selectedDay.name}
        </Button>
      </View>

      <EditorSection title="Exercises">
        <View>
          {selectedDay.prescriptions.map((prescription, index) => (
            <View
              key={`${prescription.exerciseId}-${index}`}
              style={
                index < selectedDay.prescriptions.length - 1
                  ? {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    }
                  : undefined
              }
            >
              <PrescriptionEditorCard
                prescription={prescription}
                index={index}
                prescriptionCount={selectedDay.prescriptions.length}
                saving={saving}
                onPatch={(patch) => patchPrescription(index, patch)}
                onMoveUp={index > 0 ? () => movePrescription(index, -1) : undefined}
                onMoveDown={
                  index < selectedDay.prescriptions.length - 1
                    ? () => movePrescription(index, 1)
                    : undefined
                }
                onRemove={() => removePrescription(index)}
                onPreview={() => setPreviewExercise(requireExercise(prescription.exerciseId))}
              />
            </View>
          ))}
        </View>
      </EditorSection>

      <EditorSection title="Add an exercise">
        <View ref={inputAnchorRef} collapsable={false}>
          <Searchbar
            placeholder="Search movement, muscle, equipment"
            value={query}
            onChangeText={setQuery}
            onFocus={revealInput}
            mode="bar"
            iconColor={colors.textMuted}
            style={[styles.search, { backgroundColor: colors.surface, borderRadius: radius.lg }]}
            inputStyle={[typography.body, { color: colors.textPrimary, minHeight: 0 }]}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.focusRail}
        >
          <Pill label="All" active={muscleFilter == null} onPress={() => setMuscleFilter(null)} />
          {selectedDay.focus.map((muscle) => (
            <Pill
              key={muscle}
              label={MUSCLE_LABELS[muscle]}
              active={muscleFilter === muscle}
              onPress={() => setMuscleFilter((current) => (current === muscle ? null : muscle))}
            />
          ))}
        </ScrollView>

        {candidates.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No unused exercise matches this filter with your equipment.
          </Text>
        ) : (
          <View>
            {candidates.map((exercise, index) => (
              <Pressable
                key={exercise.id}
                onPress={() => setPreviewExercise(exercise)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${exercise.name}`}
                style={({ pressed }) => [
                  styles.candidateRow,
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
                    {muscleLabels(exercise.primaryMuscles)},{' '}
                    {exercise.movementPattern.replace(/_/g, ' ')}
                  </Text>
                </View>
                <MaterialCommunityIcons name="plus" size={22} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </EditorSection>

      <ExerciseDemoModal
        key={previewExercise?.id ?? 'closed'}
        exercise={previewExercise}
        actionLabel={previewAlreadySelected ? 'Done' : `Add to ${selectedDay.name}`}
        actionIcon={previewAlreadySelected ? 'check' : 'playlist-plus'}
        onAction={previewAlreadySelected ? () => setPreviewExercise(null) : addExercise}
        onDismiss={() => setPreviewExercise(null)}
      />
    </Animated.ScrollView>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

function PrescriptionEditorCard({
  prescription,
  index,
  prescriptionCount,
  saving,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
  onPreview,
}: {
  prescription: ExercisePrescription;
  index: number;
  prescriptionCount: number;
  saving: boolean;
  onPatch: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const { colors, typography } = useTheme();
  const exercise = requireExercise(prescription.exerciseId);
  const technique = prescription.setTechnique ?? 'standard';

  return (
    <View style={styles.prescriptionCard}>
      <View style={styles.headerRow}>
        <Text style={[typography.numeric, { color: colors.textMuted, width: 24 }]}>
          {index + 1}
        </Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{exercise.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
            {muscleLabels(exercise.primaryMuscles)}. {prescription.selectionReason}
          </Text>
        </View>
        <IconButton
          icon="close"
          size={20}
          iconColor={colors.textMuted}
          disabled={saving || prescriptionCount <= 1}
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={onRemove}
          style={styles.compactIcon}
        />
      </View>

      <View style={[styles.editorGrid, { paddingLeft: 36 }]}>
        <StepperControl
          label="Sets"
          value={prescription.workingSets}
          disabled={saving}
          onMinus={() => onPatch({ workingSets: clamp(prescription.workingSets - 1, 1, 5) })}
          onPlus={() => onPatch({ workingSets: clamp(prescription.workingSets + 1, 1, 5) })}
        />
        <StepperControl
          label="Min reps"
          value={prescription.minReps}
          disabled={saving}
          onMinus={() =>
            onPatch({ minReps: clamp(prescription.minReps - 1, 1, prescription.maxReps) })
          }
          onPlus={() =>
            onPatch({ minReps: clamp(prescription.minReps + 1, 1, prescription.maxReps) })
          }
        />
        <StepperControl
          label="Max reps"
          value={prescription.maxReps}
          disabled={saving}
          onMinus={() =>
            onPatch({ maxReps: clamp(prescription.maxReps - 1, prescription.minReps, 30) })
          }
          onPlus={() =>
            onPatch({ maxReps: clamp(prescription.maxReps + 1, prescription.minReps, 30) })
          }
        />
        <StepperControl
          label="RIR"
          value={prescription.targetRir}
          disabled={saving}
          onMinus={() => onPatch({ targetRir: clamp(prescription.targetRir - 1, 0, 5) })}
          onPlus={() => onPatch({ targetRir: clamp(prescription.targetRir + 1, 0, 5) })}
        />
        <StepperControl
          label="Rest"
          value={formatShortRest(prescription.restSeconds)}
          disabled={saving}
          onMinus={() => onPatch({ restSeconds: clamp(prescription.restSeconds - 30, 45, 300) })}
          onPlus={() => onPatch({ restSeconds: clamp(prescription.restSeconds + 30, 45, 300) })}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.techniqueRail, { paddingLeft: 36 }]}
      >
        {TECHNIQUE_OPTIONS.map((option) => (
          <Pill
            key={option}
            label={TECHNIQUE_LABELS[option]}
            active={technique === option}
            onPress={() => {
              if (!saving) onPatch({ setTechnique: option === 'standard' ? undefined : option });
            }}
          />
        ))}
      </ScrollView>

      <View style={[styles.secondaryActionRow, { paddingLeft: 28 }]}>
        <Button compact mode="text" onPress={onPreview}>
          Technique
        </Button>
        <Button
          compact
          mode="text"
          textColor={prescription.supersetWithNext ? colors.accent : colors.textSecondary}
          disabled={saving || index >= prescriptionCount - 1}
          onPress={() => onPatch({ supersetWithNext: !prescription.supersetWithNext })}
        >
          {prescription.supersetWithNext ? 'Paired with next' : 'Pair with next'}
        </Button>
        <Button
          compact
          mode="text"
          textColor={colors.textSecondary}
          disabled={saving || !onMoveUp}
          onPress={onMoveUp}
          accessibilityLabel={`Move ${exercise.name} up`}
        >
          Up
        </Button>
        <Button
          compact
          mode="text"
          textColor={colors.textSecondary}
          disabled={saving || !onMoveDown}
          onPress={onMoveDown}
          accessibilityLabel={`Move ${exercise.name} down`}
        >
          Down
        </Button>
      </View>

      <View style={{ paddingLeft: 36 }}>
        <NoteField
          value={prescription.note}
          disabled={saving}
          onSave={(note) => onPatch({ note })}
        />
      </View>
    </View>
  );
}

function NoteField({
  value,
  disabled,
  onSave,
}: {
  value?: string;
  disabled: boolean;
  onSave: (note?: string) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value ?? '');

  function saveDraft() {
    const next = draft.trim();
    const normalized = next.length > 0 ? next : undefined;
    if ((value ?? '') !== (normalized ?? '')) {
      onSave(normalized);
    }
  }

  return (
    <TextInput
      theme={inputTheme}
      mode="outlined"
      dense
      multiline
      label="Note"
      value={draft}
      onChangeText={setDraft}
      onBlur={saveDraft}
      editable={!disabled}
      style={{ backgroundColor: colors.background }}
    />
  );
}

function parseDayParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function summarizeDay(day: ProgramDay | undefined): { sets: number } {
  if (!day) return { sets: 0 };
  return {
    sets: day.prescriptions.reduce((sum, prescription) => sum + prescription.workingSets, 0),
  };
}

function muscleLabels(muscles: MuscleGroup[]): string {
  return muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
}

function formatShortRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  emptyScreen: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  backButton: {
    marginLeft: -12,
    marginBottom: 0,
  },
  primaryContent: {
    minHeight: 52,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  focusRail: {
    gap: 8,
    paddingRight: 16,
  },
  prescriptionCard: {
    gap: 10,
    paddingVertical: 14,
  },
  compactIcon: {
    width: 40,
    height: 40,
    margin: 0,
  },
  editorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techniqueRail: {
    gap: 8,
    paddingRight: 16,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  search: {
    elevation: 0,
    height: 48,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
  },
});
