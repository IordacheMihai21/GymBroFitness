import type { PerformedSet, WorkoutSession } from '@/types';

import { performedVolumeKg, setsByMuscle } from '../analytics';
import { getExercise } from '../../exercises/catalog';
import { isPerSide, loadFieldLabel, loadMeaning } from '../laterality';
import {
  addSet,
  completeOpenSetsWithSuggestions,
  inheritPerSide,
  kindForRir,
  prepareSetForCompletion,
  removeSet,
  setExercisePerSide,
  swapSessionExercise,
} from '../setFlow';
import { buildSetAutofillSuggestion, type SetAutofillSuggestion } from '../setAutofill';

function set(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: Math.random().toString(36).slice(2),
    setNumber: 1,
    kind: 'working',
    loadKg: null,
    reps: null,
    durationSeconds: null,
    rir: null,
    completed: false,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function session(exerciseId: string, sets: PerformedSet[], targetRir = 0): WorkoutSession {
  return {
    id: 's',
    userId: 'u',
    programId: null,
    programDayId: null,
    dayName: 'Arms',
    status: 'in_progress',
    startedAt: '2026-10-05T12:00:00.000Z',
    finishedAt: null,
    totalPausedSeconds: 0,
    exercises: [
      {
        id: 'p',
        exerciseId,
        order: 0,
        markedDiscomfort: false,
        markedUnavailable: false,
        prescription: {
          exerciseId,
          order: 0,
          workingSets: sets.length,
          minReps: 8,
          maxReps: 12,
          targetRir,
          restSeconds: 90,
          selectionReason: 'test',
        },
        sets,
      },
    ],
  };
}

const suggestion: SetAutofillSuggestion = {
  source: 'previous_session_set',
  loadKg: 20,
  reps: 10,
  durationSeconds: null,
  rir: null,
  label: 'Last session set 1',
  detail: '20 kg x 10',
};

describe('fast set logging', () => {
  it('fills empty fields from the suggestion and defaults effort to the plan target', () => {
    const prepared = prepareSetForCompletion(set({ reps: 9 }), suggestion, 0);
    expect(prepared).toMatchObject({ loadKg: 20, reps: 9, rir: 0, kind: 'failure' });
  });

  it('keeps a typed RIR and a warm-up tag', () => {
    expect(prepareSetForCompletion(set({ rir: 2 }), suggestion, 0).kind).toBe('working');
    expect(prepareSetForCompletion(set({ kind: 'warmup' }), suggestion, 0).kind).toBe('warmup');
    expect(kindForRir(set(), 0)).toBe('failure');
    expect(kindForRir(set({ kind: 'failure' }), 2)).toBe('working');
  });

  it('completes open sets on the way to the next exercise, leaving empty ones open', () => {
    const start = session('dumbbell-curl', [set(), set({ setNumber: 2 }), set({ setNumber: 3 })]);
    const result = completeOpenSetsWithSuggestions(
      start,
      0,
      [suggestion, suggestion, null],
      'weight_reps',
    );
    expect(result.completedCount).toBe(2);
    expect(result.leftOpenCount).toBe(1);
    expect(result.session.exercises[0].sets.map((item) => item.completed)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('never bulk-logs the plan rep floor as if it were performed', () => {
    const planOnly: SetAutofillSuggestion = { ...suggestion, source: 'prescription', reps: 1 };
    const start = session('dumbbell-curl', [set({ loadKg: 20 }), set({ setNumber: 2, reps: 9 })]);
    const result = completeOpenSetsWithSuggestions(start, 0, [planOnly, planOnly], 'weight_reps');
    expect(result.session.exercises[0].sets.map((item) => item.completed)).toEqual([false, true]);
    expect(result.session.exercises[0].sets[1]).toMatchObject({ loadKg: 20, reps: 9 });
  });

  it('suggests the plan for set 2 when set 1 only has a pre-filled load', () => {
    const start = session('dumbbell-curl', [set({ loadKg: 80 }), set({ setNumber: 2 })]);
    start.exercises[0].prescription.plannedSets = [
      { loadKg: 80, rir: 0 },
      { loadKg: 75, rir: 0 },
    ];
    const second = buildSetAutofillSuggestion(start.exercises[0], null, 1);
    expect(second).toMatchObject({ source: 'prescription', loadKg: 75, reps: 8 });
  });

  it('fills reps from the plan when the remembered set has none', () => {
    const last = session('dumbbell-curl', [set({ loadKg: 20, completed: true })]).exercises[0];
    const next = buildSetAutofillSuggestion(
      session('dumbbell-curl', [set()]).exercises[0],
      last,
      0,
    );
    expect(next).toMatchObject({ loadKg: 20, reps: 8 });
  });

  it('adds and removes sets without touching logged ones', () => {
    const start = session('dumbbell-curl', [set({ loadKg: 15, completed: true })]);
    const added = addSet(start, 0);
    expect(added.exercises[0].sets).toHaveLength(2);
    expect(added.exercises[0].sets[1]).toMatchObject({
      setNumber: 2,
      loadKg: 15,
      completed: false,
    });
    expect(removeSet(added, 0, 0).exercises[0].sets).toHaveLength(2);
    expect(removeSet(added, 0, 1).exercises[0].sets).toHaveLength(1);
  });
});

describe('one side at a time', () => {
  it('follows the exercise by default and the lifter when switched', () => {
    const bayesian = session('bayesian-cable-curl', [set()]);
    expect(isPerSide(bayesian.exercises[0])).toBe(true);
    expect(isPerSide(setExercisePerSide(bayesian, 0, false).exercises[0])).toBe(false);
  });

  it('counts a per-side set once for volume but both sides for tonnage', () => {
    const logged = setExercisePerSide(
      session('dumbbell-curl', [set({ loadKg: 10, reps: 10, completed: true })]),
      0,
      true,
    );
    expect(setsByMuscle(logged, getExercise).biceps).toBe(1);
    expect(performedVolumeKg(logged.exercises[0])).toBe(200);
  });

  it('labels the load field so the number means one thing', () => {
    const dumbbellCurl = getExercise('dumbbell-curl')!;
    const barbellCurl = getExercise('barbell-curl')!;
    expect(loadFieldLabel(loadMeaning(dumbbellCurl, false), 'kg')).toBe('kg each');
    expect(loadFieldLabel(loadMeaning(dumbbellCurl, true), 'kg')).toBe('kg/side');
    expect(loadFieldLabel(loadMeaning(barbellCurl, false), 'kg')).toBe('kg total');
  });

  it('remembers last session’s choice', () => {
    const last = {
      ...setExercisePerSide(session('dumbbell-curl', [set()]), 0, true),
      status: 'completed' as const,
    };
    const fresh = inheritPerSide(session('dumbbell-curl', [set()]), [last]);
    expect(fresh.exercises[0].perSide).toBe(true);
  });
});

describe('swapping mid-workout', () => {
  it('replaces an untouched exercise and keeps the original for the record', () => {
    const swapped = swapSessionExercise(
      session('hammer-curl', [set({ loadKg: 12 })]),
      0,
      'cable-curl',
    );
    expect(swapped.exercises[0]).toMatchObject({
      exerciseId: 'cable-curl',
      replacedExerciseId: 'hammer-curl',
    });
    expect(swapped.exercises[0].sets[0].loadKg).toBeNull();
  });

  it('refuses once a set is logged', () => {
    const started = session('hammer-curl', [set({ loadKg: 12, reps: 10, completed: true })]);
    expect(swapSessionExercise(started, 0, 'cable-curl')).toBe(started);
  });
});
