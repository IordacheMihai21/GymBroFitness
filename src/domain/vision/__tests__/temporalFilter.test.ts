import { TemporalFilter } from '../temporalFilter';

describe('TemporalFilter', () => {
  it('does not confirm a violation that has not yet persisted long enough', () => {
    const filter = new TemporalFilter();
    expect(filter.update('knee-cave', true, 0, 300)).toBe(false);
    expect(filter.update('knee-cave', true, 200, 300)).toBe(false);
  });

  it('confirms once the signal has held continuously for the persist duration', () => {
    const filter = new TemporalFilter();
    filter.update('knee-cave', true, 0, 300);
    expect(filter.update('knee-cave', true, 300, 300)).toBe(true);
    expect(filter.update('knee-cave', true, 500, 300)).toBe(true);
  });

  it('resets the clock the instant the signal goes false — a single good frame clears it', () => {
    const filter = new TemporalFilter();
    filter.update('knee-cave', true, 0, 300);
    filter.update('knee-cave', false, 100, 300);
    // Re-triggering starts the persistence clock over, so it should not be confirmed yet.
    expect(filter.update('knee-cave', true, 150, 300)).toBe(false);
    expect(filter.update('knee-cave', true, 460, 300)).toBe(true);
  });

  it('confirms immediately when persistMs is 0', () => {
    const filter = new TemporalFilter();
    expect(filter.update('any-rule', true, 0, 0)).toBe(true);
  });

  it('tracks multiple keys independently', () => {
    const filter = new TemporalFilter();
    filter.update('a', true, 0, 300);
    filter.update('b', true, 0, 300);
    expect(filter.update('a', true, 300, 300)).toBe(true);
    expect(filter.update('b', false, 300, 300)).toBe(false);
  });
});
