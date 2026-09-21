import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { Button, Card, Chip, Divider, IconButton, List, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Reveal } from '@/components/ui/Reveal';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import { rankReplacements, type RankedReplacement } from '@/domain/exercises/replacement';
import { bodySlugsForMuscle, heatColorForVolumeZone } from '@/domain/muscles/muscleMap';
import {
  moveProgramPrescription,
  updateProgramPrescription,
} from '@/domain/programs/programEditing';
import {
  buildProgramProgressionSummary,
  type ProgramProgressionDay,
  type ProgramProgressionSummary,
  type ProgramProgressionTarget,
} from '@/domain/programs/programProgression';
import { listTemplates, saveTemplate } from '@/domain/programs/templateStore';
import {
  buildTemplateFromProgramDay,
  defaultProgramDayTemplateName,
  type WorkoutTemplate,
} from '@/domain/programs/templates';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { formatTargetSummary } from '@/domain/workouts/targetToBeat';
import {
  classifyWeeklyVolume,
  volumeZoneLabel,
  type VolumeZone,
} from '@/domain/workouts/volumeLandmarks';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type {
  ExercisePrescription,
  MuscleGroup,
  ProgramDay,
  TrainingPreferences,
  TrainingProgram,
  Units,
  WorkoutSession,
} from '@/types';

type SwapTarget = {
  dayIndex: number;
  prescriptionIndex: number;
} | null;

type ProgramMuscleLoad = {
  muscle: MuscleGroup;
  sets: number;
  zone: VolumeZone;
  mev: number;
  mrv: number;
  gaugeFraction: number;
};

export default function ProgramScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, program, source, saveProgram, resetProgram } = useActiveProgram();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [swapTarget, setSwapTarget] = useState<SwapTarget>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const selectedDay = program.days[selectedDayIndex] ?? program.days[0];
  const dayStats = useMemo(() => summarizeDay(selectedDay), [selectedDay]);
  const muscleLoads = useMemo(() => computeProgramMuscleLoads(program.days), [program.days]);
  const bodyData = useMemo(() => buildBodyData(muscleLoads), [muscleLoads]);
  const progressionSummary = useMemo(
    () =>
      buildProgramProgressionSummary({
        days: program.days,
        history,
        userExperience: preferences.experience,
        nutritionContext: preferences.nutritionContext,
        priorityMuscles: preferences.musclePriorities,
        units: preferences.units,
      }),
    [
      history,
      preferences.experience,
      preferences.musclePriorities,
      preferences.nutritionContext,
      preferences.units,
      program.days,
    ],
  );
  const swapOptions = useMemo(
    () => buildSwapOptions(program, selectedDayIndex, swapTarget, preferences),
    [preferences, program, selectedDayIndex, swapTarget],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([listTemplates(), listWorkoutHistory()]).then(([nextTemplates, nextHistory]) => {
        if (!mounted) return;
        setTemplates(nextTemplates);
        setHistory(nextHistory);
      });
      return () => {
        mounted = false;
      };
    }, []),
  );

  function startDay(index = selectedDayIndex) {
    router.push({ pathname: '/workout', params: { day: String(index) } });
  }

  function editDay(index = selectedDayIndex) {
    router.push({ pathname: '/program-day/[day]', params: { day: String(index) } });
  }

  function startTemplate(templateId: string) {
    router.push({ pathname: '/workout', params: { templateId } });
  }

  async function persistProgram(nextProgram: TrainingProgram, message: string) {
    setSaving(true);
    setStatus(null);
    try {
      await saveProgram(nextProgram);
      setStatus(message);
    } catch {
      setStatus('Could not save program changes.');
    } finally {
      setSaving(false);
    }
  }

  function patchPrescription(prescriptionIndex: number, patch: Partial<ExercisePrescription>) {
    const nextProgram = updateProgramPrescription(
      program,
      selectedDayIndex,
      prescriptionIndex,
      patch,
    );
    persistProgram(nextProgram, 'Program saved.');
  }

  function movePrescription(prescriptionIndex: number, direction: -1 | 1) {
    const nextProgram = moveProgramPrescription(
      program,
      selectedDayIndex,
      prescriptionIndex,
      prescriptionIndex + direction,
    );
    persistProgram(nextProgram, 'Exercise order saved.');
  }

  function replacePrescription(option: RankedReplacement) {
    if (!swapTarget) return;
    const nextProgram = updateProgramPrescription(
      program,
      swapTarget.dayIndex,
      swapTarget.prescriptionIndex,
      {
        exerciseId: option.exercise.id,
        selectionReason: option.rationale,
      },
    );
    setSwapTarget(null);
    persistProgram(nextProgram, `Swapped to ${option.exercise.name}.`);
  }

  async function resetGeneratedProgram() {
    setSaving(true);
    setStatus(null);
    try {
      await resetProgram();
      setSelectedDayIndex(0);
      setSwapTarget(null);
      setStatus('Generated plan restored.');
    } catch {
      setStatus('Could not reset program.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedDayAsTemplate() {
    if (!selectedDay) return;
    setSaving(true);
    setStatus(null);
    try {
      const template = await saveTemplate(
        buildTemplateFromProgramDay(selectedDay, defaultProgramDayTemplateName(selectedDay.name)),
      );
      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
      setStatus(`${template.name} saved as template.`);
    } catch {
      setStatus('Could not save day as template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <Reveal>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Mesocycle command</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Program</Text>
          </View>
          <Chip compact mode="flat" icon="calendar-week">
            {program.daysPerWeek}d/wk
          </Chip>
        </View>
      </Reveal>

      <Reveal index={1}>
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
                <Text style={[typography.micro, { color: colors.accent }]}>Active split</Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {program.name}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Chip
                  compact
                  mode="flat"
                  icon={source === 'local' ? 'content-save-check' : 'auto-fix'}
                >
                  {source === 'local' ? 'Edited' : 'Generated'}
                </Chip>
                <Button
                  compact
                  mode="outlined"
                  icon="book-open-variant"
                  disabled={saving}
                  onPress={() => router.push('/program-library')}
                >
                  Library
                </Button>
                <Button
                  compact
                  mode="outlined"
                  icon="playlist-plus"
                  disabled={saving}
                  onPress={() => router.push('/program-builder')}
                >
                  Build
                </Button>
                <Button
                  compact
                  mode="outlined"
                  icon="restart"
                  disabled={saving}
                  onPress={resetGeneratedProgram}
                >
                  Reset
                </Button>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricBlock label="days" value={String(program.days.length)} />
              <MetricBlock label="session" value={`${preferences.sessionMinutes}m`} />
              <MetricBlock label="goal" value={formatGoal(preferences.goal)} />
            </View>

            <View style={styles.chipRow}>
              {preferences.musclePriorities.length > 0 ? (
                preferences.musclePriorities.map((muscle) => (
                  <Chip key={muscle} compact mode="outlined">
                    {MUSCLE_LABELS[muscle]}
                  </Chip>
                ))
              ) : (
                <Chip compact mode="outlined">
                  Balanced week
                </Chip>
              )}
            </View>

            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Equipment: {formatEquipmentSummary(preferences.equipment)}
            </Text>

            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {program.rationale}
            </Text>
            {status ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>{status}</Text>
            ) : null}
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <ProgressionCockpit summary={progressionSummary} units={preferences.units} />
      </Reveal>

      <Reveal index={3}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRail}
        >
          {program.days.map((day, index) => (
            <Chip
              key={day.id}
              compact
              selected={selectedDayIndex === index}
              mode={selectedDayIndex === index ? 'flat' : 'outlined'}
              onPress={() => setSelectedDayIndex(index)}
              style={
                selectedDayIndex === index ? { backgroundColor: colors.accentSoft } : undefined
              }
              textStyle={selectedDayIndex === index ? { color: colors.accent } : undefined}
            >
              {day.name}
            </Chip>
          ))}
        </ScrollView>
      </Reveal>

      <Reveal index={4}>
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
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.micro, { color: colors.accent }]}>Selected day</Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {selectedDay.name}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Button
                  compact
                  mode="outlined"
                  icon="content-save-outline"
                  disabled={saving}
                  onPress={saveSelectedDayAsTemplate}
                >
                  Template
                </Button>
                <Button compact mode="outlined" icon="pencil" onPress={() => editDay()}>
                  Edit
                </Button>
                <Button
                  compact
                  mode="outlined"
                  icon="playlist-plus"
                  onPress={() => router.push('/custom-workout')}
                >
                  Custom
                </Button>
                <Button mode="contained" icon="play" onPress={() => startDay()}>
                  Start
                </Button>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricBlock label="exercises" value={String(selectedDay.prescriptions.length)} />
              <MetricBlock label="sets" value={String(dayStats.sets)} />
              <MetricBlock label="est." value={`${selectedDay.estimatedMinutes}m`} />
            </View>

            <View style={styles.focusRow}>
              {selectedDay.focus.map((muscle) => (
                <Chip key={muscle} compact mode="flat">
                  {MUSCLE_LABELS[muscle]}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={5}>
        <DetailCard eyebrow="Prescription" title="Exercise order">
          {selectedDay.prescriptions.map((prescription, index) => (
            <View key={`${prescription.exerciseId}-${index}`}>
              <ProgramExerciseRow
                prescription={prescription}
                index={index}
                saving={saving}
                swapOpen={
                  swapTarget?.dayIndex === selectedDayIndex &&
                  swapTarget.prescriptionIndex === index
                }
                onPatch={(patch) => patchPrescription(index, patch)}
                onMoveUp={index > 0 ? () => movePrescription(index, -1) : undefined}
                onMoveDown={
                  index < selectedDay.prescriptions.length - 1
                    ? () => movePrescription(index, 1)
                    : undefined
                }
                onSwap={() =>
                  setSwapTarget((current) =>
                    current?.dayIndex === selectedDayIndex && current.prescriptionIndex === index
                      ? null
                      : { dayIndex: selectedDayIndex, prescriptionIndex: index },
                  )
                }
              />
              {swapTarget?.dayIndex === selectedDayIndex &&
              swapTarget.prescriptionIndex === index ? (
                <SwapPanel
                  options={swapOptions}
                  saving={saving}
                  onSelect={replacePrescription}
                  onCancel={() => setSwapTarget(null)}
                />
              ) : null}
              {index < selectedDay.prescriptions.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </DetailCard>
      </Reveal>

      <Reveal index={6}>
        <DetailCard eyebrow="Weekly dose" title="Muscle volume">
          <View style={styles.bodyRow}>
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="front"
              scale={0.34}
              border="none"
              defaultFill={colors.surfacePressed}
              defaultStroke={colors.border}
            />
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="back"
              scale={0.34}
              border="none"
              defaultFill={colors.surfacePressed}
              defaultStroke={colors.border}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            {muscleLoads.slice(0, 6).map((item) => (
              <VolumeRow key={item.muscle} item={item} />
            ))}
          </View>
        </DetailCard>
      </Reveal>

      <Reveal index={7}>
        <DetailCard eyebrow="Saved templates" title="Replayable days">
          {templates.length === 0 ? (
            <List.Item
              title="No saved templates yet"
              description="Finish a workout and save it as a template to replay a custom day here."
              left={(props) => (
                <List.Icon {...props} icon="content-save-outline" color={colors.accent} />
              )}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
            />
          ) : (
            templates.slice(0, 4).map((template, index) => (
              <View key={template.id}>
                <List.Item
                  title={template.name}
                  description={`${template.day.prescriptions.length} exercises · est. ${template.day.estimatedMinutes}m`}
                  onPress={() => startTemplate(template.id)}
                  left={(props) => (
                    <List.Icon {...props} icon="playlist-play" color={colors.accent} />
                  )}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
                  )}
                  titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                  descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                />
                {index < Math.min(templates.length, 4) - 1 ? <Divider /> : null}
              </View>
            ))
          )}
        </DetailCard>
      </Reveal>
    </Animated.ScrollView>
  );
}

function formatGoal(goal: TrainingPreferences['goal']): string {
  if (goal === 'hypertrophy') return 'muscle';
  if (goal === 'strength') return 'strength';
  return 'mixed';
}

function formatEquipmentSummary(equipment: TrainingPreferences['equipment']): string {
  const visible = equipment.slice(0, 4).map((item) => item.replace(/_/g, ' '));
  const remainder = equipment.length - visible.length;
  return `${visible.join(', ')}${remainder > 0 ? ` +${remainder}` : ''}`;
}

function DetailCard({
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

function ProgressionCockpit({
  summary,
  units,
}: {
  summary: ProgramProgressionSummary;
  units: Units;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const topTargets = summary.priorityTargets.slice(0, 3);

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.micro, { color: colors.accent }]}>Progression engine</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Program cockpit
            </Text>
          </View>
          <Chip compact mode="flat" icon="radar">
            {summary.readyToProgressCount} active
          </Chip>
        </View>

        <View
          style={[
            styles.progressionHero,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
        >
          <Text style={[typography.heading, { color: colors.textPrimary }]}>
            {summary.headline}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {summary.detail}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricBlock label="load jumps" value={String(summary.actionCounts.increase_load)} />
          <MetricBlock label="rep targets" value={String(summary.actionCounts.increase_reps)} />
          <MetricBlock label="calibrate" value={String(summary.calibrationCount)} />
        </View>

        {topTargets.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {topTargets.map((target) => (
              <ProgressionTargetRow
                key={`${target.dayId}-${target.exerciseId}`}
                target={target}
                units={units}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.emptyProgressionPanel, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
              No urgent target
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              The engine is holding the week steady. Make RIR and execution consistent.
            </Text>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          {summary.days.map((day) => (
            <ProgramReadinessRow key={day.dayId} day={day} />
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function ProgressionTargetRow({
  target,
  units,
}: {
  target: ProgramProgressionTarget;
  units: Units;
}) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.progressionRow,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      <View style={[styles.actionBadge, { backgroundColor: colors.accentSoft }]}>
        <Text style={[typography.micro, { color: colors.accent }]} numberOfLines={1}>
          {target.actionLabel}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {target.exerciseName}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={2}>
          {target.dayName} · {formatTargetSummary(target.target, units)}
        </Text>
      </View>
      <Chip compact mode="outlined">
        {target.confidence === 'high'
          ? '2+ sessions'
          : target.confidence === 'medium'
            ? '1 session'
            : 'limited data'}
      </Chip>
    </View>
  );
}

function ProgramReadinessRow({ day }: { day: ProgramProgressionDay }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.readinessRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {day.dayName}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={1}>
          {day.readinessDetail}
        </Text>
      </View>
      <Chip compact mode="flat" icon="pulse">
        {day.readinessLabel}
      </Chip>
    </View>
  );
}

function ProgramExerciseRow({
  prescription,
  index,
  saving,
  swapOpen,
  onPatch,
  onMoveUp,
  onMoveDown,
  onSwap,
}: {
  prescription: ExercisePrescription;
  index: number;
  saving: boolean;
  swapOpen: boolean;
  onPatch: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSwap: () => void;
}) {
  const { colors, typography } = useTheme();
  const exercise = requireExercise(prescription.exerciseId);
  const primary = exercise.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');

  return (
    <View style={styles.exerciseRow}>
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
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{exercise.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {prescription.workingSets} x {formatRepRange(prescription)} · RIR {prescription.targetRir}{' '}
          · {formatRest(prescription.restSeconds)}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={2}>
          {primary} · {prescription.selectionReason}
        </Text>
        <View style={styles.rowChipRail}>
          {prescription.setTechnique && prescription.setTechnique !== 'standard' ? (
            <Chip compact mode="flat" icon="fire" style={{ backgroundColor: colors.accentSoft }}>
              {formatTechnique(prescription.setTechnique)}
            </Chip>
          ) : null}
          {prescription.supersetWithNext ? (
            <Chip
              compact
              mode="flat"
              icon="link-variant"
              style={{ backgroundColor: colors.infoSoft }}
            >
              Superset next
            </Chip>
          ) : null}
        </View>
        {prescription.note ? (
          <Text style={[typography.micro, { color: colors.accent }]} numberOfLines={2}>
            {prescription.note}
          </Text>
        ) : null}
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
        <Button
          compact
          mode={swapOpen ? 'contained-tonal' : 'outlined'}
          icon="swap-horizontal"
          onPress={onSwap}
          disabled={saving}
          style={styles.swapButton}
        >
          {swapOpen ? 'Close swaps' : 'Swap exercise'}
        </Button>
      </View>
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

function SwapPanel({
  options,
  saving,
  onSelect,
  onCancel,
}: {
  options: RankedReplacement[];
  saving: boolean;
  onSelect: (option: RankedReplacement) => void;
  onCancel: () => void;
}) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.swapPanel,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
            Suggested swaps
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            Same target first, then mechanics and equipment fit.
          </Text>
        </View>
        <Button compact mode="text" onPress={onCancel}>
          Cancel
        </Button>
      </View>
      {options.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          No available substitutes match this muscle with your current equipment.
        </Text>
      ) : (
        options
          .slice(0, 5)
          .map((option) => (
            <List.Item
              key={option.exercise.id}
              title={option.exercise.name}
              description={`${option.exercise.primaryMuscles
                .map((muscle) => MUSCLE_LABELS[muscle])
                .join(', ')} · ${option.exercise.equipment.join(', ')}`}
              onPress={() => onSelect(option)}
              disabled={saving}
              left={(props) => (
                <List.Icon {...props} icon="swap-horizontal" color={colors.accent} />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
              )}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
            />
          ))
      )}
    </View>
  );
}

function VolumeRow({ item }: { item: ProgramMuscleLoad }) {
  const { colors, typography } = useTheme();
  const zoneColor = heatColorForVolumeZone(item.zone);

  return (
    <View style={styles.volumeRow}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
          {MUSCLE_LABELS[item.muscle]}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]}>
          {item.sets} sets/wk · {volumeZoneLabel(item.zone)} · MEV {item.mev} / MRV {item.mrv}
        </Text>
      </View>
      <View style={styles.volumeMeter}>
        <Text style={[typography.micro, { color: colors.textMuted }]}>{item.sets}</Text>
        <ProgressBar
          progress={Math.min(1, item.gaugeFraction)}
          color={zoneColor}
          style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
        />
      </View>
    </View>
  );
}

function buildSwapOptions(
  program: TrainingProgram,
  selectedDayIndex: number,
  swapTarget: SwapTarget,
  preferences: TrainingPreferences,
): RankedReplacement[] {
  if (!swapTarget || swapTarget.dayIndex !== selectedDayIndex) return [];
  const day = program.days[swapTarget.dayIndex];
  const prescription = day?.prescriptions[swapTarget.prescriptionIndex];
  if (!day || !prescription) return [];

  return rankReplacements({
    original: requireExercise(prescription.exerciseId),
    reason: 'general',
    equipment: preferences.equipment,
    prefs: preferences,
    usedExerciseIds: day.prescriptions.map((item) => item.exerciseId),
  });
}

function computeProgramMuscleLoads(days: ProgramDay[]): ProgramMuscleLoad[] {
  const setsByMuscle: Partial<Record<MuscleGroup, number>> = {};
  for (const day of days) {
    for (const prescription of day.prescriptions) {
      const exercise = requireExercise(prescription.exerciseId);
      for (const muscle of exercise.primaryMuscles) {
        setsByMuscle[muscle] = (setsByMuscle[muscle] ?? 0) + prescription.workingSets;
      }
    }
  }

  return (Object.entries(setsByMuscle) as [MuscleGroup, number][])
    .map(([muscle, sets]) => {
      const classification = classifyWeeklyVolume(muscle, sets);
      return {
        muscle,
        sets,
        zone: classification.zone,
        mev: classification.landmarks.mev,
        mrv: classification.landmarks.mrv,
        gaugeFraction: classification.gaugeFraction,
      };
    })
    .sort(
      (a, b) => b.sets - a.sets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]),
    );
}

function buildBodyData(muscleLoads: ProgramMuscleLoad[]): ExtendedBodyPart[] {
  return muscleLoads.flatMap((item) => {
    const fill = heatColorForVolumeZone(item.zone);
    return bodySlugsForMuscle(item.muscle).map((slug) => ({
      slug,
      intensity: item.zone === 'below_mv' ? 1 : 2,
      styles: {
        fill: withAlpha(fill, item.zone === 'below_mv' ? '72' : 'B8'),
        stroke: fill,
        strokeWidth: 0.35,
      },
    }));
  });
}

function summarizeDay(day: ProgramDay | undefined): { sets: number } {
  if (!day) return { sets: 0 };
  return {
    sets: day.prescriptions.reduce((sum, prescription) => sum + prescription.workingSets, 0),
  };
}

function formatRepRange(prescription: ExercisePrescription): string {
  return `${prescription.minReps}-${prescription.maxReps}`;
}

function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes}m rest`;
  return `${minutes}:${String(remainder).padStart(2, '0')} rest`;
}

function formatShortRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatTechnique(technique: NonNullable<ExercisePrescription['setTechnique']>): string {
  switch (technique) {
    case 'drop_set':
      return 'Drop set';
    case 'rest_pause':
      return 'Rest-pause';
    case 'myo_reps':
      return 'Myo-reps';
    case 'cluster_set':
      return 'Cluster';
    case 'top_backoff':
      return 'Top + backoff';
    default:
      return 'Standard';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayRail: {
    gap: 8,
    paddingRight: 16,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  orderColumn: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 0,
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
  editorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  rowChipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  swapButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  swapPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    marginBottom: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  volumeMeter: {
    width: 104,
    gap: 5,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  listPanel: {
    borderRadius: 14,
  },
  progressionHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  progressionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBadge: {
    minWidth: 72,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignItems: 'center',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyProgressionPanel: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
});
