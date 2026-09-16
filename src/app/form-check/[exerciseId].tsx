import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getExercise } from '@/domain/exercises/catalog';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import { savePendingFormAnalysisResult } from '@/domain/vision/formAnalysisResultStore';
import type { RepAnalysis } from '@/domain/vision/formScoring';
import { buildSetSummary } from '@/domain/vision/sessionSummary';
import { FormCameraView } from '@/components/vision/FormCameraView';
import { SetSummaryCard } from '@/components/vision/SetSummaryCard';
import { useTheme } from '@/theme';
import type { SetFormAnalysis } from '@/types';
import { uuid } from '@/utils/ids';

export default function FormCheckScreen() {
  const { exerciseId, sessionId, exerciseIndex, setIndex } = useLocalSearchParams<{
    exerciseId: string;
    sessionId?: string;
    exerciseIndex?: string;
    setIndex?: string;
  }>();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [completedReps, setCompletedReps] = useState<RepAnalysis[] | null>(null);
  const [savingResult, setSavingResult] = useState(false);

  const exercise = getExercise(exerciseId);
  const config = exercise ? getVisionConfigForMovementPattern(exercise.movementPattern) : undefined;
  const attachTarget = parseAttachTarget(sessionId, exerciseIndex, setIndex);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  async function saveAndClose() {
    if (!completedReps || !exercise || !attachTarget) {
      close();
      return;
    }

    setSavingResult(true);
    try {
      await savePendingFormAnalysisResult({
        sessionId: attachTarget.sessionId,
        exerciseIndex: attachTarget.exerciseIndex,
        setIndex: attachTarget.setIndex,
        analysis: buildSetFormAnalysis(exercise.id, completedReps),
      });
      close();
    } finally {
      setSavingResult(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={close} />
        <Text
          style={[typography.subheading, { color: colors.textPrimary, flex: 1 }]}
          numberOfLines={1}
        >
          {exercise?.name ?? 'Analyze form'}
        </Text>
      </View>

      {!config ? (
        <View style={styles.centered}>
          <Text
            style={[
              typography.body,
              { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
            ]}
          >
            Form analysis isn&apos;t available for this exercise yet.
          </Text>
        </View>
      ) : completedReps ? (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}
        >
          <SetSummaryCard reps={completedReps} />
          <Button mode="contained" onPress={() => setCompletedReps(null)}>
            Analyze another set
          </Button>
          <Button mode="text" loading={savingResult} disabled={savingResult} onPress={saveAndClose}>
            {attachTarget ? 'Attach to workout set' : 'Done'}
          </Button>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <Card
            mode="contained"
            style={[
              styles.preflightCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Card.Content style={{ gap: spacing.sm }}>
              <View style={styles.chipRow}>
                <Chip compact mode="flat" icon="shield-check-outline">
                  On-device only
                </Chip>
                <Chip compact mode="flat" icon="camera-outline">
                  {cameraAngleLabel(config.recommendedCameraAngle)}
                </Chip>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Place the phone {cameraPlacementCopy(config.recommendedCameraAngle)} and keep the
                working joints visible for the full set.
              </Text>
            </Card.Content>
          </Card>
          <FormCameraView config={config} onFinishSet={setCompletedReps} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preflightCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function cameraAngleLabel(angle: 'front' | 'side' | 'front-45'): string {
  switch (angle) {
    case 'front':
      return 'Front angle';
    case 'side':
      return 'Side angle';
    case 'front-45':
      return '45° angle';
  }
}

function cameraPlacementCopy(angle: 'front' | 'side' | 'front-45'): string {
  switch (angle) {
    case 'front':
      return 'in front of you';
    case 'side':
      return 'to your side';
    case 'front-45':
      return 'at a front 45° angle';
  }
}

function parseAttachTarget(
  sessionId: string | undefined,
  exerciseIndex: string | undefined,
  setIndex: string | undefined,
): {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
} | null {
  const parsedExerciseIndex = Number.parseInt(exerciseIndex ?? '', 10);
  const parsedSetIndex = Number.parseInt(setIndex ?? '', 10);
  if (
    !sessionId ||
    !Number.isFinite(parsedExerciseIndex) ||
    !Number.isFinite(parsedSetIndex) ||
    parsedExerciseIndex < 0 ||
    parsedSetIndex < 0
  ) {
    return null;
  }

  return {
    sessionId,
    exerciseIndex: parsedExerciseIndex,
    setIndex: parsedSetIndex,
  };
}

function buildSetFormAnalysis(exerciseId: string, reps: RepAnalysis[]): SetFormAnalysis {
  const summary = buildSetSummary(reps);
  return {
    id: uuid(),
    exerciseId,
    capturedAt: new Date().toISOString(),
    repCount: summary.reps,
    averageScore: summary.averageScore,
    averageRomScore: summary.averageRomScore,
    averageTempoScore: summary.averageTempoScore,
    bestRepScore: summary.bestRep?.overallScore ?? null,
    worstRepScore: summary.worstRep?.overallScore ?? null,
    mostCommonIssue: summary.mostCommonIssue,
    recommendations: summary.recommendations,
  };
}
