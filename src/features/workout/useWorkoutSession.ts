import { type ElementRef, useEffect, useMemo, useRef, useState } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import type { SetRowHandle } from '@/components/workout/SetRow';
import { getExercise, requireExercise } from '@/domain/exercises/catalog';
import { saveTemplate } from '@/domain/programs/templateStore';
import { buildTemplateFromSession, defaultTemplateName } from '@/domain/programs/templates';
import { detectPersonalRecords, sessionVolumeKg } from '@/domain/workouts/analytics';
import { normalizeSessionTiming } from '@/domain/workouts/history';
import { getInProgressWorkoutSession, listWorkoutHistory } from '@/domain/workouts/historyStore';
import { findLastPerformedExercise } from '@/domain/workouts/lastPerformance';
import { buildAllPersonalRecordsFromHistory } from '@/domain/workouts/historyInsights';
import { isPerSide, loadMeaning } from '@/domain/workouts/laterality';
import {
  buildSetAutofillSuggestion,
  setAutofillPatch,
  type SetAutofillSuggestion,
} from '@/domain/workouts/setAutofill';
import {
  addSet,
  completeOpenSetsWithSuggestions,
  inheritPerSide,
  kindForRir,
  prepareSetForCompletion,
  removeSet,
  setExercisePerSide,
  setExerciseSplitSides,
  swapSessionExercise,
} from '@/domain/workouts/setFlow';
import {
  beginWorkoutReview,
  continueWorkoutFromReview,
  hasSessionActivity,
  pauseWorkoutSession,
  resumeWorkoutSession,
  startWorkoutSession,
} from '@/domain/workouts/session';
import { buildLiveNotification } from '@/domain/workouts/liveNotification';
import { extendRestTimer } from '@/domain/workouts/restTimer';
import {
  completeOpenSetsForExercise,
  patchWorkoutSet,
  skipAllOpenSets,
  toggleWorkoutSetCompletion,
  toggleWorkoutSetSkipped,
  type SetCompletionResult,
} from '@/domain/workouts/sessionEditing';
import { formatTrackingTarget } from '@/domain/workouts/setTracking';
import { buildProgramProgressionTargets } from '@/domain/workouts/targetToBeat';
import {
  applyFeedbackVolume,
  feedbackComplete,
  feedbackFor,
  muscleToAskSorenessAt,
  pendingFeedbackMuscles,
  recordMuscleFeedback,
  setDeltaFromFeedback,
} from '@/domain/workouts/muscleFeedback';
import { buildWarmupSets, insertWarmupSets, isFirstForMuscle } from '@/domain/workouts/warmup';
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import type {
  MuscleGroup,
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  ReadinessCheckIn,
  TrainingPreferences,
  WorkoutSession,
} from '@/types';

import {
  countCompletedSets,
  countPlannedSets,
  countHandledSets,
  firstOpenSetIndex,
  isExerciseDone,
  isResumableSession,
} from './workout.helpers';
import { useFormAnalysisAttachment } from './useFormAnalysisAttachment';
import { useRestTimerNotification } from './useRestTimerNotification';
import { useWorkoutLiveNotification } from './useWorkoutLiveNotification';
import { exportWorkoutToHealthConnect, readWorkoutHeartRate } from '@/services/healthConnect';
import { useWorkoutAutosave } from './useWorkoutAutosave';

/**
 * Owns the live workout session's state, persistence, and every mutating
 * action — everything `workout.tsx`'s render needs but none of the
 * theme/insets/JSX concerns. Extracted from `WorkoutSessionView` (originally
 * inlined, contributing most of that component's 2,340 lines) as a pure,
 * mechanical move: every name this hook returns is consumed by the render
 * unchanged, under the same name, so this refactor changes where the logic
 * lives, not what it does.
 */
/** Resolves to null if `promise` takes longer than `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** The app accent, for the notification's tint. */
const LIVE_ACCENT = '#4D96FF';

export function useWorkoutSession(
  day: ProgramDay,
  userId: string,
  preferences: TrainingPreferences,
  /** The whole plan, so feedback-driven set increases respect each muscle's weekly ceiling. */
  programDays: ProgramDay[] = [],
) {
  const router = useRouter();
  // Read once when the session opens; set counts are decided at the start only.
  const planDaysAtStart = useRef(programDays);

  const [session, setSession] = useState(() => startWorkoutSession(day, userId));
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newRecordCount, setNewRecordCount] = useState(0);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [rirTarget, setRirTarget] = useState<{
    exerciseIndex: number;
    setIndex: number;
  } | null>(null);
  const rirSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    muscle: MuscleGroup;
    text: string;
  } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isHydratingDraft, setIsHydratingDraft] = useState(true);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showSaveIncompleteDialog, setShowSaveIncompleteDialog] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [setValidationErrors, setSetValidationErrors] = useState<Record<string, string>>({});
  const [checkInSkipped, setCheckInSkipped] = useState(false);
  const setRowRefs = useRef<Record<string, SetRowHandle | null>>({});

  const {
    autosaveState,
    setAutosaveState,
    lastAutosavedAt,
    setLastAutosavedAt,
    persistence,
    cancelPendingAutosave,
  } = useWorkoutAutosave(session, finished, isHydratingDraft);
  const { restNotificationStatus } = useRestTimerNotification(session.restTimer, isHydratingDraft);
  const { formAnalysisStatus } = useFormAnalysisAttachment(session.id, setSession);

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
          setSession((current) =>
            applyFeedbackVolume(
              inheritPerSide(current, nextHistory),
              nextHistory,
              getExercise,
              planDaysAtStart.current,
            ),
          );
          setAutosaveState('idle');
        }
      })
      .finally(() => {
        if (mounted) setIsHydratingDraft(false);
      });
    return () => {
      mounted = false;
    };
  }, [setAutosaveState, setLastAutosavedAt]);

  const activeExercise = session.exercises[activeExerciseIndex] ?? session.exercises[0];
  const isPaused = session.status === 'paused';
  const activeExerciseMeta = requireExercise(activeExercise.exerciseId);
  const activeVisionConfig = getVisionConfigForMovementPattern(activeExerciseMeta.movementPattern);
  const activePrescription = activeExercise.prescription;
  const plannedSets = countPlannedSets(session.exercises);
  const completedSets = countCompletedSets(session.exercises);
  const handledSets = countHandledSets(session.exercises);
  const remainingSets = plannedSets - handledSets;
  const isReviewing = session.reviewStartedAt != null;
  const progress = plannedSets > 0 ? completedSets / plannedSets : 0;
  const volume = sessionVolumeKg(session);
  const activeCompletedSets = activeExercise.sets.filter(
    (set) => set.completed && !set.skipped,
  ).length;
  const targetLabel = formatTrackingTarget(
    activePrescription,
    activeExerciseMeta.trackingType,
    preferences.units,
  );
  const previousPerformance = useMemo(
    () => findLastPerformedExercise(history, activeExercise.exerciseId),
    [history, activeExercise.exerciseId],
  );
  const nextOpenSetIndex = firstOpenSetIndex(activeExercise.sets);
  const formTargetSetIndex = nextOpenSetIndex ?? Math.max(0, activeExercise.sets.length - 1);
  const formTargetSet = activeExercise.sets[formTargetSetIndex];
  const openSetCount = activeExercise.sets.filter((set) => !set.completed && !set.skipped).length;
  const activeAutofillSuggestion =
    nextOpenSetIndex == null
      ? null
      : buildSetAutofillSuggestion(
          activeExercise,
          previousPerformance,
          nextOpenSetIndex,
          preferences.units,
          activeExerciseMeta.trackingType,
        );
  /** What an empty field in each open set of an exercise would be filled with. */
  function suggestionFor(
    target: WorkoutSession,
    exerciseIndex: number,
    setIndex: number,
  ): SetAutofillSuggestion | null {
    const performed = target.exercises[exerciseIndex];
    if (!performed) return null;
    return buildSetAutofillSuggestion(
      performed,
      findLastPerformedExercise(history, performed.exerciseId),
      setIndex,
      preferences.units,
      requireExercise(performed.exerciseId).trackingType,
    );
  }
  /** Warm-up ramp for an exercise, sized off its first working set's typed or suggested load. */
  function warmupsFor(target: WorkoutSession, exerciseIndex: number) {
    const performed = target.exercises[exerciseIndex];
    if (!performed || performed.sets.some((set) => set.kind === 'warmup')) return [];
    const meta = requireExercise(performed.exerciseId);
    if (meta.trackingType !== 'weight_reps' && meta.trackingType !== 'weighted_bodyweight') {
      return [];
    }
    const firstWorkingIndex = performed.sets.findIndex((set) => set.kind !== 'warmup');
    const firstWorking = performed.sets[firstWorkingIndex];
    if (!firstWorking || firstWorking.completed) return [];
    const load =
      firstWorking.loadKg ?? suggestionFor(target, exerciseIndex, firstWorkingIndex)?.loadKg;
    if (load == null) return [];
    return buildWarmupSets(load, meta, isFirstForMuscle(target, exerciseIndex, getExercise));
  }

  const activeSuggestions = activeExercise.sets.map((set, index) =>
    set.completed || set.skipped ? null : suggestionFor(session, activeExerciseIndex, index),
  );
  const activeWarmups = warmupsFor(session, activeExerciseIndex);
  // Lock-screen notification: next set, rest countdown, Log set / +30 s / Skip rest.
  const liveModel =
    !finished && !isHydratingDraft && hasSessionActivity(session)
      ? buildLiveNotification(
          session,
          activeExerciseIndex,
          (exerciseIndex, setIndex) => suggestionFor(session, exerciseIndex, setIndex),
          getExercise,
          preferences.units,
        )
      : null;
  useWorkoutLiveNotification(liveModel, LIVE_ACCENT, (action, model) => {
    if (action === 'log_set' && model.target) {
      toggleComplete(model.target.exerciseIndex, model.target.setIndex);
    } else if (action === 'extend_rest') {
      setSession((prev) => ({
        ...prev,
        restTimer: prev.restTimer ? extendRestTimer(prev.restTimer, 30) : null,
      }));
    } else if (action === 'skip_rest') {
      setSession((prev) => ({ ...prev, restTimer: null }));
    }
  });

  const pendingFeedback = pendingFeedbackMuscles(session, getExercise);
  const sorenessCandidate = muscleToAskSorenessAt(
    session,
    activeExerciseIndex,
    history,
    getExercise,
  );
  const sorenessMuscle =
    sorenessCandidate &&
    feedbackFor(session, sorenessCandidate)?.soreness == null &&
    !feedbackFor(session, sorenessCandidate)?.skipped &&
    activeExercise.sets.some((set) => !set.completed && !set.skipped)
      ? sorenessCandidate
      : null;
  const activePerSide = isPerSide(activeExercise);
  const activeLoadMeaning = loadMeaning(activeExerciseMeta, activePerSide);

  const progressionTargets = useMemo(
    () =>
      buildProgramProgressionTargets({
        prescriptions: session.exercises.map((exercise) => exercise.prescription),
        history,
        userExperience: preferences.experience,
        nutritionContext: preferences.nutritionContext,
      }),
    [history, preferences.experience, preferences.nutritionContext, session.exercises],
  );
  const activeProgressionTarget = progressionTargets.get(activeExercise.exerciseId) ?? null;

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<PerformedSet>) {
    const setId = session.exercises[exerciseIndex]?.sets[setIndex]?.id;
    if (setId && setValidationErrors[setId]) {
      setSetValidationErrors((current) => {
        const next = { ...current };
        delete next[setId];
        return next;
      });
    }
    setSession((prev) => patchWorkoutSet(prev, exerciseIndex, setIndex, patch));
  }

  function openRirPicker(exerciseIndex: number, setIndex: number) {
    if (isPaused) return;
    setRirTarget({ exerciseIndex, setIndex });
    rirSheetRef.current?.present();
  }

  function saveReadiness(readiness: ReadinessCheckIn) {
    setSession((prev) => ({ ...prev, readiness }));
    setCheckInSkipped(false);
    setAutosaveState('saving');
  }

  function confirmRir(value: number) {
    if (isPaused) return;
    if (rirTarget != null) {
      const target = session.exercises[rirTarget.exerciseIndex]?.sets[rirTarget.setIndex];
      updateSet(rirTarget.exerciseIndex, rirTarget.setIndex, {
        rir: value,
        ...(target ? { kind: kindForRir(target, value) } : {}),
      });
      Haptics.selectionAsync();
    }
    rirSheetRef.current?.dismiss();
  }

  function clearRir() {
    if (isPaused) return;
    if (rirTarget != null) updateSet(rirTarget.exerciseIndex, rirTarget.setIndex, { rir: null });
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

  function copySetToRemaining(exerciseIndex: number, setIndex: number) {
    if (isPaused) return;
    setSession((prev) => {
      const exercise = prev.exercises[exerciseIndex];
      const source = exercise?.sets[setIndex];
      if (!exercise || !source) return prev;
      const exercises = [...prev.exercises];
      exercises[exerciseIndex] = {
        ...exercise,
        sets: exercise.sets.map((set, index) =>
          index > setIndex && !set.completed && !set.skipped
            ? {
                ...set,
                loadKg: source.loadKg,
                reps: source.reps,
                rir: source.rir,
                durationSeconds: source.durationSeconds,
              }
            : set,
        ),
      };
      return { ...prev, exercises };
    });
    void Haptics.selectionAsync();
  }

  function toggleSetSkipped(exerciseIndex: number, setIndex: number) {
    setSession((prev) => toggleWorkoutSetSkipped(prev, exerciseIndex, setIndex));
    void Haptics.selectionAsync();
  }

  function fillNextSet() {
    if (isPaused) return;
    if (nextOpenSetIndex == null || activeAutofillSuggestion == null) return;
    Haptics.selectionAsync();
    updateSet(activeExerciseIndex, nextOpenSetIndex, setAutofillPatch(activeAutofillSuggestion));
  }

  function fillOpenSetsForExercise(exerciseIndex: number) {
    fillOpenSetsForExercises([exerciseIndex]);
  }

  function fillAllOpenSets() {
    fillOpenSetsForExercises(session.exercises.map((_, index) => index));
  }

  function fillOpenSetsForExercises(exerciseIndices: number[]) {
    if (isPaused) return;
    const exerciseIndexSet = new Set(exerciseIndices);
    const filledSetIds = new Set(
      session.exercises
        .filter((_, index) => exerciseIndexSet.has(index))
        .flatMap((exercise) => exercise.sets)
        .filter((set) => !set.completed && !set.skipped)
        .map((set) => set.id),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSession((prev) => {
      const exercises = [...prev.exercises];
      for (const exerciseIndex of exerciseIndices) {
        const exercise = exercises[exerciseIndex];
        if (!exercise || exercise.sets.every((set) => set.completed || set.skipped)) continue;
        const previous = findLastPerformedExercise(history, exercise.exerciseId);
        const nextExercise: PerformedExercise = { ...exercise, sets: [...exercise.sets] };

        nextExercise.sets = nextExercise.sets.map((set, index) => {
          if (set.completed || set.skipped) return set;
          const suggestion = buildSetAutofillSuggestion(
            nextExercise,
            previous,
            index,
            preferences.units,
            requireExercise(nextExercise.exerciseId).trackingType,
          );
          return { ...set, ...setAutofillPatch(suggestion) };
        });

        exercises[exerciseIndex] = nextExercise;
      }
      return { ...prev, exercises };
    });
    setSetValidationErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([setId]) => !filledSetIds.has(setId))),
    );
  }

  function fillOpenSets() {
    if (openSetCount === 0) return;
    fillOpenSetsForExercise(activeExerciseIndex);
  }

  function toggleComplete(exerciseIndex: number, setIndex: number): SetCompletionResult | null {
    if (isPaused) return null;
    const exercise = session.exercises[exerciseIndex];
    if (!exercise) return null;
    const trackingType = requireExercise(exercise.exerciseId).trackingType;
    const target = exercise.sets[setIndex];
    const prepared =
      target && !target.completed
        ? patchWorkoutSet(
            session,
            exerciseIndex,
            setIndex,
            prepareSetForCompletion(
              target,
              suggestionFor(session, exerciseIndex, setIndex),
              exercise.prescription.targetRir,
              exercise.splitSides === true,
            ),
          )
        : session;
    const result = toggleWorkoutSetCompletion(
      prepared,
      exerciseIndex,
      setIndex,
      trackingType,
      new Date(),
      {
        startRestTimer: !isReviewing,
      },
    );
    if (!result.ok) {
      if (result.reason === 'invalid_set') {
        setSetValidationErrors((current) => ({ ...current, [result.setId]: result.message }));
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return result;
    }
    setSession(result.session);
    if (result.completed) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isReviewing && result.navigation.nextExerciseIndex != null) {
      setActiveExerciseIndex(result.navigation.nextExerciseIndex);
    }
    return result;
  }

  function completeAndFocusNext(exerciseIndex: number, setIndex: number) {
    const result = toggleComplete(exerciseIndex, setIndex);
    if (!result?.ok || !result.completed) return;

    const nextExerciseIndex = result.navigation.nextExerciseIndex ?? exerciseIndex;
    const nextExercise = result.session.exercises[nextExerciseIndex];
    const nextSet = nextExercise?.sets.find(
      (candidate) => !candidate.completed && !candidate.skipped,
    );
    if (!nextSet) return;
    setTimeout(() => setRowRefs.current[nextSet.id]?.focusPrimaryInput(), 0);
  }

  function completeExerciseOpenSets(exerciseIndex: number) {
    const performed = session.exercises[exerciseIndex];
    if (!performed) return;
    const trackingType = requireExercise(performed.exerciseId).trackingType;
    const result = completeOpenSetsForExercise(session, exerciseIndex, trackingType);

    if (!result.ok) {
      if (result.reason === 'invalid_sets') {
        setSetValidationErrors((current) => ({ ...current, ...result.errors }));
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const completedIds = new Set(performed.sets.map((set) => set.id));
    setSetValidationErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([setId]) => !completedIds.has(setId))),
    );
    setSession(result.session);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /**
   * "Next exercise" also logs what is on screen: every open set with typed or
   * suggested numbers is ticked, so finishing an exercise takes one tap.
   */
  function goToNextExercise() {
    if (isPaused || isSaving) return;
    const performed = session.exercises[activeExerciseIndex];
    if (!performed) return;
    const result = completeOpenSetsWithSuggestions(
      session,
      activeExerciseIndex,
      performed.sets.map((_, index) => suggestionFor(session, activeExerciseIndex, index)),
      requireExercise(performed.exerciseId).trackingType,
    );
    const isLast = activeExerciseIndex >= session.exercises.length - 1;
    if (result.completedCount > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (isLast) {
      // On the last exercise the same button finishes the workout.
      setSession(beginWorkoutReview(result.session));
      setSaveError(null);
      setAutosaveState('saving');
      return;
    }
    setSession(result.session);
    setActiveExerciseIndex(activeExerciseIndex + 1);
  }

  /** Records ratings for a muscle; once the after-exercise trio is in, says what changes next time. */
  function rateMuscle(muscle: MuscleGroup, patch: Parameters<typeof recordMuscleFeedback>[2]) {
    const next = recordMuscleFeedback(session, muscle, patch);
    setSession((prev) => recordMuscleFeedback(prev, muscle, patch));
    void Haptics.selectionAsync();
    const feedback = feedbackFor(next, muscle);
    if (!patch.skipped && feedbackComplete(feedback) && feedback) {
      const decision = setDeltaFromFeedback(feedback);
      const verdict =
        decision.delta > 0
          ? 'One more set next time.'
          : decision.delta < 0
            ? 'One set less next time.'
            : 'Same sets next time.';
      setFeedbackResult({ muscle, text: `${verdict} ${decision.reason}` });
      setTimeout(
        () => setFeedbackResult((current) => (current?.muscle === muscle ? null : current)),
        8000,
      );
    }
  }

  function addWarmups(exerciseIndex: number) {
    const warmups = warmupsFor(session, exerciseIndex);
    if (warmups.length === 0) return;
    setSession((prev) => insertWarmupSets(prev, exerciseIndex, warmups));
    void Haptics.selectionAsync();
  }

  function addSetToExercise(exerciseIndex: number) {
    setSession((prev) => addSet(prev, exerciseIndex));
    void Haptics.selectionAsync();
  }

  function removeSetFromExercise(exerciseIndex: number, setIndex: number) {
    setSession((prev) => removeSet(prev, exerciseIndex, setIndex));
    void Haptics.selectionAsync();
  }

  function toggleSplitSides(exerciseIndex: number) {
    const performed = session.exercises[exerciseIndex];
    if (!performed) return;
    setSession((prev) => setExerciseSplitSides(prev, exerciseIndex, !performed.splitSides));
    void Haptics.selectionAsync();
  }

  function togglePerSide(exerciseIndex: number) {
    const performed = session.exercises[exerciseIndex];
    if (!performed) return;
    setSession((prev) => setExercisePerSide(prev, exerciseIndex, !isPerSide(performed)));
    void Haptics.selectionAsync();
  }

  function swapExercise(exerciseIndex: number, nextExerciseId: string) {
    setSession((prev) => swapSessionExercise(prev, exerciseIndex, nextExerciseId));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    void Haptics.selectionAsync();
    setSession((prev) => pauseWorkoutSession(prev));
    setAutosaveState('saving');
  }

  function resumeSession() {
    if (!isPaused) return;
    void Haptics.selectionAsync();
    setSession((prev) => resumeWorkoutSession(prev));
    setAutosaveState('saving');
  }

  function endLiveWorkout() {
    if (isPaused || isSaving) return;
    setSession((prev) => beginWorkoutReview(prev));
    setSaveError(null);
    setAutosaveState('saving');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function continueLiveWorkout() {
    setSession((prev) => continueWorkoutFromReview(prev));
    setSaveError(null);
    setAutosaveState('saving');
  }

  async function discardSession() {
    if (isDiscarding) return;
    setIsDiscarding(true);
    cancelPendingAutosave();
    try {
      await persistence.discard(session.id);
      setSession((prev) => ({
        ...prev,
        status: 'discarded',
        pausedAt: null,
        restTimer: null,
      }));
      setShowDiscardDialog(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.replace('/');
    } finally {
      setIsDiscarding(false);
    }
  }

  async function saveCompletedSession(candidate: WorkoutSession) {
    const candidateCompletedSets = countCompletedSets(candidate.exercises);
    if (isSaving || candidateCompletedSets === 0) return;
    cancelPendingAutosave();
    setIsSaving(true);
    setSaveError(null);
    setAutosaveState('saving');
    setSession(candidate);

    const finishedAt = candidate.reviewStartedAt ?? new Date().toISOString();
    // Heart rate from a watch, if Health Connect is connected. Never waits long.
    const heartRate = await withTimeout(
      readWorkoutHeartRate(normalizeSessionTiming(candidate).startedAt, finishedAt),
      3000,
    );
    const completedSession: WorkoutSession = {
      ...candidate,
      status: 'completed',
      finishedAt,
      reviewStartedAt: null,
      pausedAt: null,
      restTimer: null,
      ...(heartRate ? { heartRate } : {}),
    };

    try {
      const saved = await persistence.finish(completedSession);
      void exportWorkoutToHealthConnect(saved);
      const existingRecords = buildAllPersonalRecordsFromHistory(
        history.filter((item) => item.id !== saved.id),
      );
      const records = detectPersonalRecords(saved, existingRecords, getExercise);
      setSession(saved);
      setHistory((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setNewRecordCount(records.length);
      setAutosaveState('saved');
      setLastAutosavedAt(new Date().toISOString());
      if (records.length > 0) setShowCelebration(true);
      setFinished(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      try {
        await persistence.saveDraft(candidate);
        setLastAutosavedAt(new Date().toISOString());
      } catch {
        // The in-memory session remains editable even if the DB is still unavailable.
      }
      setAutosaveState('error');
      setSaveError('Saving failed. Your workout is still open — retry to finish safely.');
    } finally {
      setIsSaving(false);
    }
  }

  function saveIncompleteSession() {
    const candidate = skipAllOpenSets(session);
    setShowSaveIncompleteDialog(false);
    void saveCompletedSession(candidate);
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

  return {
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
    handledSets,
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
    activeSuggestions,
    activePerSide,
    activeLoadMeaning,
    goToNextExercise,
    addSetToExercise,
    addWarmups,
    activeWarmups,
    pendingFeedback,
    sorenessMuscle,
    rateMuscle,
    feedbackResult,
    setFeedbackResult,
    removeSetFromExercise,
    togglePerSide,
    toggleSplitSides,
    activeSplitSides: activePerSide && activeExercise.splitSides === true,
    swapExercise,
    progressionTargets,
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
    fillOpenSetsForExercises,
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
  };
}
