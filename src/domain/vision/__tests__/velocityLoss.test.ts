import { computeVelocityLoss, latestVelocityLoss } from '../velocityLoss';

describe('computeVelocityLoss', () => {
  it('reports zero loss and a fresh zone for the baseline rep', () => {
    const [first] = computeVelocityLoss([200], 20);
    expect(first.velocityLossPct).toBe(0);
    expect(first.zone).toBe('fresh');
  });

  it('computes loss percent relative to the first measured rep', () => {
    const readings = computeVelocityLoss([200, 180, 150], 20);
    expect(readings[1].velocityLossPct).toBeCloseTo(10, 5);
    expect(readings[2].velocityLossPct).toBeCloseTo(25, 5);
  });

  it('classifies zones by loss percent against the given stop threshold', () => {
    const readings = computeVelocityLoss([100, 92, 85, 78, 60], 30);
    expect(readings[0].zone).toBe('fresh'); // 0%
    expect(readings[1].zone).toBe('fresh'); // 8%
    expect(readings[2].zone).toBe('moderate_loss'); // 15%
    expect(readings[3].zone).toBe('high_loss'); // 22%
    expect(readings[4].zone).toBe('stop_recommended'); // 40%
  });

  it('respects a caller-supplied stop threshold instead of a hardcoded one', () => {
    const strengthFocus = computeVelocityLoss([100, 85], 15); // 15% loss
    const hypertrophyFocus = computeVelocityLoss([100, 85], 35);
    expect(strengthFocus[1].zone).toBe('stop_recommended');
    expect(hypertrophyFocus[1].zone).toBe('moderate_loss');
  });

  it('never reports a negative loss when a later rep is faster than the first', () => {
    const readings = computeVelocityLoss([100, 110], 20);
    expect(readings[1].velocityLossPct).toBe(0);
    expect(readings[1].zone).toBe('fresh');
  });

  it('treats a rep with no measured velocity as unknown, not zero loss', () => {
    const readings = computeVelocityLoss([100, null, 90], 20);
    expect(readings[1].velocityLossPct).toBeNull();
    expect(readings[1].zone).toBe('fresh');
    expect(readings[2].velocityLossPct).toBeCloseTo(10, 5);
  });

  it('reports every rep as unmeasured when no baseline velocity is ever available', () => {
    const readings = computeVelocityLoss([null, null], 20);
    expect(readings.every((r) => r.velocityLossPct === null)).toBe(true);
  });

  it('numbers readings starting at 1 in input order', () => {
    const readings = computeVelocityLoss([100, 90, 80], 20);
    expect(readings.map((r) => r.repNumber)).toEqual([1, 2, 3]);
  });
});

describe('latestVelocityLoss', () => {
  it('returns the most recent rep with a measured velocity', () => {
    const latest = latestVelocityLoss([100, 90, null], 20);
    expect(latest?.repNumber).toBe(2);
    expect(latest?.velocityLossPct).toBeCloseTo(10, 5);
  });

  it('returns null when no rep has a measured velocity yet', () => {
    expect(latestVelocityLoss([null, null], 20)).toBeNull();
  });

  it('returns null for an empty set', () => {
    expect(latestVelocityLoss([], 20)).toBeNull();
  });
});
