import type { PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

import {
  completeOpenSetsForExercise,
  patchWorkoutSet,
  skipAllOpenSets,
  toggleWorkoutSetCompletion,
  toggleWorkoutSetSkipped,
} from '../sessionEditing';

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

  it('can skip and restore an open set without completing it', () => {
    const original = session();
    const skipped = toggleWorkoutSetSkipped(original, 0, 0);

    expect(skipped.exercises[0].sets[0]).toMatchObject({ skipped: true, completed: false });
    expect(toggleWorkoutSetSkipped(skipped, 0, 0).exercises[0].sets[0].skipped).toBe(false);
  });

  it('can complete a set during review without starting the rest timer', () => {
    const result = toggleWorkoutSetCompletion(
      session(),
      0,
      0,
      'weight_reps',
      new Date('2026-09-20T10:00:00.000Z'),
      { startRestTimer: false },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.exercises[0].sets[0].completed).toBe(true);
    expect(result.session.restTimer).toBeUndefined();
  });

  it('marks only open sets skipped when an incomplete review is saved', () => {
    const original = session();
    original.exercises[0].sets[0].completed = true;
    const skipped = skipAllOpenSets(original);

    expect(skipped.exercises[0].sets[0]).toMatchObject({ completed: true, skipped: false });
    expect(skipped.exercises[1].sets[0]).toMatchObject({ completed: false, skipped: true });
  });

  it('completes every valid open set for one exercise without starting rest', () => {
    const original = session();
    original.exercises[0].sets.push({ ...set('set-1b'), setNumber: 2 });
    const result = completeOpenSetsForExercise(
      original,
      0,
      'weight_reps',
      new Date('2026-09-20T10:15:00.000Z'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.completedCount).toBe(2);
    expect(result.session.exercises[0].sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ completed: true, completedAt: '2026-09-20T10:15:00.000Z' }),
      ]),
    );
    expect(result.session.restTimer).toBeUndefined();
  });

  it('keeps all open sets editable when bulk completion finds invalid input', () => {
    const original = session();
    original.exercises[0].sets.push({ ...set('set-invalid'), setNumber: 2, reps: 0 });
    const result = completeOpenSetsForExercise(original, 0, 'weight_reps');

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'invalid_sets',
        errors: expect.objectContaining({ 'set-invalid': expect.any(String) }),
      }),
    );
    expect(original.exercises[0].sets.every((candidate) => !candidate.completed)).toBe(true);
  });
});
