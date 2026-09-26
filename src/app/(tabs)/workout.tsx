import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  Portal,
  ProgressBar,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrCelebration } from '@/components/workout/PrCelebration';
import { ReadinessCheckInCard } from '@/components/workout/ReadinessCheckInCard';
import { RestTimer } from '@/components/workout/RestTimer';
import { RirPickerSheet } from '@/components/workout/RirPickerSheet';
import { SetRow } from '@/components/workout/SetRow';
import {
  AssistantFact,
  FinishMetric,
  FormQualityBlock,
  Metric,
  MuscleDoseRow,
  ProgressionReviewRow,
  ProgressionTargetPanel,
  RirQualityBlock,
  TopExerciseRow,
} from '@/components/workout/WorkoutReviewBlocks';
import { requireExercise } from '@/domain/exercises/catalog';
import { listTemplates } from '@/domain/programs/templateStore';
import {
  findLastPerformedExercise,
  previousSetAtIndex,
  formatPreviousSet,
} from '@/domain/workouts/lastPerformance';
import { painMessage } from '@/domain/workouts/readiness';
import { extendRestTimer } from '@/domain/workouts/restTimer';
import { startWorkoutSession } from '@/domain/workouts/session';
import { formatTrackingTarget } from '@/domain/workouts/setTracking';
import { buildWorkoutSessionReview } from '@/domain/workouts/workoutReview';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { ProgramDay, TrainingPreferences } from '@/types';
import { formatVolumeLoad } from '@/utils/units';

import {
  autosaveIcon,
  autosaveLabel,
  buildCustomWorkoutDay,
  cameraAngleLabel,
  compactSuggestionValue,
  formatRest,
  isExerciseDone,
  shortExerciseName,
  sourceLabel,
  techniqueLabel,
} from '@/features/workout/workout.helpers';
import { useWorkoutSession } from '@/features/workout/useWorkoutSession';

export default function WorkoutScreen() {
  const {
    day: dayParam,
    templateId,
    custom,
    ids,
    name,
  } = useLocalSearchParams<{
    day?: string;
    templateId?: string;
    custom?: string;
    ids?: string;
    name?: string;
  }>();
  const { user, preferences, program } = useActiveProgram();
  const [templateDay, setTemplateDay] = useState<ProgramDay | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(!!templateId);

  useEffect(() => {
    if (!templateId) return;
    let mounted = true;
    listTemplates().then((templates) => {
      if (!mounted) return;
      setTemplateDay(templates.find((t) => t.id === templateId)?.day ?? null);
      setLoadingTemplate(false);
    });
    return () => {
      mounted = false;
    };
  }, [templateId]);

  if (templateId && loadingTemplate) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const dayIndex = Number(dayParam ?? 0);
  const customDay = buildCustomWorkoutDay({
    enabled: !templateId && custom === '1',
    idsParam: ids,
    nameParam: name,
    preferences,
  });
  const day = templateDay ?? customDay ?? program.days[dayIndex] ?? program.days[0];

  return (
    <WorkoutSessionView
      key={`${user.id}-${day.id}`}
      programName={program.name}
      day={day}
      userId={user.id}
      preferences={preferences}
    />
  );
}

function WorkoutSessionView({
  programName,
  day,
  userId,
  preferences,
}: {
  programName: string;
  day: ProgramDay;
  userId: string;
  preferences: TrainingPreferences;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const safeTop = Math.max(insets.top, spacing.xxl);

  const {
    session,
    setSession,
    activeExerciseIndex,
    setActiveExerciseIndex,
    finished,
    setFinished,
    isSaving,
    saveError,
    setSaveError,
    newRecordCount,
    setNewRecordCount,
    history,
    rirTarget,
    setRirTarget,
    rirSheetRef,
    templateSaved,
    setTemplateSaved,
    isSavingTemplate,
    showCelebration,
    setShowCelebration,
    isHydratingDraft,
    autosaveState,
    setAutosaveState,
    lastAutosavedAt,
    setLastAutosavedAt,
    formAnalysisStatus,
    showDiscardDialog,
    setShowDiscardDialog,
    showSaveIncompleteDialog,
    setShowSaveIncompleteDialog,
    isDiscarding,
    setValidationErrors,
    checkInSkipped,
    setCheckInSkipped,
    restNotificationStatus,
    setRowRefs,
    activeExercise,
    isPaused,
    activeExerciseMeta,
    activeVisionConfig,
    activePrescription,
    plannedSets,
    completedSets,
    remainingSets,
    isReviewing,
    progress,
    volume,
    activeCompletedSets,
    targetLabel,
    previousPerformance,
    nextOpenSetIndex,
    formTargetSetIndex,
    formTargetSet,
    openSetCount,
    activeAutofillSuggestion,
    activeProgressionTarget,
    updateSet,
    openRirPicker,
    saveReadiness,
    confirmRir,
    clearRir,
    copyPreviousSet,
    copySetToRemaining,
    toggleSetSkipped,
    fillNextSet,
    fillOpenSetsForExercise,
    fillAllOpenSets,
    fillOpenSets,
    toggleComplete,
    completeAndFocusNext,
    completeExerciseOpenSets,
    toggleSupersetWithNext,
    pauseSession,
    resumeSession,
    endLiveWorkout,
    continueLiveWorkout,
    discardSession,
    saveCompletedSession,
    saveIncompleteSession,
    saveAsTemplate,
  } = useWorkoutSession(day, userId, preferences);

  if (isHydratingDraft) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Checking saved workout
        </Text>
      </View>
    );
  }

  if (isReviewing && !finished) {
    const rirValue = rirTarget
      ? (session.exercises[rirTarget.exerciseIndex]?.sets[rirTarget.setIndex]?.rir ?? null)
      : null;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            paddingTop: safeTop,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 220,
            gap: spacing.lg,
          }}
        >
          <View style={styles.reviewEditorHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.micro, { color: colors.accent }]}>Post-workout review</Text>
              <Text style={[typography.title, { color: colors.textPrimary }]}>
                Log what you did
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Fill this now or leave and resume later. Nothing reaches progression until you save.
              </Text>
            </View>
            <Chip compact mode="flat" icon="clipboard-edit-outline">
              {completedSets}/{plannedSets}
            </Chip>
          </View>

          <View
            style={[
              styles.reviewStatusPanel,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                {remainingSets === 0 ? 'Ready to save' : `${remainingSets} sets need a decision`}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Enter results, then log all open sets at once. You can still confirm or skip rows
                individually.
              </Text>
            </View>
            <View style={styles.reviewStatusActions}>
              {remainingSets > 0 ? (
                <Button
                  mode="contained-tonal"
                  icon="auto-fix"
                  onPress={fillAllOpenSets}
                  style={styles.reviewStatusAction}
                >
                  Prefill all open
                </Button>
              ) : null}
              <Button
                mode="outlined"
                icon="arrow-left"
                onPress={continueLiveWorkout}
                style={styles.reviewStatusAction}
              >
                Back to workout
              </Button>
            </View>
          </View>

          {session.exercises.map((performed, exerciseIndex) => {
            const exercise = requireExercise(performed.exerciseId);
            const exerciseTarget = formatTrackingTarget(
              performed.prescription,
              exercise.trackingType,
              preferences.units,
            );
            const previous = findLastPerformedExercise(history, performed.exerciseId);
            const exerciseCompleted = performed.sets.filter(
              (set) => set.completed && !set.skipped,
            ).length;
            const exerciseOpen = performed.sets.filter(
              (set) => !set.completed && !set.skipped,
            ).length;

            return (
              <Card
                key={performed.id}
                mode="contained"
                style={[
                  styles.reviewEditorCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Card.Content style={{ gap: spacing.md }}>
                  <View style={styles.sectionHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[typography.heading, { color: colors.textPrimary }]}
                        numberOfLines={2}
                      >
                        {exercise.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {exerciseCompleted}/{performed.sets.length} logged · {exerciseTarget}
                      </Text>
                    </View>
                  </View>

                  {performed.sets.map((set, setIndex) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      targetLabel={exerciseTarget}
                      equipment={exercise.equipment}
                      trackingType={exercise.trackingType}
                      units={preferences.units}
                      validationError={setValidationErrors[set.id]}
                      previousLabel={formatPreviousSet(
                        previousSetAtIndex(previous, setIndex),
                        preferences.units,
                      )}
                      onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)}
                      onToggleComplete={() => toggleComplete(exerciseIndex, setIndex)}
                      onSubmitEditing={() => completeAndFocusNext(exerciseIndex, setIndex)}
                      onCopyPrevious={
                        setIndex > 0 ? () => copyPreviousSet(exerciseIndex, setIndex) : undefined
                      }
                      onCopyToRemaining={() => copySetToRemaining(exerciseIndex, setIndex)}
                      onToggleSkip={() => toggleSetSkipped(exerciseIndex, setIndex)}
                      onOpenRirPicker={() => openRirPicker(exerciseIndex, setIndex)}
                    />
                  ))}

                  {exerciseOpen > 0 ? (
                    <View style={styles.reviewExerciseActions}>
                      <Button
                        mode="outlined"
                        icon="auto-fix"
                        onPress={() => fillOpenSetsForExercise(exerciseIndex)}
                        style={styles.reviewExerciseAction}
                      >
                        Prefill open
                      </Button>
                      <Button
                        mode="contained"
                        icon="check-all"
                        onPress={() => completeExerciseOpenSets(exerciseIndex)}
                        style={styles.reviewExerciseAction}
                      >
                        {exerciseOpen === 1 ? 'Log open set' : `Log ${exerciseOpen} open sets`}
                      </Button>
                    </View>
                  ) : null}
                </Card.Content>
              </Card>
            );
          })}

          {saveError ? (
            <View style={[styles.saveErrorPanel, { backgroundColor: colors.warningSoft }]}>
              <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>
                {saveError}
              </Text>
              <Button
                compact
                mode="outlined"
                onPress={() => saveCompletedSession(session)}
                loading={isSaving}
              >
                Retry save
              </Button>
            </View>
          ) : null}

          <View style={styles.finishActions}>
            {remainingSets > 0 ? (
              <Button
                mode="outlined"
                icon="skip-next-outline"
                disabled={completedSets === 0 || isSaving}
                onPress={() => setShowSaveIncompleteDialog(true)}
              >
                Save incomplete
              </Button>
            ) : null}
            <Button
              mode="contained"
              icon="check-circle-outline"
              loading={isSaving}
              disabled={completedSets === 0 || remainingSets > 0 || isSaving}
              onPress={() => saveCompletedSession(session)}
            >
              Save workout
            </Button>
            {completedSets === 0 ? (
              <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                Log at least one completed set before saving, or continue the workout.
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <RirPickerSheet
          modalRef={rirSheetRef}
          value={rirValue}
          onConfirm={confirmRir}
          onClear={clearRir}
          onDismiss={() => setRirTarget(null)}
        />

        <Portal>
          <Dialog
            visible={showSaveIncompleteDialog}
            onDismiss={() => setShowSaveIncompleteDialog(false)}
          >
            <Dialog.Title>Save an incomplete workout?</Dialog.Title>
            <Dialog.Content>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                The {remainingSets} open sets will be marked skipped. They will not count toward
                volume, records, or progression.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowSaveIncompleteDialog(false)}>Keep reviewing</Button>
              <Button onPress={saveIncompleteSession} disabled={isSaving}>
                Save incomplete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  if (finished) {
    const review = buildWorkoutSessionReview(session, {
      history: [session, ...history.filter((item) => item.id !== session.id)],
      userExperience: preferences.experience,
      units: preferences.units,
    });
    const summary = review.summary;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {showCelebration && <PrCelebration onDone={() => setShowCelebration(false)} />}
        <ScrollView
          contentContainerStyle={{
            paddingTop: safeTop,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.xxl,
            gap: spacing.lg,
          }}
        >
          <Card
            mode="contained"
            style={[
              styles.completeCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
                borderRadius: radius.xl,
              },
            ]}
          >
            <Card.Content style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={[typography.micro, { color: colors.accent }]}>Session saved</Text>
                <Text style={[typography.title, { color: colors.textPrimary }]}>
                  {day.name} complete
                </Text>
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  {summary.completedSets} working sets,{' '}
                  {formatVolumeLoad(summary.volumeKg, preferences.units)} volume, and{' '}
                  {summary.exerciseCount} trained lifts added to your log.
                </Text>
              </View>

              <View style={styles.finishMetricGrid}>
                <FinishMetric label="duration" value={`${summary.durationMinutes}m`} />
                <FinishMetric
                  label="volume"
                  value={formatVolumeLoad(summary.volumeKg, preferences.units)}
                />
                <FinishMetric label="sets" value={String(summary.completedSets)} />
                <FinishMetric label="PRs" value={String(newRecordCount)} />
              </View>

              <ProgressBar
                progress={1}
                color={colors.accent}
                style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
              />

              <View
                style={[
                  styles.nextActionPanel,
                  { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                ]}
              >
                <Text style={[typography.micro, { color: colors.accent }]}>Next session</Text>
                <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                  {review.nextAction}
                </Text>
              </View>

              {saveError != null && (
                <Text style={[typography.caption, { color: colors.warning }]}>{saveError}</Text>
              )}
            </Card.Content>
          </Card>

          <Card mode="contained" style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[typography.micro, { color: colors.accent }]}>Performance</Text>
                  <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                    Top lifts
                  </Text>
                </View>
                <Chip
                  compact
                  mode="flat"
                  icon={newRecordCount > 0 ? 'trophy-outline' : 'chart-line'}
                >
                  {newRecordCount > 0 ? `${newRecordCount} new` : 'logged'}
                </Chip>
              </View>

              <View style={{ gap: spacing.sm }}>
                {review.topExercises.map((exercise, index) => (
                  <TopExerciseRow
                    key={exercise.exerciseId}
                    exercise={exercise}
                    rank={index + 1}
                    units={preferences.units}
                  />
                ))}
              </View>
            </Card.Content>
          </Card>

          <Card mode="contained" style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[typography.micro, { color: colors.accent }]}>Next targets</Text>
                  <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                    Progression decisions
                  </Text>
                </View>
                <Chip compact mode="flat" icon="trending-up">
                  {review.progression.length}
                </Chip>
              </View>

              <View style={{ gap: spacing.sm }}>
                {review.progression.map((item) => (
                  <ProgressionReviewRow
                    key={item.exerciseId}
                    item={item}
                    units={preferences.units}
                  />
                ))}
              </View>
            </Card.Content>
          </Card>

          <Card mode="contained" style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[typography.micro, { color: colors.accent }]}>Muscle dose</Text>
                  <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                    What got hit
                  </Text>
                </View>
                <Chip compact mode="flat" icon="arm-flex-outline">
                  {review.muscleDose.length} zones
                </Chip>
              </View>

              <View style={{ gap: spacing.sm }}>
                {review.muscleDose.map((dose) => (
                  <MuscleDoseRow key={dose.muscle} dose={dose} />
                ))}
              </View>
            </Card.Content>
          </Card>

          <Card mode="contained" style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[typography.micro, { color: colors.accent }]}>Execution</Text>
                  <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                    Effort and form
                  </Text>
                </View>
                <Chip
                  compact
                  mode="flat"
                  icon={summary.averageFormScore != null ? 'camera-outline' : 'camera-off-outline'}
                >
                  {summary.averageFormScore != null
                    ? `Form ${summary.averageFormScore}/100`
                    : 'no camera'}
                </Chip>
              </View>

              <View style={styles.qualityGrid}>
                <RirQualityBlock review={review.rir} />
                <FormQualityBlock review={review.form} />
              </View>
            </Card.Content>
          </Card>

          <View style={styles.finishActions}>
            <Button
              mode="outlined"
              icon={templateSaved ? 'check' : 'content-save-outline'}
              onPress={saveAsTemplate}
              loading={isSavingTemplate}
              disabled={templateSaved || isSavingTemplate}
              style={styles.finishButton}
            >
              {templateSaved ? 'Saved as template' : 'Save as template'}
            </Button>
            <Button
              mode="contained-tonal"
              icon="history"
              onPress={() => router.push('/history')}
              style={styles.finishButton}
            >
              View history
            </Button>
            <Button
              mode="contained"
              icon="refresh"
              onPress={() => {
                setSession(startWorkoutSession(day, userId));
                setActiveExerciseIndex(0);
                setFinished(false);
                setSaveError(null);
                setNewRecordCount(0);
                setTemplateSaved(false);
                setShowCelebration(false);
                setAutosaveState('idle');
                setLastAutosavedAt(null);
                setCheckInSkipped(false);
              }}
              style={styles.finishButton}
            >
              Start another run
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingTop: safeTop + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 220,
          gap: spacing.lg,
        }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{programName}</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{day.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <Button
              compact
              mode={isPaused ? 'contained' : 'contained-tonal'}
              icon={isPaused ? 'play' : 'pause'}
              onPress={isPaused ? resumeSession : pauseSession}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              compact
              mode="contained-tonal"
              icon="flag-checkered"
              onPress={endLiveWorkout}
              disabled={isPaused || isSaving}
            >
              Review
            </Button>
          </View>
        </View>

        <Card
          mode="contained"
          style={[
            styles.commandCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.metricRow}>
              <Metric label="sets" value={`${completedSets}/${plannedSets}`} />
              <Metric label="volume" value={formatVolumeLoad(volume, preferences.units)} />
              <Metric label="rest" value={session.restTimer ? 'running' : 'ready'} />
            </View>
            <ProgressBar
              progress={progress}
              color={colors.accent}
              style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
            />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Log sets now when useful, or end the workout and add the details afterward.
            </Text>
            <View style={styles.autosaveRow}>
              <Chip
                compact
                mode="flat"
                icon={autosaveIcon(autosaveState)}
                textStyle={{
                  color: autosaveState === 'error' ? colors.warning : colors.textSecondary,
                }}
                style={{
                  backgroundColor:
                    autosaveState === 'error' ? colors.warningSoft : colors.surfaceRaised,
                }}
              >
                {autosaveLabel(autosaveState, lastAutosavedAt)}
              </Chip>
              {autosaveState === 'error' ? (
                <Text style={[typography.micro, { color: colors.warning, flex: 1 }]}>
                  Still on screen. Next edit retries the local save.
                </Text>
              ) : null}
            </View>
            {saveError != null ? (
              <View style={[styles.saveErrorPanel, { backgroundColor: colors.warningSoft }]}>
                <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>
                  {saveError}
                </Text>
                <Button
                  compact
                  mode="outlined"
                  onPress={() => saveCompletedSession(session)}
                  loading={isSaving}
                >
                  Retry save
                </Button>
              </View>
            ) : null}
            {formAnalysisStatus ? (
              <Text style={[typography.micro, { color: colors.accent }]}>{formAnalysisStatus}</Text>
            ) : null}
          </Card.Content>
        </Card>

        {!isPaused && completedSets === 0 && session.readiness == null && !checkInSkipped ? (
          <ReadinessCheckInCard onSave={saveReadiness} onSkip={() => setCheckInSkipped(true)} />
        ) : null}

        {session.readiness?.hasPain ? (
          <View style={[styles.saveErrorPanel, { backgroundColor: colors.warningSoft }]}>
            <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>
              {painMessage(session.readiness)}
            </Text>
          </View>
        ) : null}

        {isPaused ? (
          <View
            style={[
              styles.pausedPanel,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.warning,
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.captionBold, { color: colors.warning }]}>
                Workout paused
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Your draft is saved locally. Resume to keep logging, or discard this run.
              </Text>
            </View>
            <View style={styles.pausedActions}>
              <Button compact mode="contained" icon="play" onPress={resumeSession}>
                Resume
              </Button>
              <Button
                compact
                mode="outlined"
                icon="trash-can-outline"
                textColor={colors.danger}
                onPress={() => setShowDiscardDialog(true)}
              >
                Discard
              </Button>
            </View>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exerciseRail}
        >
          {session.exercises.map((performed, index) => {
            const exercise = requireExercise(performed.exerciseId);
            const done = isExerciseDone(performed);
            return (
              <View key={performed.id} style={styles.railItem}>
                <Chip
                  mode={index === activeExerciseIndex ? 'flat' : 'outlined'}
                  selected={index === activeExerciseIndex}
                  icon={done ? 'check' : 'dumbbell'}
                  onPress={() => setActiveExerciseIndex(index)}
                >
                  {shortExerciseName(exercise.name)}
                </Chip>
                {performed.prescription.supersetWithNext ? (
                  <Chip compact mode="flat" icon="link-variant" style={styles.railSupersetBadge}>
                    SS
                  </Chip>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <Card
          mode="contained"
          style={[
            styles.activeCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.md }}>
            <View style={styles.header}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.micro, { color: colors.accent }]}>
                  Active lift · {activeCompletedSets}/{activeExercise.sets.length} sets
                </Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {activeExerciseMeta.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {targetLabel} · rest {formatRest(activePrescription.restSeconds)}
                </Text>
              </View>
              <View style={styles.activeBadges}>
                {activePrescription.setTechnique &&
                activePrescription.setTechnique !== 'standard' ? (
                  <Chip
                    compact
                    mode="flat"
                    icon="fire"
                    style={{ backgroundColor: colors.accentSoft }}
                  >
                    {techniqueLabel(activePrescription.setTechnique)}
                  </Chip>
                ) : null}
                <Chip compact mode="flat" icon="timer-outline">
                  {formatRest(activePrescription.restSeconds)}
                </Chip>
              </View>
            </View>

            {activePrescription.note ? (
              <View
                style={[
                  styles.notePanel,
                  { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                ]}
              >
                <Text style={[typography.micro, { color: colors.accent }]}>Coach note</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {activePrescription.note}
                </Text>
              </View>
            ) : null}

            {activeProgressionTarget ? (
              <ProgressionTargetPanel target={activeProgressionTarget} units={preferences.units} />
            ) : null}

            {activeExerciseIndex < session.exercises.length - 1 && (
              <Chip
                compact
                mode={activePrescription.supersetWithNext ? 'flat' : 'outlined'}
                selected={activePrescription.supersetWithNext}
                icon="link-variant"
                onPress={() => toggleSupersetWithNext(activeExerciseIndex)}
                disabled={isPaused}
                style={styles.supersetChip}
              >
                {activePrescription.supersetWithNext
                  ? `Paired with ${shortExerciseName(requireExercise(session.exercises[activeExerciseIndex + 1].exerciseId).name)} · no rest`
                  : 'Group with next lift'}
              </Chip>
            )}

            {activeVisionConfig ? (
              <Chip
                compact
                mode="outlined"
                icon="camera-outline"
                disabled={isPaused}
                onPress={() =>
                  router.push({
                    pathname: '/form-check/[exerciseId]',
                    params: {
                      exerciseId: activeExercise.exerciseId,
                      sessionId: session.id,
                      exerciseIndex: String(activeExerciseIndex),
                      setIndex: String(formTargetSetIndex),
                    },
                  })
                }
                style={styles.supersetChip}
              >
                {formTargetSet?.formAnalysis
                  ? `Form AI ${formTargetSet.formAnalysis.averageScore}/100`
                  : `Form AI · ${cameraAngleLabel(activeVisionConfig.recommendedCameraAngle)}`}
              </Chip>
            ) : null}

            <Divider />

            <View style={{ gap: spacing.sm }}>
              {activeExercise.sets.map((set, setIndex) => (
                <SetRow
                  key={set.id}
                  ref={(handle) => {
                    setRowRefs.current[set.id] = handle;
                  }}
                  set={set}
                  targetLabel={targetLabel}
                  equipment={activeExerciseMeta.equipment}
                  trackingType={activeExerciseMeta.trackingType}
                  units={preferences.units}
                  validationError={setValidationErrors[set.id]}
                  previousLabel={formatPreviousSet(
                    previousSetAtIndex(previousPerformance, setIndex),
                    preferences.units,
                  )}
                  onChange={(patch) => updateSet(activeExerciseIndex, setIndex, patch)}
                  onToggleComplete={() => toggleComplete(activeExerciseIndex, setIndex)}
                  onSubmitEditing={() => completeAndFocusNext(activeExerciseIndex, setIndex)}
                  onCopyPrevious={
                    setIndex > 0 ? () => copyPreviousSet(activeExerciseIndex, setIndex) : undefined
                  }
                  onCopyToRemaining={() => copySetToRemaining(activeExerciseIndex, setIndex)}
                  onToggleSkip={() => toggleSetSkipped(activeExerciseIndex, setIndex)}
                  onOpenRirPicker={() => openRirPicker(activeExerciseIndex, setIndex)}
                  disabled={isPaused}
                />
              ))}
            </View>

            <View style={styles.navigationRow}>
              <Button
                mode="contained-tonal"
                icon="chevron-left"
                onPress={() => setActiveExerciseIndex(Math.max(0, activeExerciseIndex - 1))}
                disabled={activeExerciseIndex === 0}
                style={styles.navButton}
              >
                Previous
              </Button>
              <Button
                mode="contained"
                icon="chevron-right"
                contentStyle={styles.nextButtonContent}
                onPress={() =>
                  setActiveExerciseIndex(
                    Math.min(session.exercises.length - 1, activeExerciseIndex + 1),
                  )
                }
                disabled={activeExerciseIndex === session.exercises.length - 1}
                style={styles.navButton}
              >
                Next exercise
              </Button>
            </View>

            <View
              style={[
                styles.assistantPanel,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.assistantHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.micro, { color: colors.accent }]}>Set assistant</Text>
                  <Text
                    style={[typography.bodyBold, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {activeAutofillSuggestion?.label ?? 'All sets logged'}
                  </Text>
                </View>
                <Chip compact mode="flat" icon="clipboard-check-outline">
                  {nextOpenSetIndex == null ? 'Done' : `Set ${nextOpenSetIndex + 1}`}
                </Chip>
              </View>

              <View style={styles.assistantFacts}>
                <AssistantFact
                  label="fill"
                  value={
                    activeAutofillSuggestion
                      ? compactSuggestionValue(activeAutofillSuggestion, preferences.units)
                      : 'locked'
                  }
                />
                <AssistantFact
                  label="source"
                  value={
                    activeAutofillSuggestion
                      ? sourceLabel(activeAutofillSuggestion.source)
                      : 'complete'
                  }
                />
                <AssistantFact label="open" value={String(openSetCount)} />
              </View>

              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {activeAutofillSuggestion?.detail ??
                  'Every set is logged. Finish the session when the work is done.'}
              </Text>

              <View style={styles.assistantActions}>
                <Button
                  compact
                  mode="contained-tonal"
                  icon="auto-fix"
                  onPress={fillNextSet}
                  disabled={isPaused || activeAutofillSuggestion == null}
                  style={styles.assistantButton}
                >
                  Fill next
                </Button>
                <Button
                  compact
                  mode="outlined"
                  icon="playlist-edit"
                  onPress={fillOpenSets}
                  disabled={isPaused || openSetCount === 0}
                  style={styles.assistantButton}
                >
                  Fill open
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card mode="outlined">
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Session order
            </Text>
            {session.exercises.map((performed, index) => {
              const exercise = requireExercise(performed.exerciseId);
              const done = isExerciseDone(performed);
              return (
                <Button
                  key={performed.id}
                  mode={index === activeExerciseIndex ? 'contained-tonal' : 'text'}
                  icon={done ? 'check-circle' : 'circle-outline'}
                  onPress={() => setActiveExerciseIndex(index)}
                  contentStyle={styles.orderButtonContent}
                >
                  {index + 1}. {exercise.name}
                </Button>
              );
            })}
          </Card.Content>
        </Card>
      </ScrollView>

      {session.restTimer != null && (
        <RestTimer
          timer={session.restTimer}
          onExtend={(seconds) =>
            setSession((prev) => ({
              ...prev,
              restTimer: prev.restTimer ? extendRestTimer(prev.restTimer, seconds) : null,
            }))
          }
          onDismiss={() => setSession((prev) => ({ ...prev, restTimer: null }))}
          bottomOffset={insets.bottom + 96}
          notificationStatus={restNotificationStatus}
        />
      )}

      <RirPickerSheet
        modalRef={rirSheetRef}
        value={
          rirTarget
            ? (session.exercises[rirTarget.exerciseIndex]?.sets[rirTarget.setIndex]?.rir ?? null)
            : null
        }
        onConfirm={confirmRir}
        onClear={clearRir}
        onDismiss={() => setRirTarget(null)}
      />

      <Portal>
        <Dialog visible={showDiscardDialog} onDismiss={() => setShowDiscardDialog(false)}>
          <Dialog.Title>Discard workout?</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              This removes the saved draft for {day.name}. Completed history stays untouched.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDiscardDialog(false)} disabled={isDiscarding}>
              Keep draft
            </Button>
            <Button
              icon="trash-can-outline"
              textColor={colors.danger}
              loading={isDiscarding}
              onPress={discardSession}
            >
              Discard
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  commandCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  completeCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewEditorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reviewStatusPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  reviewStatusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewStatusAction: {
    flexGrow: 1,
    flexBasis: 150,
  },
  reviewEditorCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewExerciseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewExerciseAction: {
    flexGrow: 1,
    flexBasis: 150,
  },
  completionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  finishMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  nextActionPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 4,
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
  reviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
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
  qualityGrid: {
    gap: 10,
  },
  qualityBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  finishActions: {
    gap: 10,
  },
  finishButton: {
    width: '100%',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  autosaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
  },
  saveErrorPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 10,
  },
  pausedPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pausedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  exerciseRail: {
    gap: 8,
    paddingRight: 16,
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  railSupersetBadge: {
    height: 28,
  },
  supersetChip: {
    alignSelf: 'flex-start',
  },
  activeCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  notePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  assistantPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  assistantFacts: {
    flexDirection: 'row',
    gap: 8,
  },
  assistantFact: {
    flex: 1,
    minWidth: 0,
  },
  assistantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  assistantButton: {
    flex: 1,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    flex: 1,
  },
  nextButtonContent: {
    flexDirection: 'row-reverse',
  },
  orderButtonContent: {
    justifyContent: 'flex-start',
  },
});
