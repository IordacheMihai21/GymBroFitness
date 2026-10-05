import type { PerformedSet, WorkoutSession } from '@/types';

import { getExercise } from '../../exercises/catalog';
import { setsByMuscle } from '../analytics';
import { buildSetAutofillSuggestion } from '../setAutofill';
import { prepareSetForCompletion } from '../setFlow';
import { buildWarmupSets, insertWarmupSets, isFirstForMuscle, workingIndexOf } from '../warmup';

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

function session(exerciseIds: string[], sets: PerformedSet[][]): WorkoutSession {
  return {
    id: 's',
    userId: 'u',
    programId: null,
    programDayId: null,
    dayName: 'Push',
    status: 'in_progress',
    startedAt: '2026-10-05T12:00:00.000Z',
    finishedAt: null,
    totalPausedSeconds: 0,
    exercises: exerciseIds.map((exerciseId, order) => ({
      id: `p${order}`,
      exerciseId,
      order,
      markedDiscomfort: false,
      markedUnavailable: false,
      prescription: {
        exerciseId,
        order,
        workingSets: sets[order].length,
        minReps: 6,
        maxReps: 10,
        targetRir: 1,
        restSeconds: 180,
        selectionReason: 'test',
      },
      sets: sets[order],
    })),
  };
}

const bench = getExercise('barbell-bench-press')!;
const curl = getExercise('dumbbell-curl')!;

describe('warm-up ramp', () => {
  it('ramps a first heavy compound in three steps on loads the bar can make', () => {
    const sets = buildWarmupSets(100, bench, true);
    expect(sets.map((item) => [item.loadKg, item.reps])).toEqual([
      [50, 8],
      [70, 5],
      [85, 2],
    ]);
    expect(sets.every((item) => item.kind === 'warmup' && item.rir == null)).toBe(true);
  });

  it('drops steps that collapse onto the empty bar or the working load', () => {
    expect(buildWarmupSets(30, bench, true).map((item) => item.loadKg)).toEqual([20, 25]);
    expect(buildWarmupSets(20, bench, true)).toEqual([]);
  });

  it('gives a warm muscle a lighter ramp', () => {
    expect(buildWarmupSets(100, bench, false)).toHaveLength(2);
    expect(buildWarmupSets(16, curl, false).map((item) => [item.loadKg, item.reps])).toEqual([
      [10, 8],
    ]);
  });

  it('knows when a muscle is already warm', () => {
    const push = session(
      ['barbell-bench-press', 'dumbbell-curl', 'machine-chest-press'],
      [[set()], [set()], [set()]],
    );
    expect(isFirstForMuscle(push, 0, getExercise)).toBe(true);
    expect(isFirstForMuscle(push, 1, getExercise)).toBe(true);
    expect(isFirstForMuscle(push, 2, getExercise)).toBe(false);
  });
});

describe('warm-ups next to working sets', () => {
  const start = session(['barbell-bench-press'], [[set({ loadKg: 100 }), set({ setNumber: 2 })]]);
  const warmed = insertWarmupSets(start, 0, buildWarmupSets(100, bench, true));
  const sets = warmed.exercises[0].sets;

  it('goes in front, numbered apart from the working sets', () => {
    expect(sets.map((item) => item.kind)).toEqual([
      'warmup',
      'warmup',
      'warmup',
      'working',
      'working',
    ]);
    expect(sets.map((item) => item.setNumber)).toEqual([1, 2, 3, 1, 2]);
    expect(workingIndexOf(sets, 4)).toBe(1);
  });

  it('keeps comparing working set 1 with last session set 1', () => {
    const last = session(
      ['barbell-bench-press'],
      [
        [
          set({ loadKg: 100, reps: 8, rir: 1, completed: true }),
          set({ loadKg: 95, reps: 8, rir: 1, completed: true }),
        ],
      ],
    ).exercises[0];
    expect(buildSetAutofillSuggestion(warmed.exercises[0], last, 3).loadKg).toBe(100);
    expect(buildSetAutofillSuggestion(warmed.exercises[0], last, 4).loadKg).toBe(95);
    expect(buildSetAutofillSuggestion(warmed.exercises[0], last, 0)).toMatchObject({
      loadKg: 50,
      reps: 8,
      rir: null,
    });
  });

  it('never counts toward volume and never gets an effort rating', () => {
    const done = {
      ...warmed,
      exercises: [
        {
          ...warmed.exercises[0],
          sets: sets.map((item) => ({ ...item, completed: item.kind === 'warmup' })),
        },
      ],
    };
    expect(setsByMuscle(done, getExercise).chest ?? 0).toBe(0);
    expect(prepareSetForCompletion(sets[0], null, 0).rir).toBeNull();
  });
});
