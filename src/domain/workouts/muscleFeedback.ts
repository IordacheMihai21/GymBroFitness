import { PROGRESSION_CONSTRAINTS as C } from '@/domain/progression/constraints';
import type {
  Exercise,
  MuscleFeedback,
  MuscleGroup,
  PerformedExercise,
  PerformedSet,
  ProgramDay,
  VolumeAdjustment,
  WorkoutSession,
} from '@/types';
import { uuid } from '@/utils/ids';

import { VOLUME_LANDMARKS } from './volumeLandmarks';

/**
 * Feedback-driven set progression, in the style of RP Hypertrophy.
 *
 * During a session the lifter rates each trained muscle: how it recovered
 * since last time (asked at its first exercise) and, after its last exercise,
 * the pump, how hard the work felt, and any joint discomfort. The next session
 * that trains the muscle opens with one set more, the same, or one set less.
 * Changes accumulate week to week, so volume climbs from the plan toward the
 * recoverable ceiling (MRV) for as long as the muscle keeps recovering, and
 * backs off when it does not. A break of two weeks or more starts again from
 * the plan.
 */

const FEEDBACK_FRESH_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SetDelta = { delta: -1 | 0 | 1; reason: string };

/** The decision for one muscle from one session's ratings. */
export function setDeltaFromFeedback(feedback: MuscleFeedback): SetDelta {
  const { soreness, pump, workload, joints } = feedback;
  if (feedback.skipped) return { delta: 0, reason: 'No feedback, so sets stay the same.' };
  if (joints === 'a_lot') {
    return { delta: -1, reason: 'Joints hurt a lot, so one set comes off. Consider a swap.' };
  }
  if (workload === 'too_much') {
    return { delta: -1, reason: 'The work was too much, so one set comes off to recover.' };
  }
  if (soreness === 'still_sore') {
    return workload === 'hard'
      ? { delta: -1, reason: 'Still sore and the sets felt hard, so one set comes off.' }
      : { delta: 0, reason: 'Still sore when you trained it again, so sets stay the same.' };
  }
  if (joints === 'some') {
    return { delta: 0, reason: 'Some joint discomfort, so sets stay the same.' };
  }
  if (soreness === 'recovered_on_time') {
    return { delta: 0, reason: 'It recovered just in time, so this volume is about right.' };
  }
  if (workload === 'hard') {
    return { delta: 0, reason: 'Hard but manageable, so sets stay the same.' };
  }
  if (workload === 'just_right' && pump === 'great') {
    return { delta: 0, reason: 'Great pump at a fair workload, so sets stay the same.' };
  }
  if (workload === 'easy' || workload === 'just_right') {
    return {
      delta: 1,
      reason:
        workload === 'easy'
          ? 'It recovered and the work felt easy, so one set is added.'
          : 'It recovered with room to spare, so one set is added.',
    };
  }
  return { delta: 0, reason: 'Not enough feedback yet, so sets stay the same.' };
}

/** The muscle an exercise is progressed for: its first primary muscle. */
function mainMuscle(exerciseId: string, lookup: (id: string) => Exercise | undefined) {
  return lookup(exerciseId)?.primaryMuscles[0] ?? null;
}

function sessionTime(session: WorkoutSession): number {
  return new Date(session.finishedAt ?? session.startedAt).getTime();
}

function completedSessions(history: WorkoutSession[]): WorkoutSession[] {
  return history
    .filter((session) => session.status === 'completed')
    .sort((a, b) => sessionTime(b) - sessionTime(a));
}

/** Muscles whose last exercise in this session is `exerciseIndex`. */
export function musclesEndingAt(
  session: WorkoutSession,
  exerciseIndex: number,
  lookup: (id: string) => Exercise | undefined,
): MuscleGroup[] {
  const muscle = mainMuscle(session.exercises[exerciseIndex]?.exerciseId ?? '', lookup);
  if (!muscle) return [];
  const later = session.exercises
    .slice(exerciseIndex + 1)
    .some((performed) => mainMuscle(performed.exerciseId, lookup) === muscle);
  return later ? [] : [muscle];
}

/** The muscle first trained at `exerciseIndex`, if it was trained in the last two weeks. */
export function muscleToAskSorenessAt(
  session: WorkoutSession,
  exerciseIndex: number,
  history: WorkoutSession[],
  lookup: (id: string) => Exercise | undefined,
  now = new Date(),
): MuscleGroup | null {
  const muscle = mainMuscle(session.exercises[exerciseIndex]?.exerciseId ?? '', lookup);
  if (!muscle) return null;
  const earlier = session.exercises
    .slice(0, exerciseIndex)
    .some((performed) => mainMuscle(performed.exerciseId, lookup) === muscle);
  if (earlier) return null;
  const trainedRecently = completedSessions(history).some(
    (past) =>
      now.getTime() - sessionTime(past) < FEEDBACK_FRESH_DAYS * DAY_MS &&
      past.exercises.some(
        (performed) =>
          mainMuscle(performed.exerciseId, lookup) === muscle &&
          performed.sets.some((set) => set.completed && set.kind !== 'warmup'),
      ),
  );
  return trainedRecently ? muscle : null;
}

export function feedbackFor(
  session: WorkoutSession,
  muscle: MuscleGroup,
): MuscleFeedback | undefined {
  return session.muscleFeedback?.find((item) => item.muscle === muscle);
}

/** Merges ratings for one muscle into the session. */
export function recordMuscleFeedback(
  session: WorkoutSession,
  muscle: MuscleGroup,
  patch: Partial<Omit<MuscleFeedback, 'muscle' | 'recordedAt'>>,
  now = new Date(),
): WorkoutSession {
  const existing = feedbackFor(session, muscle);
  const next: MuscleFeedback = {
    ...existing,
    ...patch,
    muscle,
    recordedAt: now.toISOString(),
  };
  const others = (session.muscleFeedback ?? []).filter((item) => item.muscle !== muscle);
  return { ...session, muscleFeedback: [...others, next] };
}

/** True once the after-exercise questions for this muscle are answered or skipped. */
export function feedbackComplete(feedback: MuscleFeedback | undefined): boolean {
  if (!feedback) return false;
  if (feedback.skipped) return true;
  return feedback.pump != null && feedback.workload != null && feedback.joints != null;
}

/**
 * Muscles finished in this session that still need their after-exercise
 * ratings, in the order they were trained.
 */
export function pendingFeedbackMuscles(
  session: WorkoutSession,
  lookup: (id: string) => Exercise | undefined,
): MuscleGroup[] {
  const pending: MuscleGroup[] = [];
  session.exercises.forEach((performed, index) => {
    const done =
      performed.sets.some((set) => set.completed && set.kind !== 'warmup') &&
      performed.sets.every((set) => set.completed || set.skipped);
    if (!done) return;
    for (const muscle of musclesEndingAt(session, index, lookup)) {
      if (!feedbackComplete(feedbackFor(session, muscle)) && !pending.includes(muscle)) {
        pending.push(muscle);
      }
    }
  });
  return pending;
}

function blankSet(exercise: PerformedExercise, index: number): PerformedSet {
  const plan = exercise.prescription.plannedSets?.[index];
  const last = exercise.sets[exercise.sets.length - 1];
  return {
    id: uuid(),
    setNumber: index + 1,
    kind: 'working',
    loadKg: plan?.loadKg ?? last?.loadKg ?? null,
    reps: null,
    durationSeconds: plan?.durationSeconds ?? null,
    rir: plan?.rir ?? null,
    completed: false,
    skipped: false,
    completedAt: null,
    technique: plan?.technique ?? exercise.prescription.setTechnique ?? 'standard',
    subEfforts: [],
  };
}

/** Sets an exercise to `planned + offset` sets (clamped), remembering the offset. */
function withOffset(
  exercise: PerformedExercise,
  planned: number,
  offset: number,
): PerformedExercise {
  const target = Math.max(C.minWorkingSets, Math.min(C.maxWorkingSets, planned + offset));
  let sets = exercise.sets.slice(0, target);
  while (sets.length < target) sets = [...sets, blankSet({ ...exercise, sets }, sets.length)];
  return {
    ...exercise,
    setOffset: target - planned,
    prescription: { ...exercise.prescription, workingSets: target },
    sets: sets.map((set, index) => ({ ...set, setNumber: index + 1 })),
  };
}

function weeklyPlannedSets(
  muscle: MuscleGroup,
  days: ProgramDay[],
  excludeDayId: string | null,
  lookup: (id: string) => Exercise | undefined,
): number {
  return days
    .filter((day) => day.id !== excludeDayId)
    .flatMap((day) => day.prescriptions)
    .filter((prescription) => mainMuscle(prescription.exerciseId, lookup) === muscle)
    .reduce((sum, prescription) => sum + prescription.workingSets, 0);
}

/**
 * Opens a fresh session with the set counts its feedback earned. Per exercise
 * the base is the plan plus the offset this same plan day carried last time
 * (so earlier changes accumulate), unless that was more than two weeks ago. Then each muscle's most
 * recent ratings newer than that base add or remove one set, on the exercise
 * with the fewest (or most) sets, within 1-5 sets per exercise and the
 * muscle's weekly MRV.
 */
export function applyFeedbackVolume(
  session: WorkoutSession,
  history: WorkoutSession[],
  lookup: (id: string) => Exercise | undefined,
  programDays: ProgramDay[] = [],
  now = new Date(),
): WorkoutSession {
  const untouched = session.exercises.every((performed) =>
    performed.sets.every((set) => !set.completed && !set.skipped),
  );
  if (!untouched || session.volumeAdjustments || !session.programDayId) return session;

  const past = completedSessions(history).filter(
    (item) => now.getTime() - sessionTime(item) < FEEDBACK_FRESH_DAYS * DAY_MS,
  );
  const lastSameDay = past.find((item) => item.programDayId === session.programDayId) ?? null;

  // 1. Carry over last time's offsets for this day, on top of the current plan
  //    (so editing the plan still changes the session).
  const planned = new Map(
    session.exercises.map((performed) => [performed.id, performed.prescription.workingSets]),
  );
  let exercises = session.exercises.map((performed) => {
    const before = lastSameDay?.exercises.find((item) => item.exerciseId === performed.exerciseId);
    const offset = before?.setOffset ?? 0;
    return offset !== 0 ? withOffset(performed, planned.get(performed.id)!, offset) : performed;
  });
  const shift = (performed: PerformedExercise, delta: number) =>
    withOffset(performed, planned.get(performed.id)!, (performed.setOffset ?? 0) + delta);

  // 2. Apply each muscle's newest ratings that came after that base.
  const adjustments: VolumeAdjustment[] = [];
  const muscles = [
    ...new Set(
      exercises
        .map((performed) => mainMuscle(performed.exerciseId, lookup))
        .filter((muscle): muscle is MuscleGroup => muscle != null),
    ),
  ];
  for (const muscle of muscles) {
    const source = past.find((item) =>
      item.muscleFeedback?.some((feedback) => feedback.muscle === muscle && !feedback.skipped),
    );
    if (!source) continue;
    if (lastSameDay && sessionTime(source) < sessionTime(lastSameDay)) continue;
    const feedback = source.muscleFeedback!.find((item) => item.muscle === muscle)!;
    const decision = setDeltaFromFeedback(feedback);
    if (decision.delta === 0) continue;

    const indexes = exercises
      .map((performed, index) => ({ performed, index }))
      .filter(({ performed }) => mainMuscle(performed.exerciseId, lookup) === muscle);
    const daySets = indexes.reduce(
      (sum, { performed }) => sum + performed.prescription.workingSets,
      0,
    );

    if (decision.delta > 0) {
      const weekly = weeklyPlannedSets(muscle, programDays, session.programDayId, lookup) + daySets;
      if (weekly + 1 > VOLUME_LANDMARKS[muscle].mrv) continue;
      const pick = [...indexes]
        .filter(({ performed }) => performed.prescription.workingSets < C.maxWorkingSets)
        .sort(
          (a, b) =>
            a.performed.prescription.workingSets - b.performed.prescription.workingSets ||
            (a.performed.setOffset ?? 0) - (b.performed.setOffset ?? 0),
        )[0];
      if (!pick) continue;
      exercises = exercises.map((performed, index) =>
        index === pick.index ? shift(performed, 1) : performed,
      );
      adjustments.push({
        muscle,
        exerciseId: pick.performed.exerciseId,
        delta: 1,
        reason: decision.reason,
      });
    } else {
      const pick = [...indexes]
        .filter(({ performed }) => performed.prescription.workingSets > C.minWorkingSets)
        .sort(
          (a, b) => b.performed.prescription.workingSets - a.performed.prescription.workingSets,
        )[0];
      if (!pick) continue;
      exercises = exercises.map((performed, index) =>
        index === pick.index ? shift(performed, -1) : performed,
      );
      adjustments.push({
        muscle,
        exerciseId: pick.performed.exerciseId,
        delta: -1,
        reason: decision.reason,
      });
    }
  }

  return { ...session, exercises, volumeAdjustments: adjustments };
}
