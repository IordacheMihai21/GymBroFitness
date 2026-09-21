import type { PerformedSet, TrackingType } from '@/types';

import { normalizeSetForTracking, validateSetForTracking } from '../setTracking';

function makeSet(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: 'set-1',
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

describe.each<[TrackingType, Partial<PerformedSet>]>([
  ['weight_reps', { loadKg: 60, reps: 8 }],
  ['bodyweight_reps', { reps: 12 }],
  ['weighted_bodyweight', { loadKg: null, reps: 8 }],
  ['weighted_bodyweight', { loadKg: 10, reps: 8 }],
  ['time', { durationSeconds: 60 }],
])('validateSetForTracking', (trackingType, patch) => {
  it(`accepts a valid ${trackingType} set`, () => {
    expect(validateSetForTracking(makeSet(patch), trackingType)).toEqual({ valid: true });
  });
});

it('rejects decimal reps and missing loaded-lift weight', () => {
  expect(validateSetForTracking(makeSet({ loadKg: 60, reps: 8.5 }), 'weight_reps')).toMatchObject({
    valid: false,
  });
  expect(validateSetForTracking(makeSet({ reps: 8 }), 'weight_reps')).toMatchObject({
    valid: false,
  });
});

it('rejects zero duration but permits legitimate load-free bodyweight work', () => {
  expect(validateSetForTracking(makeSet({ durationSeconds: 0 }), 'time')).toMatchObject({
    valid: false,
  });
  expect(validateSetForTracking(makeSet({ reps: 15 }), 'bodyweight_reps')).toEqual({ valid: true });
});

it('clears irrelevant values before completion', () => {
  expect(
    normalizeSetForTracking(
      makeSet({ loadKg: 50, reps: 10, durationSeconds: 60, subEfforts: [] }),
      'time',
    ),
  ).toMatchObject({ loadKg: null, reps: null, durationSeconds: 60, subEfforts: [] });
});
