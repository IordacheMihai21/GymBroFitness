import Body from 'react-native-body-highlighter';
import { StyleSheet, Text, View } from 'react-native';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { exerciseBodyData } from '@/domain/muscles/muscleMap';
import { useTheme } from '@/theme';
import type { MuscleGroup } from '@/types';

type ExerciseMuscleMapProps = {
  exerciseName: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
};

/** Anatomical target preview shared by reference and loggable exercise details. */
export function ExerciseMuscleMap({
  exerciseName,
  primaryMuscles,
  secondaryMuscles,
}: ExerciseMuscleMapProps) {
  const { colors, spacing, typography } = useTheme();
  const bodyData = exerciseBodyData(primaryMuscles, secondaryMuscles);
  const primaryLabel = muscleLabels(primaryMuscles);
  const secondaryOnly = secondaryMuscles.filter((muscle) => !primaryMuscles.includes(muscle));
  const secondaryLabel = muscleLabels(secondaryOnly);

  return (
    <View
      accessible
      accessibilityLabel={`${exerciseName}. Primary muscles: ${primaryLabel || 'not specified'}${secondaryLabel ? `. Secondary muscles: ${secondaryLabel}` : ''}`}
      style={[styles.panel, { gap: spacing.lg }]}
    >
      <View style={styles.bodyPair} importantForAccessibility="no-hide-descendants">
        <Body
          data={bodyData}
          colors={[colors.muscleSecondary, colors.musclePrimary]}
          side="front"
          scale={0.25}
          border="none"
          defaultFill={colors.surfaceRaised}
        />
        <Body
          data={bodyData}
          colors={[colors.muscleSecondary, colors.musclePrimary]}
          side="back"
          scale={0.25}
          border="none"
          defaultFill={colors.surfaceRaised}
        />
      </View>

      <View style={[styles.copy, { gap: spacing.sm }]}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Muscles worked</Text>

        <LegendRow
          color={colors.musclePrimary}
          label="Primary"
          value={primaryLabel || 'Full body'}
        />
        {secondaryLabel ? (
          <LegendRow color={colors.muscleSecondary} label="Secondary" value={secondaryLabel} />
        ) : null}
      </View>
    </View>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[typography.captionBold, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function muscleLabels(muscles: MuscleGroup[]): string {
  return muscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ');
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bodyPair: {
    minWidth: 132,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  copy: { flex: 1, minWidth: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
});
