import { detectPersonalRecords, setEfforts, volumeLoadKg } from '../analytics';
import type { Exercise, PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

function makeSet(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: 'set-1',
    setNumber: 1,
    kind: 'working',
    loadKg: 100,
    reps: 8,
    durationSeconds: null,
    rir: 2,
    completed: true,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

describe('setEfforts', () => {
  it('returns just the primary effort when there are no sub-efforts', () => {
    const set = makeSet();
    expect(setEfforts(set)).toEqual([{ loadKg: 100, reps: 8 }]);
  });

  it('flattens the primary effort with drop-set sub-efforts', () => {
    const set = makeSet({
      technique: 'drop_set',
      subEfforts: [
        { loadKg: 80, reps: 6, restSeconds: 0 },
        { loadKg: 60, reps: 6, restSeconds: 0 },
      ],
    });
    expect(setEfforts(set)).toEqual([
      { loadKg: 100, reps: 8 },
      { loadKg: 80, reps: 6 },
      { loadKg: 60, reps: 6 },
    ]);
  });
});

describe('volumeLoadKg with sub-efforts', () => {
  it('adds drop-set sub-effort volume to the primary set', () => {
    const set = makeSet({
      technique: 'drop_set',
      subEfforts: [{ loadKg: 80, reps: 6, restSeconds: 0 }],
    });
    // 100*8 + 80*6 = 1280
    expect(volumeLoadKg([set])).toBe(1280);
  });

  it('matches the pre-existing behavior when there are no sub-efforts', () => {
    expect(volumeLoadKg([makeSet()])).toBe(800);
  });
});

describe('detectPersonalRecords with sub-efforts', () => {
  const exercise: Exercise = {
    id: 'bench',
    slug: 'bench',
    name: 'Bench',
    aliases: [],
    description: '',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    equipment: ['barbell'],
    movementPattern: 'horizontal_push',
    difficulty: 'intermediate',
    exerciseType: 'compound',
    laterality: 'bilateral',
    trackingType: 'weight_reps',
    instructions: [],
    commonMistakes: [],
    scienceExplanation: '',
    progressionInstructions: '',
    easierAlternatives: [],
    harderAlternatives: [],
    equivalentAlternatives: [],
  };

  function makeExercise(sets: PerformedSet[]): PerformedExercise {
    return {
      id: 'performed-1',
      exerciseId: 'bench',
      order: 0,
      markedDiscomfort: false,
      markedUnavailable: false,
      prescription: {
        exerciseId: 'bench',
        order: 0,
        workingSets: sets.length,
        minReps: 6,
        maxReps: 10,
        targetRir: 1,
        restSeconds: 120,
        selectionReason: 'test',
      },
      sets,
    };
  }

  function makeSession(exercises: PerformedExercise[]): WorkoutSession {
    return {
      id: 'session-1',
      userId: 'user-1',
      programId: null,
      programDayId: null,
      dayName: 'Upper A',
      status: 'completed',
      startedAt: '2026-09-14T00:00:00.000Z',
      finishedAt: '2026-09-14T00:30:00.000Z',
      exercises,
      totalPausedSeconds: 0,
    };
  }

  it('finds a heavier max_load in a top-set-plus-backoff sub-effort than the primary set', () => {
    // Backoff sets are usually lighter, but a top-set + a heavier "double back"
    // sub-effort is a real pattern (e.g. logging a spotted rep afterward) —
    // the point is the PR scan must consider every sub-effort, not just index 0.
    const set = makeSet({
      loadKg: 100,
      reps: 5,
      technique: 'top_backoff',
      subEfforts: [{ loadKg: 110, reps: 1, restSeconds: 120 }],
    });
    const session = makeSession([makeExercise([set])]);
    const records = detectPersonalRecords(session, [], () => exercise);

    const maxLoad = records.find((r) => r.kind === 'max_load');
    expect(maxLoad?.value).toBe(110);
  });
});
