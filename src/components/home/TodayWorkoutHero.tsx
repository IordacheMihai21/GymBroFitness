import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Icon } from 'react-native-paper';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { EXERCISE_LIBRARY } from '@/domain/exercises/library';
import {
  formatDecisionTarget,
  formatProgressionSignal,
  type TargetToBeat,
} from '@/domain/workouts/targetToBeat';
import { useTheme } from '@/theme';
import type { ProgramDay, Units } from '@/types';

type TodayWorkoutHeroProps = {
  day: ProgramDay;
  targetRir: number;
  target: TargetToBeat;
  units: Units;
  hasPreviousTopSet: boolean;
  swapLabel: string;
  onStart: () => void;
  onSwap: () => void;
  onWeakPoint: () => void;
  onCustomWorkout: () => void;
};

export function TodayWorkoutHero({
  day,
  targetRir,
  target,
  units,
  hasPreviousTopSet,
  swapLabel,
  onStart,
  onSwap,
  onWeakPoint,
  onCustomWorkout,
}: TodayWorkoutHeroProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const totalSets = day.prescriptions.reduce((sum, p) => sum + p.workingSets, 0);
  const { decision } = target;
  const heroImage = useMemo(() => resolveExerciseImage(target.exerciseName), [target.exerciseName]);
  const targetText = !hasPreviousTopSet
    ? 'Calibrate live'
    : formatDecisionTarget(target.decision, units);
  const decisionCopy = !hasPreviousTopSet
    ? 'Log the first honest top set today. The next run will use saved history for the overload target.'
    : decision.action === 'increase_load'
      ? 'Load earned. Keep the same rep intent and own the first set.'
      : decision.action === 'increase_reps'
        ? 'Same load. Buy one cleaner rep before chasing plates.'
        : 'Hold the line today and make the execution boringly clean.';

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
      <View style={styles.imageFrame}>
        <Image
          source={heroImage}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
          cachePolicy="disk"
          accessibilityLabel={`${target.exerciseName} exercise reference`}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3, 5, 9, 0.52)' }]} />
        <View style={styles.imageContent}>
          <View style={styles.headerRow}>
            <Text style={[typography.captionBold, { color: colors.accent }]}>
              TODAY · {day.name.toUpperCase()}
            </Text>
            <Chip
              compact
              mode="flat"
              style={{ backgroundColor: colors.accentSoft }}
              textStyle={[typography.micro, { color: colors.textPrimary }]}
            >
              RIR {targetRir}
            </Chip>
          </View>
          <Text style={[typography.jumbo, { color: colors.textPrimary }]} numberOfLines={2}>
            Beat one honest top set.
          </Text>
        </View>
      </View>

      <Card.Content style={{ gap: spacing.md, paddingTop: spacing.md }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {day.focus.map((m) => MUSCLE_LABELS[m]).join(', ')}
        </Text>

        <View style={styles.metricRow}>
          <Metric label="Exercises" value={String(day.prescriptions.length)} />
          <Metric label="Sets" value={String(totalSets)} />
          <Metric label="Estimate" value={`${day.estimatedMinutes}m`} />
        </View>

        <View
          style={[
            styles.decisionPanel,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.accent,
            },
          ]}
        >
          <View style={styles.rowBetween}>
            <Text style={[typography.captionBold, { color: colors.accent }]}>
              Progression contract
            </Text>
            <Icon source="trending-up" size={16} color={colors.accent} />
          </View>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>
            {target.exerciseName}
          </Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{targetText}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {hasPreviousTopSet
              ? `Last session: ${formatProgressionSignal(target.lastSignal, units)}`
              : 'No saved benchmark for this lift yet'}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{decisionCopy}</Text>
          <View style={[styles.ruleLine, { borderColor: colors.borderStrong }]}>
            <Text style={[typography.micro, { color: colors.accent }]}>Rule</Text>
            <Text style={[typography.micro, { color: colors.textSecondary, flex: 1 }]}>
              Top range with reps to spare earns the next load.
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          icon="play"
          buttonColor={colors.accent}
          textColor={colors.onAccent}
          contentStyle={styles.startButton}
          onPress={onStart}
        >
          Start {day.name}
        </Button>

        <View style={styles.swapRow}>
          <Chip
            compact
            mode="flat"
            icon="swap-horizontal"
            onPress={onSwap}
            style={{ backgroundColor: colors.surfacePressed }}
            textStyle={{ color: colors.textSecondary }}
          >
            Swap to {swapLabel}
          </Chip>
          <Chip
            compact
            mode="flat"
            icon="tune-variant"
            onPress={onWeakPoint}
            style={{ backgroundColor: colors.surfacePressed }}
            textStyle={{ color: colors.textSecondary }}
          >
            Weak point
          </Chip>
          <Chip
            compact
            mode="flat"
            icon="playlist-plus"
            onPress={onCustomWorkout}
            style={{ backgroundColor: colors.surfacePressed }}
            textStyle={{ color: colors.textSecondary }}
          >
            Custom
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveExerciseImage(exerciseName: string): string {
  const normalized = normalizeName(exerciseName);
  const match =
    EXERCISE_LIBRARY.find((exercise) => normalizeName(exercise.name) === normalized) ??
    EXERCISE_LIBRARY.find((exercise) => normalized.includes(normalizeName(exercise.name))) ??
    EXERCISE_LIBRARY.find((exercise) =>
      normalizeName(exercise.name).includes('dumbbell bench press'),
    ) ??
    EXERCISE_LIBRARY.find((exercise) => normalizeName(exercise.name).includes('bench press'));
  return match?.images[0] ?? EXERCISE_LIBRARY[0].images[0];
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  imageFrame: {
    height: 218,
  },
  imageContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  decisionPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  startButton: {
    minHeight: 52,
  },
  swapRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ruleLine: {
    marginTop: 5,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
