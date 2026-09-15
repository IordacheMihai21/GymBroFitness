import { requireExercise } from '@/domain/exercises/catalog';
import { sessionDurationMinutes } from '@/domain/workouts/history';
import { uuid } from '@/utils/ids';
import type { MuscleGroup, ProgramDay, WorkoutSession } from '@/types';

export type WorkoutTemplate = {
  id: string;
  name: string;
  createdAt: string;
  /** The session this was captured from, for provenance only — not required to replay it. */
  sourceSessionId: string;
  /** Ready to hand to `startWorkoutSession` directly. */
  day: ProgramDay;
};

/**
 * Turn a completed session into a reusable, replayable day. Each exercise's
 * `PerformedExercise.prescription` already holds the exact sets/reps/RIR/rest
 * that were run, so the template is just those prescriptions in order — no
 * need to recompute anything the way the auto-generator would.
 */
export function buildTemplateFromSession(session: WorkoutSession, name: string): WorkoutTemplate {
  const trained = session.exercises.filter((ex) => ex.sets.some((s) => s.completed && !s.skipped));
  const source = trained.length > 0 ? trained : session.exercises;

  const prescriptions = [...source].sort((a, b) => a.order - b.order).map((ex) => ex.prescription);

  const focus = dedupePrimaryMuscles(source.map((ex) => ex.exerciseId));

  const day: ProgramDay = {
    id: uuid(),
    name,
    order: 0,
    focus,
    prescriptions,
    estimatedMinutes:
      sessionDurationMinutes(session) || estimateMinutesFromPrescriptions(prescriptions.length),
  };

  return {
    id: uuid(),
    name,
    createdAt: new Date().toISOString(),
    sourceSessionId: session.id,
    day,
  };
}

export function buildTemplateFromProgramDay(
  day: ProgramDay,
  name: string,
  now = new Date(),
): WorkoutTemplate {
  const prescriptions = [...day.prescriptions]
    .sort((a, b) => a.order - b.order)
    .map((prescription, index) => ({ ...prescription, order: index }));

  return {
    id: uuid(),
    name,
    createdAt: now.toISOString(),
    sourceSessionId: `program-day:${day.id}`,
    day: {
      ...day,
      id: uuid(),
      name,
      order: 0,
      focus: dedupePrimaryMuscles(prescriptions.map((prescription) => prescription.exerciseId)),
      prescriptions,
    },
  };
}

function dedupePrimaryMuscles(exerciseIds: string[]): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  for (const id of exerciseIds) {
    for (const muscle of requireExercise(id).primaryMuscles) {
      seen.add(muscle);
    }
  }
  return [...seen];
}

/** Fallback when the source session has no measurable duration (e.g. instantly saved). */
function estimateMinutesFromPrescriptions(exerciseCount: number): number {
  return Math.max(20, exerciseCount * 12);
}

/** A sensible default name: "Upper A template · Sep 14". */
export function defaultTemplateName(dayName: string, now = new Date()): string {
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(now);
  return `${dayName} template · ${date}`;
}

export function defaultProgramDayTemplateName(dayName: string, now = new Date()): string {
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(now);
  return `${dayName} plan · ${date}`;
}
