import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Chip, ProgressBar } from 'react-native-paper';

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
 * summary. Pulled out of `workout.tsx` (originally 2,340 lines) since none of
 * these need that screen's live session state — each takes explicit props.
 */

export function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function AssistantFact({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.assistantFact}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function FinishMetric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.finishMetric,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      <Text style={[typography.numeric, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
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
      ? `e1RM ${displayLoad(exercise.bestE1rmKg, units)}${unitLabel(units)}`
      : exercise.bestSetLabel;

  return (
    <View
      style={[
        styles.reviewRow,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: colors.accentSoft }]}>
        <Text style={[typography.micro, { color: colors.accent }]}>#{rank}</Text>
      </View>
      <View style={styles.reviewRowText}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={1}>
          {exercise.completedSets} sets · {formatVolumeLoad(exercise.volumeKg, units)} · {bestLabel}
        </Text>
      </View>
    </View>
  );
}

export function MuscleDoseRow({ dose }: { dose: WorkoutMuscleDose }) {
  const { colors, typography } = useTheme();
  const width = `${Math.max(6, Math.round(Math.min(1, dose.share) * 100))}%` as DimensionValue;

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.muscleDoseHeader}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
          {MUSCLE_LABELS[dose.muscle]}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]}>{dose.sets} sets</Text>
      </View>
      <View style={[styles.muscleDoseTrack, { backgroundColor: colors.surfacePressed }]}>
        <View style={[styles.muscleDoseFill, { width, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

export function RirQualityBlock({ review }: { review: WorkoutRirReview | null }) {
  return (
    <QualityBlock
      label="RIR discipline"
      value={review ? `${review.accuracyPct}%` : 'missing'}
      detail={review?.detail ?? 'Log RIR on working sets to unlock effort accuracy.'}
      progress={review ? review.accuracyPct / 100 : 0}
      title={review?.label ?? 'No effort signal yet'}
    />
  );
}

export function FormQualityBlock({ review }: { review: WorkoutFormReview | null }) {
  return (
    <QualityBlock
      label="Form AI"
      value={review ? `${review.averageScore}/100` : 'off'}
      detail={
        review
          ? `${review.analyzedSetCount} analyzed sets · ${review.coveragePct}% coverage · ${review.cue}`
          : 'Run a camera set on supported lifts to track technical quality.'
      }
      progress={review ? review.averageScore / 100 : 0}
      title={review?.label ?? 'No camera data'}
    />
  );
}

function QualityBlock({
  label,
  value,
  title,
  detail,
  progress,
}: {
  label: string;
  value: string;
  title: string;
  detail: string;
  progress: number;
}) {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.qualityBlock,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={[typography.captionBold, { color: colors.accent }]}>{value}</Text>
      </View>
      <ProgressBar
        progress={Math.max(0, Math.min(1, progress))}
        color={colors.accent}
        style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
      />
      <Text style={[typography.micro, { color: colors.textMuted }]}>{detail}</Text>
    </View>
  );
}

export function ProgressionTargetPanel({ target, units }: { target: TargetToBeat; units: Units }) {
  const { colors, typography } = useTheme();
  const action = progressionActionLabel(target.decision.action);

  return (
    <View
      style={[
        styles.progressionPanel,
        { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.micro, { color: colors.accent }]}>Progression target</Text>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
            {formatDecisionTarget(target.decision, units)}
          </Text>
        </View>
        <Chip compact mode="flat" icon="trending-up">
          {action}
        </Chip>
      </View>
      <View style={styles.progressionFacts}>
        <AssistantFact label="last" value={formatProgressionSignal(target.lastSignal, units)} />
        <AssistantFact label="win" value={formatTargetWinCondition(target, units)} />
      </View>
      <Text style={[typography.micro, { color: colors.textSecondary }]} numberOfLines={2}>
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
    <View
      style={[
        styles.reviewRow,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: colors.accentSoft }]}>
        <Text style={[typography.micro, { color: colors.accent }]}>
          {item.actionLabel.slice(0, 3)}
        </Text>
      </View>
      <View style={styles.reviewRowText}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.exerciseName}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={2}>
          {formatTargetSummary(item.target, units)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
  },
  assistantFact: {
    flex: 1,
    minWidth: 0,
  },
  finishMetric: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 130,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  muscleDoseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  muscleDoseTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  muscleDoseFill: {
    height: '100%',
    borderRadius: 999,
  },
  qualityBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  progressionPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  progressionFacts: {
    flexDirection: 'row',
    gap: 8,
  },
});
