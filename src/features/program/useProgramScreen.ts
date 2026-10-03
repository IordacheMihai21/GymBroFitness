import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  moveProgramPrescription,
  renameProgram,
  renameProgramDay,
  updateProgramPrescription,
} from '@/domain/programs/programEditing';
import { buildProgramProgressionSummary } from '@/domain/programs/programProgression';
import { listTemplates, saveTemplate } from '@/domain/programs/templateStore';
import {
  buildTemplateFromProgramDay,
  defaultProgramDayTemplateName,
  type WorkoutTemplate,
} from '@/domain/programs/templates';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import type { ExercisePrescription, TrainingProgram, WorkoutSession } from '@/types';

import {
  buildBodyData,
  buildSwapOptions,
  computeProgramMuscleLoads,
  summarizeDay,
  type SwapTarget,
} from './program.helpers';
import type { RankedReplacement } from '@/domain/exercises/replacement';

/**
 * Owns the Plan screen's state, persistence, and every mutating action —
 * same extraction pattern and same rationale as workout.tsx's
 * useWorkoutSession: every name this hook returns is consumed by the render
 * unchanged, under the same name, so this changes where the logic lives, not
 * what it does.
 */
export function useProgramScreen() {
  const router = useRouter();
  const { preferences, program, source, saveProgram, resetProgram } = useActiveProgram();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [swapTarget, setSwapTarget] = useState<SwapTarget>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const selectedDay = program.days[selectedDayIndex] ?? program.days[0];
  const dayStats = useMemo(() => summarizeDay(selectedDay), [selectedDay]);
  const muscleLoads = useMemo(() => computeProgramMuscleLoads(program.days), [program.days]);
  const bodyData = useMemo(() => buildBodyData(muscleLoads), [muscleLoads]);
  const progressionSummary = useMemo(
    () =>
      buildProgramProgressionSummary({
        days: program.days,
        history,
        userExperience: preferences.experience,
        nutritionContext: preferences.nutritionContext,
        priorityMuscles: preferences.musclePriorities,
        units: preferences.units,
      }),
    [
      history,
      preferences.experience,
      preferences.musclePriorities,
      preferences.nutritionContext,
      preferences.units,
      program.days,
    ],
  );
  const swapOptions = useMemo(
    () => buildSwapOptions(program, selectedDayIndex, swapTarget, preferences),
    [preferences, program, selectedDayIndex, swapTarget],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([listTemplates(), listWorkoutHistory()]).then(([nextTemplates, nextHistory]) => {
        if (!mounted) return;
        setTemplates(nextTemplates);
        setHistory(nextHistory);
      });
      return () => {
        mounted = false;
      };
    }, []),
  );

  function startDay(index = selectedDayIndex) {
    router.push({ pathname: '/workout', params: { day: String(index) } });
  }

  function editDay(index = selectedDayIndex) {
    router.push({ pathname: '/program-day/[day]', params: { day: String(index) } });
  }

  function startTemplate(templateId: string) {
    router.push({ pathname: '/workout', params: { templateId } });
  }

  async function persistProgram(nextProgram: TrainingProgram, message: string) {
    setSaving(true);
    setStatus(null);
    try {
      await saveProgram(nextProgram);
      setStatus(message);
    } catch {
      setStatus('Could not save program changes.');
    } finally {
      setSaving(false);
    }
  }

  function patchPrescription(prescriptionIndex: number, patch: Partial<ExercisePrescription>) {
    const nextProgram = updateProgramPrescription(
      program,
      selectedDayIndex,
      prescriptionIndex,
      patch,
    );
    persistProgram(nextProgram, 'Program saved.');
  }

  function renameActiveProgram(name: string) {
    return persistProgram(renameProgram(program, name), 'Program name saved.');
  }

  function renameSelectedDay(name: string) {
    return persistProgram(renameProgramDay(program, selectedDayIndex, name), 'Day name saved.');
  }

  async function renameSavedTemplate(templateId: string, name: string) {
    const trimmedName = name.trim();
    const template = templates.find((item) => item.id === templateId);
    if (!template || !trimmedName) return;

    setSaving(true);
    setStatus(null);
    try {
      const saved = await saveTemplate({
        ...template,
        name: trimmedName,
        day: { ...template.day, name: trimmedName },
      });
      setTemplates((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setStatus('Workout name saved.');
    } catch {
      setStatus('Could not rename this workout.');
    } finally {
      setSaving(false);
    }
  }

  function movePrescription(prescriptionIndex: number, direction: -1 | 1) {
    const nextProgram = moveProgramPrescription(
      program,
      selectedDayIndex,
      prescriptionIndex,
      prescriptionIndex + direction,
    );
    persistProgram(nextProgram, 'Exercise order saved.');
  }

  function replacePrescription(option: RankedReplacement) {
    if (!swapTarget) return;
    const nextProgram = updateProgramPrescription(
      program,
      swapTarget.dayIndex,
      swapTarget.prescriptionIndex,
      {
        exerciseId: option.exercise.id,
        selectionReason: option.rationale,
      },
    );
    setSwapTarget(null);
    persistProgram(nextProgram, `Swapped to ${option.exercise.name}.`);
  }

  async function resetGeneratedProgram() {
    setResetDialogOpen(false);
    setSaving(true);
    setStatus(null);
    try {
      await resetProgram();
      setSelectedDayIndex(0);
      setSwapTarget(null);
      setStatus('Generated plan restored.');
    } catch {
      setStatus('Could not reset program.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedDayAsTemplate() {
    if (!selectedDay) return;
    setSaving(true);
    setStatus(null);
    try {
      const template = await saveTemplate(
        buildTemplateFromProgramDay(selectedDay, defaultProgramDayTemplateName(selectedDay.name)),
      );
      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
      setStatus(`${template.name} saved as template.`);
    } catch {
      setStatus('Could not save day as template.');
    } finally {
      setSaving(false);
    }
  }

  return {
    preferences,
    program,
    source,
    selectedDayIndex,
    setSelectedDayIndex,
    templates,
    history,
    swapTarget,
    setSwapTarget,
    saving,
    status,
    planMenuOpen,
    setPlanMenuOpen,
    resetDialogOpen,
    setResetDialogOpen,
    selectedDay,
    dayStats,
    muscleLoads,
    bodyData,
    progressionSummary,
    swapOptions,
    startDay,
    editDay,
    startTemplate,
    renameActiveProgram,
    renameSelectedDay,
    renameSavedTemplate,
    patchPrescription,
    movePrescription,
    replacePrescription,
    resetGeneratedProgram,
    saveSelectedDayAsTemplate,
  };
}
