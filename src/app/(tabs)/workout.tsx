import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, IconButton, Portal } from 'react-native-paper';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { durations, easeOutExpo } from '@/components/ui/motion';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { Reveal } from '@/components/ui/Reveal';
import { WorkoutSkeleton } from '@/components/ui/Skeleton';
import { ExerciseDemoModal } from '@/components/exercise/ExerciseDemoModal';
import { ElapsedClock } from '@/components/workout/ElapsedClock';
import { PrCelebration } from '@/components/workout/PrCelebration';
import { ReadinessCheckInCard } from '@/components/workout/ReadinessCheckInCard';
import { RestTimer } from '@/components/workout/RestTimer';
import { RirPickerSheet } from '@/components/workout/RirPickerSheet';
import { SetRow } from '@/components/workout/SetRow';
import {
  FinishMetric,
  FormQualityBlock,
  MuscleDoseRow,
  ProgressionReviewRow,
  ProgressionTargetPanel,
  RirQualityBlock,
  TopExerciseRow,
} from '@/components/workout/WorkoutReviewBlocks';
import { requireExercise } from '@/domain/exercises/catalog';
import { exerciseThumbnailUrl } from '@/domain/exercises/library';
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
import type { Exercise, ProgramDay, TrainingPreferences } from '@/types';
import { formatVolumeLoad } from '@/utils/units';

import {
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
  const [demoExercise, setDemoExercise] = useState<Exercise | null>(null);

  if (isHydratingDraft) {
    return (
      <View
        accessibilityLabel="Checking for a saved workout"
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: safeTop + spacing.md,
          paddingHorizontal: spacing.lg,
        }}
      >
        <WorkoutSkeleton />
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
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.display, { color: colors.textPrimary }]}>Review sets</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {remainingSets === 0
                ? `All ${plannedSets} sets decided. Save when ready.`
                : `${completedSets} of ${plannedSets} logged, ${remainingSets} still open.`}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Nothing counts toward progression until you save. You can leave and come back.
            </Text>
          </View>

          <View style={styles.reviewStatusActions}>
            <Button compact mode="text" onPress={continueLiveWorkout}>
              Back to workout
            </Button>
            {remainingSets > 0 ? (
              <Button compact mode="text" onPress={fillAllOpenSets}>
                Prefill all open
              </Button>
            ) : null}
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
              <View
                key={performed.id}
                style={[
                  styles.reviewEditorSection,
                  { borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[typography.heading, { color: colors.textPrimary }]}
                      numberOfLines={2}
                    >
                      {exercise.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {exerciseCompleted} of {performed.sets.length} logged, {exerciseTarget}
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
                      compact
                      mode="text"
                      onPress={() => fillOpenSetsForExercise(exerciseIndex)}
                    >
                      Prefill open
                    </Button>
                    <Button
                      compact
                      mode="text"
                      onPress={() => completeExerciseOpenSets(exerciseIndex)}
                    >
                      {exerciseOpen === 1 ? 'Log open set' : `Log ${exerciseOpen} open sets`}
                    </Button>
                  </View>
                ) : null}
              </View>
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
                disabled={completedSets === 0 || isSaving}
                onPress={() => setShowSaveIncompleteDialog(true)}
              >
                Save incomplete
              </Button>
            ) : null}
            <Button
              mode="contained"
              contentStyle={styles.primaryContent}
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
          <Reveal index={0}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.caption, { color: colors.accent }]}>Workout saved</Text>
              <Text style={[typography.display, { color: colors.textPrimary }]}>{day.name}</Text>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {summary.exerciseCount} lifts added to your log.
              </Text>
            </View>
          </Reveal>

          <Reveal index={1}>
            <View style={styles.finishMetricGrid}>
              <FinishMetric label="minutes" value={String(summary.durationMinutes)} />
              <FinishMetric
                label="volume"
                value={formatVolumeLoad(summary.volumeKg, preferences.units)}
              />
              <FinishMetric label="working sets" value={String(summary.completedSets)} />
              <FinishMetric
                label={newRecordCount === 1 ? 'new record' : 'new records'}
                value={String(newRecordCount)}
              />
            </View>
          </Reveal>

          <Reveal index={2}>
            <View style={[styles.nextActionPanel, { borderLeftColor: colors.accent }]}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Next time</Text>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                {review.nextAction}
              </Text>
            </View>
          </Reveal>

          {saveError != null && (
            <Text style={[typography.caption, { color: colors.warning }]}>{saveError}</Text>
          )}

          <Reveal index={3}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>Top lifts</Text>
              <View>
                {review.topExercises.map((exercise, index) => (
                  <TopExerciseRow
                    key={exercise.exerciseId}
                    exercise={exercise}
                    rank={index + 1}
                    units={preferences.units}
                  />
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal index={4}>
            {review.progression.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  Targets for next time
                </Text>
                <View>
                  {review.progression.map((item) => (
                    <ProgressionReviewRow
                      key={item.exerciseId}
                      item={item}
                      units={preferences.units}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </Reveal>

          <Reveal index={5}>
            <View style={{ gap: spacing.md }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                Muscles worked
              </Text>
              {review.muscleDose.map((dose) => (
                <MuscleDoseRow key={dose.muscle} dose={dose} />
              ))}
            </View>
          </Reveal>

          <Reveal index={6}>
            <View style={{ gap: spacing.md }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                Effort and form
              </Text>
              <RirQualityBlock review={review.rir} />
              <FormQualityBlock review={review.form} />
            </View>
          </Reveal>

          <View style={styles.finishActions}>
            <Button
              mode="outlined"
              onPress={saveAsTemplate}
              loading={isSavingTemplate}
              disabled={templateSaved || isSavingTemplate}
              style={styles.finishButton}
            >
              {templateSaved ? 'Saved to your workouts' : 'Save as workout'}
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push('/history')}
              style={styles.finishButton}
            >
              View history
            </Button>
            <Button
              mode="text"
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
              Do this workout again
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  const nextSuggestion =
    activeAutofillSuggestion && nextOpenSetIndex != null
      ? `Set ${nextOpenSetIndex + 1}: ${compactSuggestionValue(activeAutofillSuggestion, preferences.units)}, from ${sourceLabel(activeAutofillSuggestion.source)}`
      : null;
  const nextExercise = session.exercises[activeExerciseIndex + 1];
  const technique =
    activePrescription.setTechnique && activePrescription.setTechnique !== 'standard'
      ? techniqueLabel(activePrescription.setTechnique)
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 220,
          gap: spacing.xl,
        }}
      >
        <View style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {day.name}
              </Text>
              <View style={styles.clockRow}>
                <ElapsedClock
                  startedAt={session.startedAt}
                  totalPausedSeconds={session.totalPausedSeconds}
                  pausedAt={session.pausedAt}
                  style={[
                    typography.numeric,
                    { color: isPaused ? colors.textMuted : colors.accent, fontSize: 15 },
                  ]}
                />
                <Text
                  style={[
                    typography.caption,
                    {
                      color: autosaveState === 'error' ? colors.warning : colors.textMuted,
                      flex: 1,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {completedSets}/{plannedSets} sets, {formatVolumeLoad(volume, preferences.units)}.{' '}
                  {autosaveLabel(autosaveState, lastAutosavedAt)}
                </Text>
              </View>
            </View>
            <IconButton
              icon={isPaused ? 'play' : 'pause'}
              mode="contained-tonal"
              containerColor={colors.surfaceRaised}
              iconColor={colors.textPrimary}
              onPress={isPaused ? resumeSession : pauseSession}
              accessibilityLabel={isPaused ? 'Resume workout' : 'Pause workout'}
              style={styles.headerIcon}
            />
            <Button
              mode="contained"
              compact
              onPress={endLiveWorkout}
              disabled={isPaused || isSaving}
              contentStyle={styles.finishContent}
            >
              Finish
            </Button>
          </View>
          <ProgressLine progress={progress} spring />
          {autosaveState === 'error' ? (
            <Text style={[typography.caption, { color: colors.warning }]}>
              Your sets are still on screen. The next edit retries the local save.
            </Text>
          ) : null}
          {formAnalysisStatus ? (
            <Text style={[typography.caption, { color: colors.accent }]}>{formAnalysisStatus}</Text>
          ) : null}
        </View>

        {saveError != null ? (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.warningSoft, borderRadius: radius.lg },
            ]}
          >
            <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>
              {saveError}
            </Text>
            <Button
              compact
              mode="text"
              textColor={colors.warning}
              onPress={() => saveCompletedSession(session)}
              loading={isSaving}
            >
              Retry
            </Button>
          </View>
        ) : null}

        {!isPaused && completedSets === 0 && session.readiness == null && !checkInSkipped ? (
          <ReadinessCheckInCard onSave={saveReadiness} onSkip={() => setCheckInSkipped(true)} />
        ) : null}

        {session.readiness?.hasPain ? (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.warningSoft, borderRadius: radius.lg },
            ]}
          >
            <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>
              {painMessage(session.readiness)}
            </Text>
          </View>
        ) : null}

        {isPaused ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>Paused</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Your sets are saved on this phone.
              </Text>
            </View>
            <Button
              compact
              mode="text"
              textColor={colors.danger}
              onPress={() => setShowDiscardDialog(true)}
            >
              Discard
            </Button>
            <Button compact mode="contained" onPress={resumeSession}>
              Resume
            </Button>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exerciseRail}
          style={{ marginHorizontal: -spacing.lg }}
        >
          {session.exercises.map((performed, index) => {
            const exercise = requireExercise(performed.exerciseId);
            const done = isExerciseDone(performed);
            const active = index === activeExerciseIndex;
            const fg = active ? colors.textInverse : colors.textSecondary;
            return (
              <PressableScale
                key={performed.id}
                onPress={() => setActiveExerciseIndex(index)}
                pressedScale={0.94}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${exercise.name}${done ? ', done' : ''}`}
                style={[
                  styles.railItem,
                  {
                    backgroundColor: active ? colors.textPrimary : colors.surfaceRaised,
                    borderRadius: radius.md,
                  },
                ]}
              >
                {done ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={15}
                    color={active ? colors.textInverse : colors.success}
                  />
                ) : null}
                <Text style={[typography.captionBold, { color: fg }]}>
                  {shortExerciseName(exercise.name)}
                </Text>
                {performed.prescription.supersetWithNext ? (
                  <MaterialCommunityIcons name="link-variant" size={15} color={fg} />
                ) : null}
              </PressableScale>
            );
          })}
        </ScrollView>

        <Animated.View
          key={activeExercise.id}
          entering={FadeInRight.duration(durations.base).easing(easeOutExpo)}
          style={{ gap: spacing.md }}
        >
          <View style={styles.exerciseHead}>
            <PressableScale
              onPress={() => setDemoExercise(activeExerciseMeta)}
              pressedScale={0.94}
              accessibilityRole="button"
              accessibilityLabel={`Show how to do ${activeExerciseMeta.name}`}
              style={[
                styles.exerciseThumb,
                { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg },
              ]}
            >
              {exerciseThumbnailUrl(activeExerciseMeta) ? (
                <Image
                  source={{ uri: exerciseThumbnailUrl(activeExerciseMeta) }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <MaterialCommunityIcons name="dumbbell" size={24} color={colors.textMuted} />
              )}
            </PressableScale>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Exercise {activeExerciseIndex + 1} of {session.exercises.length}
                {technique ? `, ${technique}` : ''}
              </Text>
              <Text style={[typography.title, { color: colors.textPrimary }]}>
                {activeExerciseMeta.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {targetLabel}, rest {formatRest(activePrescription.restSeconds)}
              </Text>
            </View>
          </View>

          {activePrescription.note ? (
            <Text
              style={[
                typography.caption,
                styles.note,
                { color: colors.textSecondary, borderLeftColor: colors.borderStrong },
              ]}
            >
              {activePrescription.note}
            </Text>
          ) : null}

          {activeProgressionTarget ? (
            <ProgressionTargetPanel target={activeProgressionTarget} units={preferences.units} />
          ) : null}

          {nextExercise || activeVisionConfig ? (
            <View style={styles.toolRow}>
              {nextExercise ? (
                <Button
                  compact
                  mode="text"
                  icon="link-variant"
                  textColor={
                    activePrescription.supersetWithNext ? colors.accent : colors.textSecondary
                  }
                  onPress={() => toggleSupersetWithNext(activeExerciseIndex)}
                  disabled={isPaused}
                >
                  {activePrescription.supersetWithNext
                    ? `Paired with ${shortExerciseName(requireExercise(nextExercise.exerciseId).name)}`
                    : 'Pair with next'}
                </Button>
              ) : null}
              {activeVisionConfig ? (
                <Button
                  compact
                  mode="text"
                  icon="camera-outline"
                  textColor={colors.textSecondary}
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
                >
                  {formTargetSet?.formAnalysis
                    ? `Form ${formTargetSet.formAnalysis.averageScore}/100`
                    : `Form check, ${cameraAngleLabel(activeVisionConfig.recommendedCameraAngle).toLowerCase()}`}
                </Button>
              ) : null}
            </View>
          ) : null}

          <View>
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

          <View style={styles.assistantRow}>
            <Text
              style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
              numberOfLines={2}
            >
              {nextSuggestion ?? 'Every set is logged.'}
            </Text>
            <Button
              compact
              mode="text"
              onPress={fillNextSet}
              disabled={isPaused || activeAutofillSuggestion == null}
            >
              Fill next
            </Button>
            <Button
              compact
              mode="text"
              onPress={fillOpenSets}
              disabled={isPaused || openSetCount === 0}
            >
              Fill all
            </Button>
          </View>

          <View style={styles.navigationRow}>
            <Button
              mode="outlined"
              onPress={() => setActiveExerciseIndex(Math.max(0, activeExerciseIndex - 1))}
              disabled={activeExerciseIndex === 0}
              style={styles.navButton}
              contentStyle={styles.navContent}
            >
              Previous
            </Button>
            <Button
              mode="contained"
              onPress={() =>
                setActiveExerciseIndex(
                  Math.min(session.exercises.length - 1, activeExerciseIndex + 1),
                )
              }
              disabled={!nextExercise}
              style={styles.navButton}
              contentStyle={styles.navContent}
            >
              Next exercise
            </Button>
          </View>
        </Animated.View>
      </ScrollView>

      <ExerciseDemoModal
        key={demoExercise?.id ?? 'closed'}
        exercise={demoExercise}
        actionLabel="Back to workout"
        actionIcon="arrow-left"
        onAction={() => setDemoExercise(null)}
        onDismiss={() => setDemoExercise(null)}
      />

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
  headerIcon: {
    margin: 0,
  },
  finishContent: {
    minHeight: 44,
    paddingHorizontal: 6,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
  },
  note: {
    borderLeftWidth: 2,
    paddingLeft: 12,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navContent: {
    minHeight: 52,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  exerciseThumb: {
    width: 72,
    height: 72,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewStatusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
  },
  reviewExerciseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  finishMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  nextActionPanel: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  finishActions: {
    gap: 10,
  },
  finishButton: {
    width: '100%',
  },
  saveErrorPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 10,
  },
  exerciseRail: {
    gap: 8,
    paddingHorizontal: 16,
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    flex: 1,
  },
  reviewEditorSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryContent: {
    minHeight: 52,
  },
});
