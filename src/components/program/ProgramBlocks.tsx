import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, IconButton, List } from 'react-native-paper';

import { VolumeLandmarkGauge } from '@/components/muscles/VolumeLandmarkGauge';
import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import type { RankedReplacement } from '@/domain/exercises/replacement';
import type {
  ProgramProgressionDay,
  ProgramProgressionSummary,
  ProgramProgressionTarget,
} from '@/domain/programs/programProgression';
import { formatTargetSummary } from '@/domain/workouts/targetToBeat';
import { volumeZoneLabel } from '@/domain/workouts/volumeLandmarks';
import { useTheme } from '@/theme';
import type { ExercisePrescription, Units } from '@/types';

import {
  clamp,
  formatRepRange,
  formatRest,
  formatShortRest,
  formatTechnique,
  type ProgramMuscleLoad,
} from '@/features/program/program.helpers';

/**
 * Presentational blocks used by the Plan screen. Pulled out of `program.tsx`
 * (originally 1,362 lines) since none of these need that screen's live
 * state — each takes explicit props, same pattern as workout.tsx's
 * WorkoutReviewBlocks.tsx extraction.
 */

export function DetailCard({
  eyebrow,
  title,
  titleRight,
  children,
}: {
  eyebrow: string;
  title: string;
  titleRight?: ReactNode;
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
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>{eyebrow}</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>{title}</Text>
          </View>
          {titleRight}
        </View>
        {children}
      </Card.Content>
    </Card>
  );
}

export function MetricBlock({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metricBlock, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

export function ProgressionCockpit({
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

export function ProgressionTargetRow({
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

export function ProgramReadinessRow({ day }: { day: ProgramProgressionDay }) {
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

export function ProgramExerciseRow({
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
            onMinus={() =>
              onPatch({ restSeconds: clamp(prescription.restSeconds - 30, 45, 300) })
            }
            onPlus={() =>
              onPatch({ restSeconds: clamp(prescription.restSeconds + 30, 45, 300) })
            }
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

export function StepperControl({
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

export function SwapPanel({
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
              left={() => <ExerciseThumbnail exercise={option.exercise} />}
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

export function VolumeRow({ item }: { item: ProgramMuscleLoad }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.volumeRow}>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
        {MUSCLE_LABELS[item.muscle]}
      </Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>
        {item.sets} sets/wk · {volumeZoneLabel(item.zone)} · MEV {item.mev} / MRV {item.mrv}
      </Text>
      <VolumeLandmarkGauge landmarks={item.landmarks} weeklySets={item.sets} zone={item.zone} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  volumeRow: {
    gap: 6,
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
