import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import {
  addProgramPrescription,
  buildManualPrescription,
  exerciseCandidatesForProgramDay,
  moveProgramPrescription,
  removeProgramPrescription,
  updateProgramPrescription,
} from '@/domain/programs/programEditing';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
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
  const params = useLocalSearchParams<{ day?: string | string[] }>();
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { preferences, program, saveProgram } = useActiveProgram();
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const dayIndex = useMemo(() => parseDayParam(params.day), [params.day]);
  const selectedDay = program.days[dayIndex];
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
        <Button mode="contained" icon="arrow-left" onPress={() => router.back()}>
          Back
        </Button>
      </View>
    );
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
          <Text style={[typography.micro, { color: colors.accent }]}>Day editor</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{selectedDay.name}</Text>
        </View>
        <Button mode="contained" icon="play" onPress={startDay}>
          Start
        </Button>
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
        <Card.Content style={{ gap: spacing.lg }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.micro, { color: colors.accent }]}>Programming surface</Text>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                Edit prescription before logging
              </Text>
            </View>
            <Chip compact mode="flat" icon="content-save-check">
              Local
            </Chip>
          </View>

          <View style={styles.metricGrid}>
            <MetricBlock label="exercises" value={String(selectedDay.prescriptions.length)} />
            <MetricBlock label="sets" value={String(dayStats.sets)} />
            <MetricBlock label="est." value={`${selectedDay.estimatedMinutes}m`} />
          </View>

          <View style={styles.focusRow}>
            {selectedDay.focus.map((muscle) => (
              <Chip key={muscle} compact mode="outlined">
                {MUSCLE_LABELS[muscle]}
              </Chip>
            ))}
          </View>

          {status ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{status}</Text>
          ) : null}
        </Card.Content>
      </Card>

      <EditorSection eyebrow="Prescription" title="Exercise stack">
        {selectedDay.prescriptions.map((prescription, index) => (
          <View key={`${prescription.exerciseId}-${index}`}>
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
            />
            {index < selectedDay.prescriptions.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </EditorSection>

      <EditorSection eyebrow="Add exercise" title="Compatible catalog">
        <Searchbar
          placeholder="Search movement, muscle, equipment"
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
          contentContainerStyle={styles.focusRail}
        >
          <Chip
            compact
            selected={muscleFilter == null}
            mode={muscleFilter == null ? 'flat' : 'outlined'}
            onPress={() => setMuscleFilter(null)}
          >
            All
          </Chip>
          {selectedDay.focus.map((muscle) => (
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
            No unused exercise matches this filter with the current equipment.
          </Text>
        ) : (
          candidates.map((exercise, index) => (
            <View key={exercise.id}>
              <List.Item
                title={exercise.name}
                description={`${muscleLabels(exercise.primaryMuscles)} - ${exercise.movementPattern.replace(/_/g, ' ')}`}
                onPress={() => addExercise(exercise)}
                disabled={saving}
                left={(props) => <List.Icon {...props} icon="plus-circle" color={colors.accent} />}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
                )}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                style={[styles.candidateRow, { backgroundColor: colors.surfaceRaised }]}
              />
              {index < candidates.length - 1 ? <View style={{ height: spacing.sm }} /> : null}
            </View>
          ))
        )}
      </EditorSection>
    </Animated.ScrollView>
  );
}

function EditorSection({
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

function PrescriptionEditorCard({
  prescription,
  index,
  prescriptionCount,
  saving,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  prescription: ExercisePrescription;
  index: number;
  prescriptionCount: number;
  saving: boolean;
  onPatch: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
}) {
  const { colors, typography } = useTheme();
  const exercise = requireExercise(prescription.exerciseId);
  const technique = prescription.setTechnique ?? 'standard';

  return (
    <View style={styles.prescriptionCard}>
      <View style={styles.orderColumn}>
        <IconButton
          icon="chevron-up"
          size={15}
          mode="contained-tonal"
          disabled={saving || !onMoveUp}
          onPress={onMoveUp}
          style={styles.orderMoveButton}
        />
        <View style={[styles.orderBadge, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>{index + 1}</Text>
        </View>
        <IconButton
          icon="chevron-down"
          size={15}
          mode="contained-tonal"
          disabled={saving || !onMoveDown}
          onPress={onMoveDown}
          style={styles.orderMoveButton}
        />
      </View>

      <View style={{ flex: 1, gap: 10 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              {exercise.name}
            </Text>
            <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={2}>
              {muscleLabels(exercise.primaryMuscles)} - {prescription.selectionReason}
            </Text>
          </View>
          <IconButton
            icon="trash-can-outline"
            mode="contained-tonal"
            size={17}
            disabled={saving || prescriptionCount <= 1}
            onPress={onRemove}
            style={styles.compactIcon}
          />
        </View>

        <View style={styles.editorGrid}>
          <StepperControl
            label="sets"
            value={prescription.workingSets}
            disabled={saving}
            onMinus={() => onPatch({ workingSets: clamp(prescription.workingSets - 1, 1, 5) })}
            onPlus={() => onPatch({ workingSets: clamp(prescription.workingSets + 1, 1, 5) })}
          />
          <StepperControl
            label="min"
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
            label="max"
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
            label="rest"
            value={formatShortRest(prescription.restSeconds)}
            disabled={saving}
            onMinus={() => onPatch({ restSeconds: clamp(prescription.restSeconds - 30, 45, 300) })}
            onPlus={() => onPatch({ restSeconds: clamp(prescription.restSeconds + 30, 45, 300) })}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.techniqueRail}
        >
          {TECHNIQUE_OPTIONS.map((option) => (
            <Chip
              key={option}
              compact
              selected={technique === option}
              mode={technique === option ? 'flat' : 'outlined'}
              icon={option === 'standard' ? 'check-circle-outline' : 'fire'}
              disabled={saving}
              onPress={() => onPatch({ setTechnique: option === 'standard' ? undefined : option })}
            >
              {TECHNIQUE_LABELS[option]}
            </Chip>
          ))}
        </ScrollView>

        <View style={styles.secondaryActionRow}>
          <Button
            compact
            mode={prescription.supersetWithNext ? 'contained-tonal' : 'outlined'}
            icon="link-variant"
            disabled={saving || index >= prescriptionCount - 1}
            onPress={() => onPatch({ supersetWithNext: !prescription.supersetWithNext })}
          >
            Superset next
          </Button>
          {index >= prescriptionCount - 1 ? (
            <Text style={[typography.micro, { color: colors.textMuted }]}>
              Last exercise cannot chain forward.
            </Text>
          ) : null}
        </View>

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
      mode="outlined"
      dense
      multiline
      label="Coach note"
      value={draft}
      onChangeText={setDraft}
      onBlur={saveDraft}
      editable={!disabled}
      style={{ backgroundColor: colors.surfaceRaised }}
    />
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

function StepperControl({
  label,
  value,
  disabled,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string | number;
  disabled: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.stepper, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <IconButton
          icon="minus"
          size={15}
          mode="contained-tonal"
          disabled={disabled}
          onPress={onMinus}
          style={styles.stepperButton}
        />
        <Text style={[typography.captionBold, { color: colors.textPrimary }]}>{value}</Text>
        <IconButton
          icon="plus"
          size={15}
          mode="contained-tonal"
          disabled={disabled}
          onPress={onPlus}
          style={styles.stepperButton}
        />
      </View>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusRail: {
    gap: 8,
    paddingRight: 16,
  },
  prescriptionCard: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  orderColumn: {
    alignItems: 'center',
    gap: 4,
  },
  orderMoveButton: {
    width: 28,
    height: 28,
    margin: 0,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: {
    width: 34,
    height: 34,
    margin: 0,
  },
  editorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepper: {
    minWidth: 76,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  stepperButton: {
    width: 28,
    height: 28,
    margin: 0,
  },
  techniqueRail: {
    gap: 8,
    paddingRight: 16,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  search: {
    borderRadius: 16,
  },
  candidateRow: {
    borderRadius: 14,
  },
});
