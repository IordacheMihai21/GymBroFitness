import {
  createBodyMeasurementEntry,
  latestMeasurementDeltas,
  sortMeasurementsByDateDesc,
  type BodyMeasurementEntry,
} from '../measurements';

function makeEntry(patch: Partial<BodyMeasurementEntry> = {}): BodyMeasurementEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    date: '2026-09-01',
    bodyWeightKg: 80,
    measurementsCm: { waist: 85 },
    createdAt: '2026-09-01T08:00:00.000Z',
    ...patch,
  };
}

describe('createBodyMeasurementEntry', () => {
  it('builds an entry with defaults for optional fields', () => {
    const entry = createBodyMeasurementEntry({
      userId: 'user-1',
      date: '2026-09-01',
      now: () => '2026-09-01T08:00:00.000Z',
    });
    expect(entry.bodyWeightKg).toBeNull();
    expect(entry.measurementsCm).toEqual({});
    expect(entry.createdAt).toBe('2026-09-01T08:00:00.000Z');
    expect(entry.id.length).toBeGreaterThan(0);
  });
});

describe('sortMeasurementsByDateDesc', () => {
  it('orders newest date first, tie-broken by createdAt', () => {
    const older = makeEntry({ id: 'a', date: '2026-09-01' });
    const newer = makeEntry({ id: 'b', date: '2026-09-10' });
    expect(sortMeasurementsByDateDesc([older, newer]).map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('latestMeasurementDeltas', () => {
  it('returns nothing with fewer than two entries', () => {
    expect(latestMeasurementDeltas([makeEntry()])).toEqual([]);
    expect(latestMeasurementDeltas([])).toEqual([]);
  });

  it('computes weight and per-site deltas between the two most recent entries', () => {
    const previous = makeEntry({
      id: 'prev',
      date: '2026-09-01',
      bodyWeightKg: 82,
      measurementsCm: { waist: 87, chest: 100 },
    });
    const current = makeEntry({
      id: 'curr',
      date: '2026-09-08',
      bodyWeightKg: 80,
      measurementsCm: { waist: 85 },
    });

    const deltas = latestMeasurementDeltas([previous, current]);
    const bodyWeight = deltas.find((d) => d.site === 'bodyWeight');
    const waist = deltas.find((d) => d.site === 'waist');

    expect(bodyWeight).toEqual({
      site: 'bodyWeight',
      currentValue: 80,
      previousValue: 82,
      deltaValue: -2,
    });
    expect(waist).toEqual({ site: 'waist', currentValue: 85, previousValue: 87, deltaValue: -2 });
    // chest was only logged on the older entry, so it has nothing to compare against.
    expect(deltas.find((d) => d.site === 'chest')).toBeUndefined();
  });

  it('omits a site missing from either of the two most recent entries', () => {
    const previous = makeEntry({ id: 'prev', date: '2026-09-01', bodyWeightKg: null });
    const current = makeEntry({ id: 'curr', date: '2026-09-08', bodyWeightKg: 80 });
    expect(
      latestMeasurementDeltas([previous, current]).find((d) => d.site === 'bodyWeight'),
    ).toBeUndefined();
  });
});
