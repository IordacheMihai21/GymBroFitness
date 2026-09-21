import type { PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

import { patchWorkoutSet, toggleWorkoutSetCompletion } from '../sessionEditing';

function set(id: string, completed = false): PerformedSet {
  return {
    id,
    setNumber: 1,
    kind: 'working',
    loadKg: 80,
    reps: 8,
    durationSeconds: null,
    rir: null,
    completed,
    skipped: false,
    completedAt: completed ? '2026-09-20T09:00:00.000Z' : null,
  };
}

function exercise(id: string, exerciseSet: PerformedSet): PerformedExercise {
  return {
    id: `performed-${id}`,
    exerciseId: id,
    order: 0,
    prescription: {
      exerciseId: id,
      order: 0,
      workingSets: 1,
      minReps: 6,
      maxReps: 10,
      targetRir: 2,
      restSeconds: 90,
      selectionReason: 'test',
    },
    sets: [exerciseSet],
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

function session(): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Test',
    status: 'in_progress',
    startedAt: '2026-09-20T08:00:00.000Z',
    finishedAt: null,
    exercises: [exercise('bench', set('set-1')), exercise('row', set('set-2'))],
    totalPausedSeconds: 0,
  };
}

describe('workout session editing', () => {
  it('patches a set immutably and refuses edits while paused', () => {
    const original = session();
    const patched = patchWorkoutSet(original, 0, 0, { reps: 9 });

    expect(patched.exercises[0].sets[0].reps).toBe(9);
    expect(original.exercises[0].sets[0].reps).toBe(8);
    const paused = { ...original, status: 'paused' as const };
    expect(patchWorkoutSet(paused, 0, 0, { reps: 10 })).toBe(paused);
  });

  it('validates, completes, starts rest and navigates using the updated session', () => {
    const now = new Date('2026-09-20T10:00:00.000Z');
    const result = toggleWorkoutSetCompletion(session(), 0, 0, 'weight_reps', now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.exercises[0].sets[0].completed).toBe(true);
    expect(result.navigation.nextExerciseIndex).toBe(1);
    expect(result.session.restTimer?.endsAt).toBe('2026-09-20T10:01:30.000Z');
  });

  it('keeps invalid data editable instead of marking the set complete', () => {
    const invalid = session();
    invalid.exercises[0].sets[0].reps = 0;
    const result = toggleWorkoutSetCompletion(invalid, 0, 0, 'weight_reps');

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'invalid_set', setId: 'set-1' }),
    );
    expect(invalid.exercises[0].sets[0].completed).toBe(false);
  });
});
