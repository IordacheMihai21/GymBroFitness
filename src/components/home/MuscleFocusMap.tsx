import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon } from 'react-native-paper';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import { bodySlugsForMuscle } from '@/domain/muscles/muscleMap';
import { useTheme } from '@/theme';
import type { MuscleGroup, ProgramDay } from '@/types';

type MuscleFocusMapProps = {
  day: ProgramDay;
};

type MuscleLoad = {
  muscle: MuscleGroup;
  sets: number;
};

export function MuscleFocusMap({ day }: MuscleFocusMapProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const muscleLoads = useMemo(() => computeMuscleLoads(day), [day]);
  const totalSets = muscleLoads.reduce((sum, item) => sum + item.sets, 0);
  const maxSets = Math.max(...muscleLoads.map((item) => item.sets), 1);
  const primary = muscleLoads[0];

  const bodyData: ExtendedBodyPart[] = useMemo(
    () =>
      muscleLoads.flatMap((item) =>
        bodySlugsForMuscle(item.muscle).map((slug) => ({
          slug,
          intensity: item.sets / maxSets <= 0.5 ? 1 : 2,
        })),
      ),
    [muscleLoads, maxSets],
  );
  const intensityColors = [`${colors.accent}77`, colors.accent];

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
            <Text style={[typography.micro, { color: colors.accent }]}>Volume map</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Muscle allocation
            </Text>
          </View>
          <View style={styles.totalBlock}>
            <Text style={[typography.numeric, { color: colors.textPrimary }]}>{totalSets}</Text>
            <Text style={[typography.micro, { color: colors.textMuted }]}>direct sets</Text>
          </View>
        </View>

        {primary ? (
          <View style={[styles.primaryPanel, { backgroundColor: colors.accentSoft }]}>
            <Icon source="crosshairs-gps" size={18} color={colors.accent} />
            <Text style={[typography.captionBold, { color: colors.textPrimary, flex: 1 }]}>
              {MUSCLE_LABELS[primary.muscle]} leads today. Keep execution strict before adding pump
              work.
            </Text>
          </View>
        ) : null}

        <View style={styles.bodyRow}>
          <Body
            data={bodyData}
            colors={intensityColors}
            side="front"
            scale={0.38}
            border="none"
            defaultFill={colors.surfacePressed}
          />
          <Body
            data={bodyData}
            colors={intensityColors}
            side="back"
            scale={0.38}
            border="none"
            defaultFill={colors.surfacePressed}
          />
        </View>
        <View style={styles.legendRow}>
          <LegendDot color={colors.surfacePressed} label="No direct work" />
          <LegendDot color={colors.accent} label="Trained today" />
        </View>

        <View style={styles.chipRow}>
          {muscleLoads.slice(0, 4).map((item) => (
            <View
              key={item.muscle}
              style={[styles.chip, { backgroundColor: colors.surfaceRaised }]}
            >
              <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                {MUSCLE_LABELS[item.muscle]}
              </Text>
              <Text style={[typography.micro, { color: colors.textMuted }]}>{item.sets} sets</Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function computeMuscleLoads(day: ProgramDay): MuscleLoad[] {
  const setsByMuscle = new Map<MuscleGroup, number>();
  for (const prescription of day.prescriptions) {
    const exercise = requireExercise(prescription.exerciseId);
    for (const muscle of exercise.primaryMuscles) {
      setsByMuscle.set(muscle, (setsByMuscle.get(muscle) ?? 0) + prescription.workingSets);
    }
  }

  return [...setsByMuscle.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort(
      (a, b) => b.sets - a.sets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]),
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
  totalBlock: {
    alignItems: 'flex-end',
  },
  primaryPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 12,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
