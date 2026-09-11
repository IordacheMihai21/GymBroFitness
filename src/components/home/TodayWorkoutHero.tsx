import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import type { TargetToBeat } from '@/domain/workouts/targetToBeat';
import { useTheme } from '@/theme';
import type { ProgramDay } from '@/types';

type TodayWorkoutHeroProps = {
  day: ProgramDay;
  targetRir: number;
  target: TargetToBeat;
  swapLabel: string;
  onStart: () => void;
  onSwap: () => void;
};

export function TodayWorkoutHero({
  day,
  targetRir,
  target,
  swapLabel,
  onStart,
  onSwap,
}: TodayWorkoutHeroProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const totalSets = day.prescriptions.reduce((sum, p) => sum + p.workingSets, 0);
  const { decision, lastSession } = target;
  const targetText =
    decision.nextLoad != null
      ? `${decision.nextLoad} kg × ${decision.nextMaxReps} reps`
      : `${decision.nextMinReps}-${decision.nextMaxReps} reps`;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, borderColor: colors.accent, shadowColor: colors.accent },
      ]}
    >
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={styles.headerRow}>
          <Text style={[typography.captionBold, { color: colors.accent, letterSpacing: 0.5 }]}>
            TODAY · {day.name.toUpperCase()}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.accentSoft, borderRadius: radius.pill }]}>
            <Text style={[typography.micro, { color: colors.accent }]}>RIR {targetRir}</Text>
          </View>
        </View>

        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {day.focus.map((m) => MUSCLE_LABELS[m]).join(', ')}
        </Text>

        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {day.prescriptions.length} Exercises · {totalSets} Sets · Est. {day.estimatedMinutes} min
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={{ gap: 4 }}>
          <Text style={[typography.captionBold, { color: colors.textSecondary }]}>
            Target to Beat Today
          </Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {target.exerciseName}: {targetText}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Last session: {lastSession.loadKg} kg × {lastSession.reps} reps @ RIR{' '}
            {lastSession.rir}
          </Text>
        </View>

        <PrimaryButton label="Start Workout" fullWidth onPress={onStart} />

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Switching it up today?
          </Text>
          <View style={styles.swapRow}>
            <Pressable
              onPress={onSwap}
              style={[styles.swapPill, { backgroundColor: colors.surfacePressed, borderRadius: radius.pill }]}
            >
              <Ionicons name="swap-horizontal" size={13} color={colors.textSecondary} />
              <Text style={[typography.micro, { color: colors.textSecondary }]} numberOfLines={1}>
                Swap to {swapLabel}
              </Text>
            </Pressable>
            <View
              style={[
                styles.swapPill,
                { backgroundColor: colors.surfacePressed, borderRadius: radius.pill, opacity: 0.5 },
              ]}
            >
              <Ionicons name="options-outline" size={13} color={colors.textSecondary} />
              <Text style={[typography.micro, { color: colors.textSecondary }]}>
                Custom / Weak Point
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 10, paddingVertical: 3 },
  divider: { height: StyleSheet.hairlineWidth },
  swapRow: { flexDirection: 'row', gap: 8 },
  swapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 1,
  },
});
