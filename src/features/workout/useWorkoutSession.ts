import { type ElementRef, useEffect, useMemo, useRef, useState } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import type { SetRowHandle } from '@/components/workout/SetRow';
import { getExercise, requireExercise } from '@/domain/exercises/catalog';
import { saveTemplate } from '@/domain/programs/templateStore';
import { buildTemplateFromSession, defaultTemplateName } from '@/domain/programs/templates';
import { detectPersonalRecords, sessionVolumeKg } from '@/domain/workouts/analytics';
import { getInProgressWorkoutSession, listWorkoutHistory } from '@/domain/workouts/historyStore';
import { findLastPerformedExercise } from '@/domain/workouts/lastPerformance';
import { buildAllPersonalRecordsFromHistory } from '@/domain/workouts/historyInsights';
import { buildSetAutofillSuggestion, setAutofillPatch } from '@/domain/workouts/setAutofill';
import {
  beginWorkoutReview,
  continueWorkoutFromReview,
  pauseWorkoutSession,
  resumeWorkoutSession,
  startWorkoutSession,
} from '@/domain/workouts/session';
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
import { getVisionConfigForMovementPattern } from '@/domain/vision/exerciseVisionConfigs';
import type {
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  ReadinessCheckIn,
  TrainingPreferences,
  WorkoutSession,
} from '@/types';

import {
  countCompletedSets,
  countHandledSets,
  firstOpenSetIndex,
  isExerciseDone,
  isResumableSession,
} from './workout.helpers';
import { useFormAnalysisAttachment } from './useFormAnalysisAttachment';
import { useRestTimerNotification } from './useRestTimerNotification';
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
export function useWorkoutSession(
  day: ProgramDay,
  userId: string,
  preferences: TrainingPreferences,
) {
  const router = useRouter();

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
  const plannedSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
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
      updateSet(rirTarget.exerciseIndex, rirTarget.setIndex, { rir: value });
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
    const result = toggleWorkoutSetCompletion(
      session,
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

    const completedSession: WorkoutSession = {
      ...candidate,
      status: 'completed',
      finishedAt: candidate.reviewStartedAt ?? new Date().toISOString(),
      reviewStartedAt: null,
      pausedAt: null,
      restTimer: null,
    };

    try {
      const saved = await persistence.finish(completedSession);
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
