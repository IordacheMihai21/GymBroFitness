import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseDemoStage } from '@/components/exercise/ExerciseDemoStage';
import { ExerciseMuscleMap } from '@/components/exercise/ExerciseMuscleMap';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { referenceExerciseForCatalog } from '@/domain/exercises/library';
import { useTheme } from '@/theme';
import type { EquipmentType, Exercise } from '@/types';

type ExerciseDemoModalProps = {
  exercise: Exercise | null;
  actionLabel: string;
  actionIcon?: string;
  onAction: (exercise: Exercise) => void;
  onDismiss: () => void;
};

/**
 * THESIS: choosing a lift is a visual decision, not an accidental row tap.
 * OWN-WORLD: black training canvas, electric-blue controls, full-width movement frame.
 * STORY: inspect start/end positions, read three cues, then deliberately add the lift.
 * FIRST VIEWPORT: movement name, large demonstration, and visible frame controls.
 * FORM: focused native full-screen selection task inside the established GymBroFitness system.
 */
export function ExerciseDemoModal({
  exercise,
  actionLabel,
  actionIcon = 'playlist-plus',
  onAction,
  onDismiss,
}: ExerciseDemoModalProps) {
  const { colors, spacing, typography } = useTheme();
  const reduceMotion = useReducedMotion();
  const reference = useMemo(
    () => (exercise ? referenceExerciseForCatalog(exercise) : null),
    [exercise],
  );
  const images = reference?.images ?? [];

  if (!exercise) return null;

  const instructions = exercise.instructions.slice(0, 3);
  const commonMistakes = exercise.commonMistakes.slice(0, 2);

  return (
    <Modal
      visible
      animationType={reduceMotion ? 'fade' : 'slide'}
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <IconButton
            icon="close"
            mode="contained-tonal"
            accessibilityLabel="Close exercise preview"
            onPress={onDismiss}
          />
          <View style={styles.headerCopy}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Exercise preview</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={2}>
              {exercise.name}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.x4l,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ExerciseDemoStage images={images} exerciseName={exercise.name} />

          <ExerciseMuscleMap
            exerciseName={exercise.name}
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
          />

          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {exercise.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')},{' '}
            {formatEquipment(exercise.equipment).toLowerCase()}
          </Text>

          <View style={styles.copySection}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>How to do it</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {exercise.description}
            </Text>
            {instructions.map((instruction, index) => (
              <View key={instruction} style={styles.cueRow}>
                <Text style={[typography.numeric, { color: colors.textMuted, width: 20 }]}>
                  {index + 1}
                </Text>
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
                  {instruction}
                </Text>
              </View>
            ))}
          </View>

          {commonMistakes.length > 0 ? (
            <View style={[styles.mistakePanel, { borderLeftColor: colors.warning }]}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>Watch for</Text>
              {commonMistakes.map((mistake) => (
                <Text key={mistake} style={[typography.body, { color: colors.textSecondary }]}>
                  {mistake}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={[typography.micro, { color: colors.textMuted }]}>
            Reference images illustrate start and finish positions. They do not replace coaching or
            pain-aware technique adjustments.
          </Text>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <Button mode="text" onPress={onDismiss} style={styles.footerSecondary}>
            Not now
          </Button>
          <Button
            mode="contained"
            icon={actionIcon}
            onPress={() => onAction(exercise)}
            style={styles.footerPrimary}
            contentStyle={styles.footerButtonContent}
          >
            {actionLabel}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function formatEquipment(equipment: EquipmentType[]): string {
  return equipment
    .slice(0, 2)
    .map((item) =>
      item
        .split('_')
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(' '),
    )
    .join(', ');
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 16 },
  scroll: { flex: 1 },
  copySection: { gap: 12 },
  cueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mistakePanel: { borderLeftWidth: 2, paddingLeft: 12, gap: 4 },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerSecondary: { flex: 0.7 },
  footerPrimary: { flex: 1.3 },
  footerButtonContent: { minHeight: 48 },
});
