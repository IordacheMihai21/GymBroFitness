import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, IconButton, List } from 'react-native-paper';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { VolumeLandmarkGauge } from '@/components/muscles/VolumeLandmarkGauge';
import { ExerciseThumbnail } from '@/components/exercise/ExerciseThumbnail';
import { durations, easeOutExpo } from '@/components/ui/motion';
import { Tile } from '@/components/ui/Tile';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import type { RankedReplacement } from '@/domain/exercises/replacement';
import type {
  ProgramProgressionDay,
  ProgramProgressionSummary,
  ProgramProgressionTarget,
} from '@/domain/programs/programProgression';
import { isPerSide, loadMeaning } from '@/domain/workouts/laterality';
import { formatTargetSummary } from '@/domain/workouts/targetToBeat';
import { volumeZoneLabel } from '@/domain/workouts/volumeLandmarks';
import { useTheme } from '@/theme';
import type { ExercisePrescription, Units } from '@/types';

import {
  clamp,
  formatRepRange,
  formatShortRest,
  formatTechnique,
  type ProgramMuscleLoad,
} from '@/features/program/program.helpers';

/**
 * Presentational blocks used by the Plan screen. Sections sit on the canvas
 * with a plain heading; boxes are reserved for things that float or demand a
 * decision.
 */

export function DetailCard({
  title,
  titleRight,
  children,
}: {
  title: string;
  titleRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tile title={title} aside={titleRight}>
      {children}
    </Tile>
  );
}

export function MetricBlock({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metricBlock}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
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
  const { colors, spacing, typography } = useTheme();
  const topTargets = summary.priorityTargets.slice(0, 3);

  return (
    <DetailCard title="Progression">
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{summary.headline}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{summary.detail}</Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricBlock label="add weight" value={String(summary.actionCounts.increase_load)} />
        <MetricBlock label="add reps" value={String(summary.actionCounts.increase_reps)} />
        <MetricBlock label="to calibrate" value={String(summary.calibrationCount)} />
      </View>

      {topTargets.length > 0 ? (
        <View>
          {topTargets.map((target) => (
            <ProgressionTargetRow
              key={`${target.dayId}-${target.exerciseId}`}
              target={target}
              units={units}
            />
          ))}
        </View>
      ) : (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Nothing to change yet. Keep logging RIR and the targets will appear here.
        </Text>
      )}

      <View>
        {summary.days.map((day) => (
          <ProgramReadinessRow key={day.dayId} day={day} />
        ))}
      </View>
    </DetailCard>
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
  const confidence =
    target.confidence === 'high'
      ? 'based on 2+ sessions'
      : target.confidence === 'medium'
        ? 'based on 1 session'
        : 'limited data';

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {target.exerciseName}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
          {target.dayName}: {formatTargetSummary(target.target, units).replace(/\.$/, '')},{' '}
          {confidence}
        </Text>
      </View>
      <Text style={[typography.captionBold, { color: colors.accent }]} numberOfLines={1}>
        {target.actionLabel}
      </Text>
    </View>
  );
}

export function ProgramReadinessRow({ day }: { day: ProgramProgressionDay }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {day.dayName}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
          {day.readinessDetail}
        </Text>
      </View>
      <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
        {day.readinessLabel}
      </Text>
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
  lastLabel,
}: {
  lastLabel?: string | null;
  prescription: ExercisePrescription;
  index: number;
  saving: boolean;
  swapOpen: boolean;
  onPatch: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSwap: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const [editing, setEditing] = useState(false);
  const exercise = requireExercise(prescription.exerciseId);
  const primary = exercise.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
  const perSide = isPerSide({ exerciseId: prescription.exerciseId, prescription });
  // A barbell is never pressed one side at a time.
  const canGoPerSide =
    (exercise.trackingType === 'weight_reps' || exercise.trackingType === 'weighted_bodyweight') &&
    (loadMeaning(exercise, false) !== 'total' || perSide);
  const tags = [
    prescription.setTechnique && prescription.setTechnique !== 'standard'
      ? formatTechnique(prescription.setTechnique)
      : null,
    prescription.supersetWithNext ? 'Superset with next' : null,
    perSide ? 'One side at a time' : null,
  ].filter((tag): tag is string => tag != null);

  return (
    <Animated.View
      layout={LinearTransition.duration(durations.base).easing(easeOutExpo)}
      style={[styles.exerciseRow, { gap: spacing.sm }]}
    >
      <View style={styles.exerciseHeader}>
        <Text style={[typography.numeric, { color: colors.textMuted, width: 24 }]}>
          {index + 1}
        </Text>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{exercise.name}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {prescription.workingSets} × {formatRepRange(prescription)}, RIR{' '}
            {prescription.targetRir}, rest {formatShortRest(prescription.restSeconds)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {primary}
          </Text>
          {lastLabel ? (
            <Text style={[typography.captionBold, { color: colors.accent }]} numberOfLines={1}>
              {lastLabel}
            </Text>
          ) : null}
          {tags.length > 0 ? (
            <Text style={[typography.captionBold, { color: colors.accent }]}>
              {tags.join(', ')}
            </Text>
          ) : null}
          {prescription.note ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
              {prescription.note}
            </Text>
          ) : null}
        </View>
        <Button
          compact
          mode="text"
          textColor={editing ? colors.accent : colors.textSecondary}
          onPress={() => setEditing((current) => !current)}
          accessibilityLabel={`${editing ? 'Close editor for' : 'Edit'} ${exercise.name}`}
        >
          {editing ? 'Done' : 'Edit'}
        </Button>
      </View>

      {editing ? (
        <Animated.View
          entering={FadeInDown.duration(durations.base).easing(easeOutExpo)}
          exiting={FadeOut.duration(durations.fast)}
          style={{ gap: spacing.sm, paddingLeft: 36 }}
        >
          <View style={styles.editorGrid}>
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
              onMinus={() =>
                onPatch({ restSeconds: clamp(prescription.restSeconds - 30, 45, 300) })
              }
              onPlus={() => onPatch({ restSeconds: clamp(prescription.restSeconds + 30, 45, 300) })}
            />
          </View>
          {canGoPerSide ? (
            <Button
              compact
              mode="text"
              icon={perSide ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
              textColor={perSide ? colors.accent : colors.textSecondary}
              disabled={saving}
              onPress={() => onPatch({ perSide: !perSide })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: perSide }}
              style={styles.perSideToggle}
            >
              One side at a time
            </Button>
          ) : null}
          <View style={styles.editActions}>
            <Button
              compact
              mode="text"
              icon="arrow-up"
              disabled={saving || !onMoveUp}
              onPress={onMoveUp}
            >
              Up
            </Button>
            <Button
              compact
              mode="text"
              icon="arrow-down"
              disabled={saving || !onMoveDown}
              onPress={onMoveDown}
            >
              Down
            </Button>
            <Button
              compact
              mode="text"
              icon="swap-horizontal"
              textColor={swapOpen ? colors.accent : undefined}
              onPress={onSwap}
              disabled={saving}
            >
              {swapOpen ? 'Close swaps' : 'Swap'}
            </Button>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
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
  const { colors, radius, typography } = useTheme();

  return (
    <View style={[styles.stepper, { borderColor: colors.border, borderRadius: radius.lg }]}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <IconButton
          icon="minus"
          size={16}
          iconColor={colors.textSecondary}
          disabled={disabled}
          onPress={onMinus}
          accessibilityLabel={`Decrease ${label}`}
          style={styles.stepperButton}
        />
        <Text style={[typography.numeric, { color: colors.textPrimary, fontSize: 15 }]}>
          {value}
        </Text>
        <IconButton
          icon="plus"
          size={16}
          iconColor={colors.textSecondary}
          disabled={disabled}
          onPress={onPlus}
          accessibilityLabel={`Increase ${label}`}
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
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.swapPanel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>Swap for</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Same muscles first, then equipment you have.
          </Text>
        </View>
        <Button compact mode="text" onPress={onCancel}>
          Cancel
        </Button>
      </View>
      {options.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Nothing else trains this muscle with your equipment.
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
                .join(', ')}, ${option.exercise.equipment.join(', ')}`}
              onPress={() => onSelect(option)}
              disabled={saving}
              left={() => <ExerciseThumbnail exercise={option.exercise} />}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={{ paddingHorizontal: 0 }}
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
      <View style={styles.headerRow}>
        <Text style={[typography.body, { color: colors.textPrimary }]}>
          {MUSCLE_LABELS[item.muscle]}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {item.sets} sets a week, {volumeZoneLabel(item.zone).toLowerCase()}
        </Text>
      </View>
      <VolumeLandmarkGauge landmarks={item.landmarks} weeklySets={item.sets} zone={item.zone} />
    </View>
  );
}

const styles = StyleSheet.create({
  perSideToggle: {
    alignSelf: 'flex-start',
    marginLeft: -8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricBlock: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseRow: {
    paddingVertical: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  editorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
  },
  stepper: {
    minWidth: 104,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 40,
    height: 40,
    margin: 0,
  },
  swapPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    marginBottom: 8,
  },
  volumeRow: {
    gap: 8,
  },
});
