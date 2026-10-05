import type { MuscleFeedback, PerformedSet, ProgramDay, WorkoutSession } from '@/types';

import { getExercise } from '../../exercises/catalog';
import {
  applyFeedbackVolume,
  muscleToAskSorenessAt,
  pendingFeedbackMuscles,
  recordMuscleFeedback,
  setDeltaFromFeedback,
} from '../muscleFeedback';

function set(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: Math.random().toString(36).slice(2),
    setNumber: 1,
    kind: 'working',
    loadKg: 20,
    reps: 10,
    durationSeconds: null,
    rir: 1,
    completed: false,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

const NOW = new Date('2026-10-12T12:00:00.000Z');

function session(
  exercises: { id: string; sets: number; done?: boolean; offset?: number }[],
  patch: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u',
    programId: 'p',
    programDayId: 'day-a',
    dayName: 'Arms',
    status: 'in_progress',
    startedAt: NOW.toISOString(),
    finishedAt: null,
    totalPausedSeconds: 0,
    exercises: exercises.map(({ id, sets, done, offset }, order) => ({
      id: `${id}-${order}`,
      exerciseId: id,
      order,
      setOffset: offset,
      markedDiscomfort: false,
      markedUnavailable: false,
      prescription: {
        exerciseId: id,
        order,
        workingSets: sets,
        minReps: 8,
        maxReps: 12,
        targetRir: 1,
        restSeconds: 90,
        selectionReason: 'test',
      },
      sets: Array.from({ length: sets }, (_, index) =>
        set({ setNumber: index + 1, completed: done ?? false }),
      ),
    })),
    ...patch,
  };
}

function finished(
  exercises: Parameters<typeof session>[0],
  feedback: Omit<MuscleFeedback, 'recordedAt'>[],
  daysAgo: number,
  programDayId = 'day-a',
): WorkoutSession {
  const at = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return session(
    exercises.map((item) => ({ ...item, done: true })),
    {
      status: 'completed',
      startedAt: at,
      finishedAt: at,
      programDayId,
      muscleFeedback: feedback.map((item) => ({ ...item, recordedAt: at })),
    },
  );
}

describe('set decision from feedback', () => {
  it('adds a set when the muscle recovered and the work was manageable', () => {
    expect(
      setDeltaFromFeedback({
        muscle: 'biceps',
        soreness: 'recovered_early',
        pump: 'moderate',
        workload: 'just_right',
        joints: 'none',
        recordedAt: '',
      }).delta,
    ).toBe(1);
  });

  it('holds when it recovered just in time or the pump was already great', () => {
    const base = { muscle: 'biceps' as const, joints: 'none' as const, recordedAt: '' };
    expect(
      setDeltaFromFeedback({ ...base, soreness: 'recovered_on_time', workload: 'easy' }).delta,
    ).toBe(0);
    expect(setDeltaFromFeedback({ ...base, pump: 'great', workload: 'just_right' }).delta).toBe(0);
  });

  it('removes a set for joint pain, too much work, or soreness plus hard work', () => {
    const base = { muscle: 'biceps' as const, recordedAt: '' };
    expect(setDeltaFromFeedback({ ...base, joints: 'a_lot', workload: 'easy' }).delta).toBe(-1);
    expect(setDeltaFromFeedback({ ...base, workload: 'too_much' }).delta).toBe(-1);
    expect(setDeltaFromFeedback({ ...base, soreness: 'still_sore', workload: 'hard' }).delta).toBe(
      -1,
    );
  });
});

describe('next session volume', () => {
  const arms = [
    { id: 'barbell-curl', sets: 2 },
    { id: 'hammer-curl', sets: 3 },
  ];
  const good = [
    {
      muscle: 'biceps' as const,
      pump: 'moderate' as const,
      workload: 'easy' as const,
      joints: 'none' as const,
    },
  ];

  it('adds one set to the biceps exercise with the fewest sets', () => {
    const next = applyFeedbackVolume(
      session(arms),
      [finished(arms, good, 7)],
      getExercise,
      [],
      NOW,
    );
    expect(next.exercises.map((item) => item.prescription.workingSets)).toEqual([3, 3]);
    expect(next.exercises[0].sets).toHaveLength(3);
    expect(next.exercises[0].setOffset).toBe(1);
    expect(next.volumeAdjustments).toEqual([
      expect.objectContaining({ muscle: 'biceps', exerciseId: 'barbell-curl', delta: 1 }),
    ]);
  });

  it('accumulates week to week on top of the plan', () => {
    const lastWeek = finished(
      arms.map((item, index) => (index === 0 ? { ...item, sets: 3, offset: 1 } : item)),
      good,
      7,
    );
    const next = applyFeedbackVolume(session(arms), [lastWeek], getExercise, [], NOW);
    expect(next.exercises.map((item) => item.prescription.workingSets)).toEqual([3, 4]);
  });

  it('does not apply the same ratings twice', () => {
    const rated = finished(arms, good, 10, 'day-b');
    const sameDayAfter = finished(
      arms.map((item, index) => (index === 0 ? { ...item, offset: 1, sets: 3 } : item)),
      [],
      3,
    );
    const next = applyFeedbackVolume(session(arms), [rated, sameDayAfter], getExercise, [], NOW);
    expect(next.exercises.map((item) => item.prescription.workingSets)).toEqual([3, 3]);
    expect(next.volumeAdjustments).toEqual([]);
  });

  it('stops at the weekly recoverable ceiling', () => {
    const otherDays: ProgramDay[] = [
      {
        id: 'day-b',
        name: 'B',
        order: 1,
        focus: ['biceps'],
        prescriptions: [
          {
            ...session([{ id: 'cable-curl', sets: 5 }]).exercises[0].prescription,
            workingSets: 21,
          },
        ],
      } as ProgramDay,
    ];
    const next = applyFeedbackVolume(
      session(arms),
      [finished(arms, good, 7)],
      getExercise,
      otherDays,
      NOW,
    );
    expect(next.volumeAdjustments).toEqual([]);
  });

  it('starts from the plan again after two weeks off', () => {
    const old = finished(
      arms.map((item) => ({ ...item, offset: 1, sets: item.sets + 1 })),
      good,
      20,
    );
    const next = applyFeedbackVolume(session(arms), [old], getExercise, [], NOW);
    expect(next.exercises.map((item) => item.prescription.workingSets)).toEqual([2, 3]);
  });

  it('leaves a session alone once a set is logged', () => {
    const started = session(arms);
    started.exercises[0].sets[0].completed = true;
    expect(applyFeedbackVolume(started, [finished(arms, good, 7)], getExercise, [], NOW)).toBe(
      started,
    );
  });
});

describe('when to ask', () => {
  const day = session([
    { id: 'barbell-curl', sets: 2, done: true },
    { id: 'hammer-curl', sets: 2, done: true },
    { id: 'triceps-pushdown', sets: 2 },
  ]);

  it('asks about a muscle once its last exercise is done, until answered', () => {
    expect(pendingFeedbackMuscles(day, getExercise)).toEqual(['biceps']);
    const answered = recordMuscleFeedback(day, 'biceps', {
      pump: 'great',
      workload: 'hard',
      joints: 'none',
    });
    expect(pendingFeedbackMuscles(answered, getExercise)).toEqual([]);
    expect(
      pendingFeedbackMuscles(recordMuscleFeedback(day, 'biceps', { skipped: true }), getExercise),
    ).toEqual([]);
  });

  it('asks about soreness only at a muscle’s first exercise, if trained recently', () => {
    const history = [finished([{ id: 'barbell-curl', sets: 2 }], [], 4)];
    expect(muscleToAskSorenessAt(day, 0, history, getExercise, NOW)).toBe('biceps');
    expect(muscleToAskSorenessAt(day, 1, history, getExercise, NOW)).toBeNull();
    expect(muscleToAskSorenessAt(day, 0, [], getExercise, NOW)).toBeNull();
  });
});
