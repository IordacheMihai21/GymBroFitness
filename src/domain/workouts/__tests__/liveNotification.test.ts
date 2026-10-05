import type { PerformedSet, WorkoutSession } from '@/types';

import { getExercise } from '../../exercises/catalog';
import { buildLiveNotification, nextOpenSet } from '../liveNotification';
import type { SetAutofillSuggestion } from '../setAutofill';

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

const NOW = new Date('2026-10-05T12:30:00.000Z').getTime();

function session(patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 's',
    userId: 'u',
    programId: null,
    programDayId: 'd',
    dayName: 'Arms',
    status: 'in_progress',
    startedAt: '2026-10-05T12:00:00.000Z',
    finishedAt: null,
    totalPausedSeconds: 0,
    exercises: [
      {
        id: 'a',
        exerciseId: 'dumbbell-curl',
        order: 0,
        markedDiscomfort: false,
        markedUnavailable: false,
        prescription: {
          exerciseId: 'dumbbell-curl',
          order: 0,
          workingSets: 2,
          minReps: 8,
          maxReps: 12,
          targetRir: 1,
          restSeconds: 90,
          selectionReason: 'test',
        },
        sets: [
          set({ loadKg: 14, reps: 10, rir: 1, completed: true }),
          set({ setNumber: 2, loadKg: 14 }),
        ],
      },
    ],
    ...patch,
  };
}

const lastTime: SetAutofillSuggestion = {
  source: 'previous_session_set',
  loadKg: 14,
  reps: 11,
  durationSeconds: null,
  rir: 1,
  label: '',
  detail: '',
};

describe('lock-screen notification', () => {
  it('shows the next set with the numbers it will be logged with', () => {
    const model = buildLiveNotification(session(), 0, () => lastTime, getExercise, 'kg', NOW)!;
    expect(model.title).toBe('Dumbbell Curl · Set 2 of 2');
    expect(model.text).toBe('Next: 14 kg each × 11 reps');
    expect(model.subText).toBe('Arms · 1/2 sets');
    expect(model.actions.map((action) => action.id)).toEqual(['log_set']);
    expect(model.target).toEqual({ exerciseIndex: 0, setIndex: 1 });
  });

  it('counts down the rest and offers rest buttons', () => {
    const resting = session({
      restTimer: { endsAt: new Date(NOW + 60_000).toISOString(), durationSeconds: 90 },
    });
    const model = buildLiveNotification(resting, 0, () => lastTime, getExercise, 'kg', NOW)!;
    expect(model.restEndsAt).toBe(NOW + 60_000);
    expect(model.text.startsWith('Rest, then ')).toBe(true);
    expect(model.actions.map((action) => action.id)).toEqual([
      'log_set',
      'extend_rest',
      'skip_rest',
    ]);
  });

  it('only offers Log set when the set can be logged without typing', () => {
    const model = buildLiveNotification(session(), 0, () => null, getExercise, 'kg', NOW)!;
    expect(model.actions).toEqual([]);
    expect(model.text).toBe('Next: 14 kg each');
  });

  it('labels one-side-at-a-time sets', () => {
    const perSide = session();
    perSide.exercises[0].perSide = true;
    const model = buildLiveNotification(perSide, 0, () => lastTime, getExercise, 'kg', NOW)!;
    expect(model.text).toBe('Next: 14 kg/side × 11/side reps');
  });

  it('goes quiet in review and after the workout', () => {
    expect(
      buildLiveNotification(
        session({ reviewStartedAt: new Date(NOW).toISOString() }),
        0,
        () => lastTime,
        getExercise,
        'kg',
        NOW,
      ),
    ).toBeNull();
    expect(
      buildLiveNotification(session({ status: 'completed' }), 0, () => lastTime, getExercise, 'kg'),
    ).toBeNull();
  });

  it('finds the next open set after the active exercise', () => {
    const done = session();
    done.exercises[0].sets[1].completed = true;
    expect(nextOpenSet(done, 0)).toBeNull();
    expect(nextOpenSet(session(), 0)).toEqual({ exerciseIndex: 0, setIndex: 1 });
  });
});
