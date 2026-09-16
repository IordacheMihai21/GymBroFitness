import { type ElementRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppState, ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
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

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { PrCelebration } from '@/components/workout/PrCelebration';
import { RestTimer } from '@/components/workout/RestTimer';
import { RirPickerSheet } from '@/components/workout/RirPickerSheet';
import { SetRow } from '@/components/workout/SetRow';
import { getExercise, requireExercise } from '@/domain/exercises/catalog';
import { buildManualPrescription, recalculateProgramDay } from '@/domain/programs/programEditing';
import { saveTemplate, listTemplates } from '@/domain/programs/templateStore';
import { buildTemplateFromSession, defaultTemplateName } from '@/domain/programs/templates';
import { detectPersonalRecords, sessionVolumeKg } from '@/domain/workouts/analytics';
import type { WorkoutExerciseSummary } from '@/domain/workouts/history';
import {
  discardInProgressWorkoutSession,
  getInProgressWorkoutSession,
  listWorkoutHistory,
  saveInProgressWorkoutSession,
  saveWorkoutSession,
} from '@/domain/workouts/historyStore';
import {
  findLastPerformedExercise,
  previousSetAtIndex,
  formatPreviousSet,
} from '@/domain/workouts/lastPerformance';
import { buildAllPersonalRecordsFromHistory } from '@/domain/workouts/historyInsights';
import {
  buildSetAutofillSuggestion,
  setAutofillPatch,
  type SetAutofillSuggestion,
} from '@/domain/workouts/setAutofill';
import { startWorkoutSession } from '@/domain/workouts/session';
import { navigateAfterSetCompletion } from '@/domain/workouts/supersetNavigation';
import {
  buildProgramProgressionTargets,
  formatProgressionSignal,
  progressionActionLabel,
  type TargetToBeat,
} from '@/domain/workouts/targetToBeat';
import {
  buildWorkoutSessionReview,
  type WorkoutFormReview,
  type WorkoutMuscleDose,
  type WorkoutProgressionReview,
  type WorkoutRirReview,
} from '@/domain/workouts/workoutReview';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import {
  takePendingFormAnalysisResult,
  type PendingFormAnalysisResult,
} from '@/domain/vision/formAnalysisResultStore';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type {
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  SetTechnique,
  TrainingPreferences,
  WorkoutSession,
} from '@/types';

type AutosaveState = 'idle' | 'restored' | 'saving' | 'saved' | 'error';

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

  const [session, setSession] = useState(() => startWorkoutSession(day, userId));
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restDurationSeconds, setRestDurationSeconds] = useState<number | null>(null);
  const [restToken, setRestToken] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newRecordCount, setNewRecordCount] = useState(0);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [rirSetIndex, setRirSetIndex] = useState<number | null>(null);
  const rirSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isHydratingDraft, setIsHydratingDraft] = useState(true);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [formAnalysisStatus, setFormAnalysisStatus] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([listWorkoutHistory(), getInProgressWorkoutSession()])
      .then(([nextHistory, draft]) => {
        if (!mounted) return;
        setHistory(nextHistory);
        if (draft && isResumableSession(draft)) {
          setSession(draft);
          setAutosaveState('restored');
          setLastAutosavedAt(draft.startedAt);
          const firstOpenExercise = draft.exercises.findIndex(
            (exercise) => !isExerciseDone(exercise),
          );
          setActiveExerciseIndex(firstOpenExercise === -1 ? 0 : firstOpenExercise);
        } else {
          setAutosaveState('idle');
        }
      })
      .finally(() => {
        if (mounted) setIsHydratingDraft(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isHydratingDraft || finished || !isResumableSession(session)) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      setAutosaveState('saving');
      saveInProgressWorkoutSession(session)
        .then((saved) => {
          setLastAutosavedAt(new Date().toISOString());
          setAutosaveState(saved.id === session.id ? 'saved' : 'idle');
        })
        .catch(() => {
          setAutosaveState('error');
        });
    }, 500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [finished, isHydratingDraft, session]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      takePendingFormAnalysisResult(session.id).then((result) => {
        if (!mounted || !result) return;
        setSession((prev) => attachFormAnalysisResult(prev, result));
        setFormAnalysisStatus(`Form AI attached to set ${result.setIndex + 1}.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
      return () => {
        mounted = false;
      };
    }, [session.id]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' || isHydratingDraft || finished || !isResumableSession(session)) {
        return;
      }

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      saveInProgressWorkoutSession(session)
        .then(() => {
          setLastAutosavedAt(new Date().toISOString());
          setAutosaveState('saved');
        })
        .catch(() => setAutosaveState('error'));
    });

    return () => subscription.remove();
  }, [finished, isHydratingDraft, session]);

  const activeExercise = session.exercises[activeExerciseIndex] ?? session.exercises[0];
  const isPaused = session.status === 'paused';
  const activeExerciseMeta = requireExercise(activeExercise.exerciseId);
  const activeVisionConfig = getVisionConfigForMovementPattern(activeExerciseMeta.movementPattern);
  const activePrescription = activeExercise.prescription;
  const plannedSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = countCompletedSets(session.exercises);
  const progress = plannedSets > 0 ? completedSets / plannedSets : 0;
  const volume = sessionVolumeKg(session);
  const activeCompletedSets = activeExercise.sets.filter(
    (set) => set.completed && !set.skipped,
  ).length;
  const targetLabel = `${activePrescription.minReps}-${activePrescription.maxReps} @ RIR ${activePrescription.targetRir}`;
  const previousPerformance = useMemo(
    () => findLastPerformedExercise(history, activeExercise.exerciseId),
    [history, activeExercise.exerciseId],
  );
  const nextOpenSetIndex = firstOpenSetIndex(activeExercise.sets);
  const formTargetSetIndex = nextOpenSetIndex ?? Math.max(0, activeExercise.sets.length - 1);
  const formTargetSet = activeExercise.sets[formTargetSetIndex];
  const openSetCount = activeExercise.sets.filter((set) => !set.completed && !set.skipped).length;
  const activeAutofillSuggestion = useMemo(
    () =>
      nextOpenSetIndex == null
        ? null
        : buildSetAutofillSuggestion(activeExercise, previousPerformance, nextOpenSetIndex),
    [activeExercise, nextOpenSetIndex, previousPerformance],
  );
  const progressionTargets = useMemo(
    () =>
      buildProgramProgressionTargets({
        prescriptions: session.exercises.map((exercise) => exercise.prescription),
        history,
        userExperience: preferences.experience,
      }),
    [history, preferences.experience, session.exercises],
  );
  const activeProgressionTarget = progressionTargets.get(activeExercise.exerciseId) ?? null;

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<PerformedSet>) {
    setSession((prev) => {
      if (prev.status === 'paused') return prev;
      const exercises = [...prev.exercises];
      const sets = [...exercises[exerciseIndex].sets];
      sets[setIndex] = { ...sets[setIndex], ...patch };
      exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
      return { ...prev, exercises };
    });
  }

  function openRirPicker(setIndex: number) {
    if (isPaused) return;
    setRirSetIndex(setIndex);
    rirSheetRef.current?.present();
  }

  function confirmRir(value: number) {
    if (isPaused) return;
    if (rirSetIndex != null) {
      updateSet(activeExerciseIndex, rirSetIndex, { rir: value });
      Haptics.selectionAsync();
    }
    rirSheetRef.current?.dismiss();
  }

  function copyPreviousSet(exerciseIndex: number, setIndex: number) {
    if (isPaused) return;
    const previous = session.exercises[exerciseIndex]?.sets[setIndex - 1];
    if (!previous) return;
    Haptics.selectionAsync();
    updateSet(exerciseIndex, setIndex, {
      loadKg: previous.loadKg,
      reps: previous.reps,
      rir: previous.rir,
      durationSeconds: previous.durationSeconds,
    });
  }

  function fillNextSet() {
    if (isPaused) return;
    if (nextOpenSetIndex == null || activeAutofillSuggestion == null) return;
    Haptics.selectionAsync();
    updateSet(activeExerciseIndex, nextOpenSetIndex, setAutofillPatch(activeAutofillSuggestion));
  }

  function fillOpenSets() {
    if (isPaused) return;
    if (openSetCount === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSession((prev) => {
      const exercises = [...prev.exercises];
      const exercise = exercises[activeExerciseIndex];
      const previous = findLastPerformedExercise(history, exercise.exerciseId);
      const nextExercise: PerformedExercise = { ...exercise, sets: [...exercise.sets] };

      nextExercise.sets = nextExercise.sets.map((set, index) => {
        if (set.completed || set.skipped) return set;
        const suggestion = buildSetAutofillSuggestion(nextExercise, previous, index);
        const nextSet = { ...set, ...setAutofillPatch(suggestion) };
        nextExercise.sets[index] = nextSet;
        return nextSet;
      });

      exercises[activeExerciseIndex] = nextExercise;
      return { ...prev, exercises };
    });
  }

  function toggleComplete(exerciseIndex: number, setIndex: number) {
    if (isPaused) return;
    const exercise = session.exercises[exerciseIndex];
    const set = exercise.sets[setIndex];
    const nowCompleting = !set.completed;
    updateSet(exerciseIndex, setIndex, {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : null,
    });

    if (nowCompleting) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nav = navigateAfterSetCompletion(session.exercises, exerciseIndex);
      if (!nav.skipRest) {
        setRestDurationSeconds(exercise.prescription.restSeconds);
        setRestSeconds(exercise.prescription.restSeconds);
        setRestToken((t) => t + 1);
      }
      if (nav.nextExerciseIndex != null) setActiveExerciseIndex(nav.nextExerciseIndex);
    }
  }

  function toggleSupersetWithNext(exerciseIndex: number) {
    setSession((prev) => {
      const exercises = [...prev.exercises];
      const current = exercises[exerciseIndex];
      exercises[exerciseIndex] = {
        ...current,
        prescription: {
          ...current.prescription,
          supersetWithNext: !current.prescription.supersetWithNext,
        },
      };
      return { ...prev, exercises };
    });
    Haptics.selectionAsync();
  }

  function pauseSession() {
    if (isPaused || finished) return;
    Haptics.selectionAsync();
    setRestSeconds(null);
    setRestDurationSeconds(null);
    setSession((prev) => ({ ...prev, status: 'paused' }));
    setAutosaveState('saving');
  }

  function resumeSession() {
    if (!isPaused) return;
    Haptics.selectionAsync();
    setSession((prev) => ({ ...prev, status: 'in_progress' }));
    setAutosaveState('saving');
  }

  async function discardSession() {
    if (isDiscarding) return;
    setIsDiscarding(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    try {
      await discardInProgressWorkoutSession(session.id);
      setSession((prev) => ({ ...prev, status: 'discarded' }));
      setRestSeconds(null);
      setRestDurationSeconds(null);
      setShowDiscardDialog(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.replace('/');
    } finally {
      setIsDiscarding(false);
    }
  }

  async function finishSession() {
    if (isSaving || completedSets === 0) return;
    setIsSaving(true);
    setSaveError(null);

    const completedSession: WorkoutSession = {
      ...session,
      status: 'completed',
      finishedAt: new Date().toISOString(),
    };

    try {
      const saved = await saveWorkoutSession(completedSession);
      const existingRecords = buildAllPersonalRecordsFromHistory(
        history.filter((item) => item.id !== saved.id),
      );
      const records = detectPersonalRecords(saved, existingRecords, getExercise);
      setSession(saved);
      setHistory((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setNewRecordCount(records.length);
      if (records.length > 0) setShowCelebration(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSession(completedSession);
      setSaveError('Session finished, but local history could not be updated.');
    } finally {
      setFinished(true);
      setIsSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (isSavingTemplate || templateSaved) return;
    setIsSavingTemplate(true);
    const template = buildTemplateFromSession(session, defaultTemplateName(day.name));
    await saveTemplate(template);
    setTemplateSaved(true);
    setIsSavingTemplate(false);
    Haptics.selectionAsync();
  }

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

  if (finished) {
    const review = buildWorkoutSessionReview(session, {
      history: [session, ...history.filter((item) => item.id !== session.id)],
      userExperience: preferences.experience,
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
                  {summary.completedSets} working sets, {formatVolume(summary.volumeKg)} volume, and{' '}
                  {summary.exerciseCount} trained lifts added to your log.
                </Text>
              </View>

              <View style={styles.finishMetricGrid}>
                <FinishMetric label="duration" value={`${summary.durationMinutes}m`} />
                <FinishMetric label="volume" value={formatVolume(summary.volumeKg)} />
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
                  <TopExerciseRow key={exercise.exerciseId} exercise={exercise} rank={index + 1} />
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
                  <ProgressionReviewRow key={item.exerciseId} item={item} />
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
                setRestSeconds(null);
                setRestDurationSeconds(null);
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
              onPress={finishSession}
              disabled={isPaused || completedSets === 0 || isSaving}
              loading={isSaving}
            >
              Finish
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
              <Metric label="volume" value={formatVolume(volume)} />
              <Metric
                label="rest"
                value={restSeconds != null ? formatRest(restSeconds) : 'ready'}
              />
            </View>
            <ProgressBar
              progress={progress}
              color={colors.accent}
              style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
            />
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
            {formAnalysisStatus ? (
              <Text style={[typography.micro, { color: colors.accent }]}>{formAnalysisStatus}</Text>
            ) : null}
          </Card.Content>
        </Card>

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
              <ProgressionTargetPanel target={activeProgressionTarget} />
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
                      ? compactSuggestionValue(activeAutofillSuggestion)
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

            <View style={styles.navigationRow}>
              <Button
                mode="contained-tonal"
                icon="chevron-left"
                onPress={() => setActiveExerciseIndex(Math.max(0, activeExerciseIndex - 1))}
                disabled={activeExerciseIndex === 0}
                style={styles.navButton}
              >
                Prev
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
                Next lift
              </Button>
            </View>

            <View style={{ gap: spacing.sm }}>
              {activeExercise.sets.map((set, setIndex) => (
                <SetRow
                  key={set.id}
                  set={set}
                  targetLabel={targetLabel}
                  equipment={activeExerciseMeta.equipment}
                  previousLabel={formatPreviousSet(
                    previousSetAtIndex(previousPerformance, setIndex),
                  )}
                  onChange={(patch) => updateSet(activeExerciseIndex, setIndex, patch)}
                  onToggleComplete={() => toggleComplete(activeExerciseIndex, setIndex)}
                  onCopyPrevious={
                    setIndex > 0 ? () => copyPreviousSet(activeExerciseIndex, setIndex) : undefined
                  }
                  onOpenRirPicker={() => openRirPicker(setIndex)}
                  disabled={isPaused}
                />
              ))}
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

      {restSeconds != null && (
        <RestTimer
          key={restToken}
          secondsRemaining={restSeconds}
          initialSeconds={restDurationSeconds ?? restSeconds}
          onChangeSeconds={setRestSeconds}
          onDismiss={() => {
            setRestSeconds(null);
            setRestDurationSeconds(null);
          }}
          bottomOffset={insets.bottom + 96}
        />
      )}

      <RirPickerSheet
        modalRef={rirSheetRef}
        value={rirSetIndex != null ? (activeExercise.sets[rirSetIndex]?.rir ?? null) : null}
        onConfirm={confirmRir}
        onDismiss={() => setRirSetIndex(null)}
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

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function AssistantFact({ label, value }: { label: string; value: string }) {
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

function FinishMetric({ label, value }: { label: string; value: string }) {
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

function TopExerciseRow({ exercise, rank }: { exercise: WorkoutExerciseSummary; rank: number }) {
  const { colors, typography } = useTheme();
  const bestLabel =
    exercise.bestE1rmKg != null
      ? `e1RM ${Math.round(exercise.bestE1rmKg)}kg`
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
          {exercise.completedSets} sets · {formatVolume(exercise.volumeKg)} · {bestLabel}
        </Text>
      </View>
    </View>
  );
}

function MuscleDoseRow({ dose }: { dose: WorkoutMuscleDose }) {
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

function RirQualityBlock({ review }: { review: WorkoutRirReview | null }) {
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

function FormQualityBlock({ review }: { review: WorkoutFormReview | null }) {
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

function ProgressionTargetPanel({ target }: { target: TargetToBeat }) {
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
            {target.targetText}
          </Text>
        </View>
        <Chip compact mode="flat" icon="trending-up">
          {action}
        </Chip>
      </View>
      <View style={styles.progressionFacts}>
        <AssistantFact label="last" value={formatProgressionSignal(target.lastSignal)} />
        <AssistantFact label="win" value={target.winCondition} />
      </View>
      <Text style={[typography.micro, { color: colors.textSecondary }]} numberOfLines={2}>
        {target.decision.explanation}
      </Text>
    </View>
  );
}

function ProgressionReviewRow({ item }: { item: WorkoutProgressionReview }) {
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
          {item.targetSummary}
        </Text>
      </View>
    </View>
  );
}

function countCompletedSets(exercises: PerformedExercise[]): number {
  return exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed && !set.skipped).length,
    0,
  );
}

function isExerciseDone(exercise: PerformedExercise): boolean {
  return exercise.sets.every((set) => set.completed || set.skipped);
}

function isResumableSession(session: WorkoutSession): boolean {
  return session.status === 'in_progress' || session.status === 'paused';
}

function firstOpenSetIndex(sets: PerformedSet[]): number | null {
  const index = sets.findIndex((set) => !set.completed && !set.skipped);
  return index === -1 ? null : index;
}

function shortExerciseName(name: string): string {
  return name
    .replace(/^Barbell /, '')
    .replace(/^Dumbbell /, 'DB ')
    .replace('Romanian Deadlift', 'RDL');
}

function formatRest(seconds: number): string {
  if (seconds <= 0) return 'done';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, '0')}`;
}

function formatVolume(volumeKg: number): string {
  return volumeKg >= 1000 ? `${(volumeKg / 1000).toFixed(1)}t` : `${Math.round(volumeKg)}kg`;
}

function autosaveIcon(state: AutosaveState): string {
  switch (state) {
    case 'restored':
      return 'backup-restore';
    case 'saving':
      return 'cloud-sync-outline';
    case 'saved':
      return 'content-save-check-outline';
    case 'error':
      return 'alert-circle-outline';
    case 'idle':
      return 'content-save-outline';
  }
}

function autosaveLabel(state: AutosaveState, savedAt: string | null): string {
  switch (state) {
    case 'restored':
      return 'Draft restored';
    case 'saving':
      return 'Saving draft';
    case 'saved':
      return savedAt ? `Autosaved ${formatClock(savedAt)}` : 'Autosaved';
    case 'error':
      return 'Autosave issue';
    case 'idle':
      return 'Draft ready';
  }
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function compactSuggestionValue(suggestion: SetAutofillSuggestion): string {
  if (suggestion.durationSeconds != null) return `${suggestion.durationSeconds}s`;
  if (suggestion.loadKg != null && suggestion.reps != null) {
    return `${suggestion.loadKg} × ${suggestion.reps}`;
  }
  if (suggestion.reps != null) return `${suggestion.reps} reps`;
  return 'target';
}

function sourceLabel(source: SetAutofillSuggestion['source']): string {
  switch (source) {
    case 'previous_session_set':
      return 'last set';
    case 'previous_session_top_set':
      return 'top set';
    case 'current_previous_set':
      return 'this lift';
    case 'prescription':
      return 'plan';
  }
}

function buildCustomWorkoutDay({
  enabled,
  idsParam,
  nameParam,
  preferences,
}: {
  enabled: boolean;
  idsParam?: string;
  nameParam?: string;
  preferences: TrainingPreferences;
}): ProgramDay | null {
  if (!enabled || !idsParam) return null;
  const exerciseIds = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const prescriptions = exerciseIds.flatMap((id, index) => {
    const exercise = getExercise(id);
    return exercise ? [buildManualPrescription(exercise, index, preferences)] : [];
  });
  if (prescriptions.length === 0) return null;

  return recalculateProgramDay({
    id: `custom-${exerciseIds.join('-')}`,
    name: nameParam?.trim() || 'Custom Workout',
    order: 0,
    focus: [],
    prescriptions,
    estimatedMinutes: 0,
  });
}

function attachFormAnalysisResult(
  session: WorkoutSession,
  result: PendingFormAnalysisResult,
): WorkoutSession {
  if (session.id !== result.sessionId) return session;
  const exercise = session.exercises[result.exerciseIndex];
  const set = exercise?.sets[result.setIndex];
  if (!exercise || !set || exercise.exerciseId !== result.analysis.exerciseId) return session;

  const exercises = [...session.exercises];
  const sets = [...exercise.sets];
  sets[result.setIndex] = {
    ...set,
    reps: set.reps ?? result.analysis.repCount,
    formAnalysis: result.analysis,
  };
  exercises[result.exerciseIndex] = { ...exercise, sets };
  return { ...session, exercises };
}

function techniqueLabel(technique: SetTechnique): string {
  switch (technique) {
    case 'drop_set':
      return 'Drop set';
    case 'rest_pause':
      return 'Rest-pause';
    case 'myo_reps':
      return 'Myo-reps';
    case 'cluster_set':
      return 'Cluster';
    case 'top_backoff':
      return 'Top + backoff';
    case 'standard':
      return 'Standard';
  }
}

function cameraAngleLabel(angle: 'front' | 'side' | 'front-45'): string {
  switch (angle) {
    case 'front':
      return 'front';
    case 'side':
      return 'side';
    case 'front-45':
      return '45°';
  }
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
