import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { durations, easeOutExpo } from '@/components/ui/motion';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { useTheme } from '@/theme';
import type {
  JointRating,
  MuscleFeedback,
  MuscleGroup,
  PumpRating,
  SorenessRecovery,
  WorkloadRating,
} from '@/types';

type Option<T extends string> = { value: T; label: string };

const PUMP: Option<PumpRating>[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'great', label: 'Great' },
];
const WORKLOAD: Option<WorkloadRating>[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'just_right', label: 'Right' },
  { value: 'hard', label: 'Hard' },
  { value: 'too_much', label: 'Too much' },
];
const JOINTS: Option<JointRating>[] = [
  { value: 'none', label: 'Fine' },
  { value: 'some', label: 'Some' },
  { value: 'a_lot', label: 'A lot' },
];
const SORENESS: Option<SorenessRecovery>[] = [
  { value: 'never_sore', label: 'Never sore' },
  { value: 'recovered_early', label: 'Healed early' },
  { value: 'recovered_on_time', label: 'Just in time' },
  { value: 'still_sore', label: 'Still sore' },
];

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  const { colors, radius, typography } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typography.caption, styles.rowLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${option.label}`}
              style={[
                styles.chip,
                {
                  borderRadius: radius.md,
                  backgroundColor: selected ? colors.textPrimary : colors.surfaceRaised,
                },
              ]}
            >
              <Text
                style={[
                  typography.captionBold,
                  { color: selected ? colors.textInverse : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * After a muscle's last exercise: pump, workload and joints, one tap each.
 * Next time that muscle is trained it gets a set more, the same, or one less.
 */
export function MuscleFeedbackCard({
  muscle,
  feedback,
  onRate,
  onSkip,
}: {
  muscle: MuscleGroup;
  feedback: MuscleFeedback | undefined;
  onRate: (patch: Partial<Pick<MuscleFeedback, 'pump' | 'workload' | 'joints'>>) => void;
  onSkip: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(durations.base).easing(easeOutExpo)}
      exiting={FadeOut.duration(durations.fast)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {MUSCLE_LABELS[muscle]} done. How was it?
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Sets next time follow your answers.
          </Text>
        </View>
        <Button compact mode="text" textColor={colors.textSecondary} onPress={onSkip}>
          Skip
        </Button>
      </View>
      <ChipRow
        label="Pump"
        options={PUMP}
        value={feedback?.pump}
        onChange={(pump) => onRate({ pump })}
      />
      <ChipRow
        label="Workload"
        options={WORKLOAD}
        value={feedback?.workload}
        onChange={(workload) => onRate({ workload })}
      />
      <ChipRow
        label="Joints"
        options={JOINTS}
        value={feedback?.joints}
        onChange={(joints) => onRate({ joints })}
      />
    </Animated.View>
  );
}

/** At a muscle's first exercise: how it recovered since last time. One tap. */
export function SorenessPrompt({
  muscle,
  onRate,
}: {
  muscle: MuscleGroup;
  onRate: (soreness: SorenessRecovery) => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(durations.base).easing(easeOutExpo)}
      exiting={FadeOut.duration(durations.fast)}
      style={{ gap: 6 }}
    >
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {MUSCLE_LABELS[muscle]} since last time
      </Text>
      <View style={styles.chips}>
        {SORENESS.map((option) => (
          <SorenessChip key={option.value} option={option} onPress={() => onRate(option.value)} />
        ))}
      </View>
    </Animated.View>
  );
}

function SorenessChip({
  option,
  onPress,
}: {
  option: Option<SorenessRecovery>;
  onPress: () => void;
}) {
  const { colors, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Soreness: ${option.label}`}
      style={[styles.chip, { borderRadius: radius.md, backgroundColor: colors.surfaceRaised }]}
    >
      <Text style={[typography.captionBold, { color: colors.textSecondary }]} numberOfLines={1}>
        {option.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    width: 66,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
