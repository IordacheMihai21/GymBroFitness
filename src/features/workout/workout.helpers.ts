import { getExercise } from '@/domain/exercises/catalog';
import { buildManualPrescription, recalculateProgramDay } from '@/domain/programs/programEditing';
import type { PendingFormAnalysisResult } from '@/domain/vision/formAnalysisResultStore';
import type { SetAutofillSuggestion } from '@/domain/workouts/setAutofill';
import type {
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  SetTechnique,
  TrainingPreferences,
  Units,
  WorkoutSession,
} from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

export type AutosaveState = 'idle' | 'restored' | 'saving' | 'saved' | 'error';

/** Working sets only: warm-ups are preparation, not part of the session's set count. */
export function countPlannedSets(exercises: PerformedExercise[]): number {
  return exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.kind !== 'warmup').length,
    0,
  );
}

export function countCompletedSets(exercises: PerformedExercise[]): number {
  return exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.filter((set) => set.kind !== 'warmup' && set.completed && !set.skipped).length,
    0,
  );
}

export function countHandledSets(exercises: PerformedExercise[]): number {
  return exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.filter((set) => set.kind !== 'warmup' && (set.completed || set.skipped)).length,
    0,
  );
}

export function isExerciseDone(exercise: PerformedExercise): boolean {
  return exercise.sets.every((set) => set.completed || set.skipped);
}

export function isResumableSession(session: WorkoutSession): boolean {
  return session.status === 'in_progress' || session.status === 'paused';
}

export function firstOpenSetIndex(sets: PerformedSet[]): number | null {
  const index = sets.findIndex((set) => !set.completed && !set.skipped);
  return index === -1 ? null : index;
}

export function shortExerciseName(name: string): string {
  return name
    .replace(/^Barbell /, '')
    .replace(/^Dumbbell /, 'DB ')
    .replace('Romanian Deadlift', 'RDL');
}

export function formatRest(seconds: number): string {
  if (seconds <= 0) return 'done';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, '0')}`;
}

export function autosaveLabel(state: AutosaveState, savedAt: string | null): string {
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

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function compactSuggestionValue(suggestion: SetAutofillSuggestion, units: Units): string {
  if (suggestion.durationSeconds != null) return `${suggestion.durationSeconds}s`;
  if (suggestion.loadKg != null && suggestion.reps != null) {
    return `${displayLoad(suggestion.loadKg, units)} ${unitLabel(units)} × ${suggestion.reps}`;
  }
  if (suggestion.reps != null) return `${suggestion.reps} reps`;
  return 'target';
}

export function sourceLabel(source: SetAutofillSuggestion['source']): string {
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

export function buildCustomWorkoutDay({
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

export function attachFormAnalysisResult(
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

export function techniqueLabel(technique: SetTechnique): string {
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

export function cameraAngleLabel(angle: 'front' | 'side' | 'front-45'): string {
  switch (angle) {
    case 'front':
      return 'front';
    case 'side':
      return 'side';
    case 'front-45':
      return '45°';
  }
}
