import type { PerformedSet, WorkoutSession } from '@/types';

import { performedVolumeKg } from '../analytics';
import { formatPreviousSet } from '../lastPerformance';
import {
  completeOpenSetsWithSuggestions,
  inheritPerSide,
  prepareSetForCompletion,
} from '../setFlow';
import { combineSides, sideBalance, sidePatch } from '../sides';

function set(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: Math.random().toString(36).slice(2),
    setNumber: 1,
    kind: 'working',
    loadKg: 12,
    reps: null,
    durationSeconds: null,
    rir: 1,
    completed: false,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function session(sets: PerformedSet[], patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u',
    programId: null,
    programDayId: null,
    dayName: 'Arms',
    status: 'completed',
    startedAt: '2026-10-01T12:00:00.000Z',
    finishedAt: '2026-10-01T13:00:00.000Z',
    totalPausedSeconds: 0,
    exercises: [
      {
        id: 'p',
        exerciseId: 'bayesian-cable-curl',
        order: 0,
        perSide: true,
        splitSides: true,
        markedDiscomfort: false,
        markedUnavailable: false,
        prescription: {
          exerciseId: 'bayesian-cable-curl',
          order: 0,
          workingSets: sets.length,
          minReps: 8,
          maxReps: 12,
          targetRir: 1,
          restSeconds: 90,
          selectionReason: 'test',
        },
        sets,
      },
    ],
    ...patch,
  };
}

describe('left and right logged separately', () => {
  it('keeps reps at the weaker side so progression follows it', () => {
    expect(combineSides(10, 8)).toBe(8);
    expect(combineSides(null, 9)).toBe(9);
    expect(sidePatch({ repsLeft: 10 }, 'right', 8)).toEqual({
      repsLeft: 10,
      repsRight: 8,
      reps: 8,
    });
  });

  it('fills both sides from last time when a set is ticked empty', () => {
    const prepared = prepareSetForCompletion(
      set(),
      {
        source: 'previous_session_set',
        loadKg: 12,
        reps: 9,
        repsLeft: 10,
        repsRight: 9,
        durationSeconds: null,
        rir: 1,
        label: '',
        detail: '',
      },
      1,
      true,
    );
    expect(prepared).toMatchObject({ repsLeft: 10, repsRight: 9, reps: 9 });
  });

  it('counts real left + right reps for tonnage', () => {
    const done = session([set({ repsLeft: 10, repsRight: 8, reps: 8, completed: true })]);
    expect(performedVolumeKg(done.exercises[0])).toBe(12 * 18);
  });

  it('shows both sides as last time', () => {
    expect(formatPreviousSet(set({ repsLeft: 10, repsRight: 8, reps: 8 }))).toBe(
      'Last: 12 kg × 10/8 @ RIR 1',
    );
  });

  it('bulk-completes split sets with both sides', () => {
    const open = session([set({ repsLeft: 11, repsRight: 10, reps: 10 })], {
      status: 'in_progress',
    });
    const result = completeOpenSetsWithSuggestions(open, 0, [null], 'weight_reps');
    expect(result.session.exercises[0].sets[0]).toMatchObject({ completed: true, reps: 10 });
  });

  it('remembers to log each side next time', () => {
    const fresh = session([set()], { status: 'in_progress' });
    fresh.exercises[0].perSide = undefined;
    fresh.exercises[0].splitSides = undefined;
    const next = inheritPerSide(fresh, [session([set({ reps: 8, completed: true })])]);
    expect(next.exercises[0]).toMatchObject({ perSide: true, splitSides: true });
  });
});

describe('imbalance', () => {
  it('reports the weaker side and how far behind it is', () => {
    const history = [
      session([
        set({ repsLeft: 12, repsRight: 10, reps: 10, completed: true }),
        set({ repsLeft: 11, repsRight: 9, reps: 9, completed: true }),
      ]),
      session([set({ repsLeft: 12, repsRight: 11, reps: 11, completed: true })], {
        startedAt: '2026-10-03T12:00:00.000Z',
        finishedAt: '2026-10-03T13:00:00.000Z',
      }),
    ];
    expect(sideBalance(history, 'bayesian-cable-curl')).toEqual({
      leftReps: 35,
      rightReps: 30,
      sets: 3,
      sessions: 2,
      weaker: 'right',
      gapPercent: 14,
    });
  });

  it('calls small differences balanced and stays quiet without data', () => {
    const even = [session([set({ repsLeft: 20, repsRight: 19, reps: 19, completed: true })])];
    expect(sideBalance(even, 'bayesian-cable-curl')?.weaker).toBeNull();
    expect(sideBalance([], 'bayesian-cable-curl')).toBeNull();
  });
});
