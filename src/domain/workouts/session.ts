import type {
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  SetTechnique,
  WorkoutSession,
} from '@/types';
import { uuid } from '@/utils/ids';

function buildEmptySets(count: number, technique: SetTechnique = 'standard'): PerformedSet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    setNumber: i + 1,
    kind: 'working',
    loadKg: null,
    reps: null,
    durationSeconds: null,
    rir: null,
    completed: false,
    skipped: false,
    completedAt: null,
    technique,
    subEfforts: [],
  }));
}

export function startWorkoutSession(day: ProgramDay, userId: string): WorkoutSession {
  const exercises: PerformedExercise[] = day.prescriptions.map((prescription, i) => ({
    id: uuid(),
    exerciseId: prescription.exerciseId,
    order: i,
    prescription,
    sets: buildEmptySets(prescription.workingSets, prescription.setTechnique ?? 'standard'),
    markedDiscomfort: false,
    markedUnavailable: false,
  }));

  return {
    id: uuid(),
    userId,
    programId: null,
    programDayId: day.id,
    dayName: day.name,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises,
    totalPausedSeconds: 0,
    pausedAt: null,
    restTimer: null,
  };
}

export function pauseWorkoutSession(session: WorkoutSession, now = new Date()): WorkoutSession {
  if (session.status === 'paused') return session;
  return {
    ...session,
    status: 'paused',
    pausedAt: now.toISOString(),
    restTimer: null,
  };
}

export function resumeWorkoutSession(session: WorkoutSession, now = new Date()): WorkoutSession {
  if (session.status !== 'paused') return session;
  const pausedAtMs = session.pausedAt ? Date.parse(session.pausedAt) : Number.NaN;
  const addedSeconds = Number.isFinite(pausedAtMs)
    ? Math.max(0, (now.getTime() - pausedAtMs) / 1000)
    : 0;
  return {
    ...session,
    status: 'in_progress',
    pausedAt: null,
    totalPausedSeconds: session.totalPausedSeconds + addedSeconds,
  };
}
