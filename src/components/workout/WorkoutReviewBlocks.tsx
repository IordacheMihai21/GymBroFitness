import { StyleSheet, Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ProgressLine } from '@/components/ui/ProgressLine';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import type { WorkoutExerciseSummary } from '@/domain/workouts/history';
import {
  formatDecisionTarget,
  formatProgressionSignal,
  formatTargetSummary,
  formatTargetWinCondition,
  progressionActionLabel,
  type TargetToBeat,
} from '@/domain/workouts/targetToBeat';
import type {
  WorkoutFormReview,
  WorkoutMuscleDose,
  WorkoutProgressionReview,
  WorkoutRirReview,
} from '@/domain/workouts/workoutReview';
import { useTheme } from '@/theme';
import type { Units } from '@/types';
import { displayLoad, formatVolumeLoad, unitLabel } from '@/utils/units';

/**
 * Small presentational blocks used by the workout screen's finish/review
 * summary. Each takes explicit props and renders on the canvas, not in a box.
 */

export function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function AssistantFact({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function FinishMetric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.finishMetric}>
      <AnimatedNumber
        value={value}
        style={[typography.jumbo, { color: colors.textPrimary, fontSize: 32, lineHeight: 38 }]}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function TopExerciseRow({
  exercise,
  rank,
  units,
}: {
  exercise: WorkoutExerciseSummary;
  rank: number;
  units: Units;
}) {
  const { colors, typography } = useTheme();
  const bestLabel =
    exercise.bestE1rmKg != null
      ? `best e1RM ${displayLoad(exercise.bestE1rmKg, units)} ${unitLabel(units)}`
      : exercise.bestSetLabel;

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[typography.numeric, { color: colors.textMuted, width: 24 }]}>{rank}</Text>
      <View style={styles.rowText}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {exercise.completedSets} sets, {formatVolumeLoad(exercise.volumeKg, units)}, {bestLabel}
        </Text>
      </View>
    </View>
  );
}

export function MuscleDoseRow({ dose }: { dose: WorkoutMuscleDose }) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.spread}>
        <Text style={[typography.body, { color: colors.textPrimary }]}>
          {MUSCLE_LABELS[dose.muscle]}
        </Text>
        <Text style={[typography.numeric, { color: colors.textSecondary, fontSize: 15 }]}>
          {dose.sets} sets
        </Text>
      </View>
      <ProgressLine
        progress={Math.max(0.04, Math.min(1, dose.share))}
        trackColor="transparent"
        height={3}
      />
    </View>
  );
}

export function RirQualityBlock({ review }: { review: WorkoutRirReview | null }) {
  return (
    <QualityBlock
      label="RIR accuracy"
      value={review ? `${review.accuracyPct}%` : '-'}
      detail={
        review?.detail ?? 'Log RIR on your working sets to see how close you trained to target.'
      }
      title={review?.label ?? 'No RIR logged'}
    />
  );
}

export function FormQualityBlock({ review }: { review: WorkoutFormReview | null }) {
  return (
    <QualityBlock
      label="Form AI"
      value={review ? `${review.averageScore}/100` : '-'}
      detail={
        review
          ? `${review.analyzedSetCount} sets analyzed (${review.coveragePct}% of the session). ${review.cue}`
          : 'Film a set on a supported lift to score your technique.'
      }
      title={review?.label ?? 'No sets filmed'}
    />
  );
}

function QualityBlock({
  label,
  value,
  title,
  detail,
}: {
  label: string;
  value: string;
  title: string;
  detail: string;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.spread}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      </View>
      <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{detail}</Text>
    </View>
  );
}

export function ProgressionTargetPanel({ target, units }: { target: TargetToBeat; units: Units }) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.targetPanel,
        {
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={styles.spread}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Target, {progressionActionLabel(target.decision.action).toLowerCase()}
        </Text>
        <Text style={[typography.numeric, { color: colors.accent }]}>
          {formatDecisionTarget(target.decision, units)}
        </Text>
      </View>
      <View style={styles.facts}>
        <AssistantFact
          label="Last time"
          value={formatProgressionSignal(target.lastSignal, units)}
        />
        <AssistantFact label="To beat it" value={formatTargetWinCondition(target, units)} />
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={3}>
        {target.decision.explanation}
      </Text>
    </View>
  );
}

export function ProgressionReviewRow({
  item,
  units,
}: {
  item: WorkoutProgressionReview;
  units: Units;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.exerciseName}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
          {formatTargetSummary(item.target, units)}
        </Text>
      </View>
      <Text style={[typography.captionBold, { color: colors.accent }]}>{item.actionLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  finishMetric: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  targetPanel: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  facts: {
    flexDirection: 'row',
    gap: 12,
  },
});
