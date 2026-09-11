import { computeMesocycleStatus } from '../mesocycle';

describe('computeMesocycleStatus', () => {
  const block = { name: 'Test Block', totalWeeks: 6, startDate: '2026-08-10T00:00:00.000Z' };

  it('is week 1, accumulation, right at the start', () => {
    const status = computeMesocycleStatus(block, new Date('2026-08-10T12:00:00.000Z'));
    expect(status.currentWeek).toBe(1);
    expect(status.phase).toBe('accumulation');
  });

  it('reaches overreaching at week totalWeeks - 1', () => {
    const status = computeMesocycleStatus(block, new Date('2026-09-07T00:00:00.000Z')); // week 5
    expect(status.currentWeek).toBe(5);
    expect(status.phase).toBe('overreaching');
  });

  it('reaches deload at the final week', () => {
    const status = computeMesocycleStatus(block, new Date('2026-09-14T00:00:00.000Z')); // week 6
    expect(status.currentWeek).toBe(6);
    expect(status.phase).toBe('deload');
    expect(status.daysToDeload).toBe(0);
  });

  it('clamps beyond the block length instead of overflowing', () => {
    const status = computeMesocycleStatus(block, new Date('2026-12-01T00:00:00.000Z'));
    expect(status.currentWeek).toBe(6);
    expect(status.phase).toBe('deload');
    expect(status.progress).toBe(1);
  });

  it('counts down days to the deload week', () => {
    const status = computeMesocycleStatus(block, new Date('2026-09-04T00:00:00.000Z'));
    expect(status.daysToDeload).toBeGreaterThan(0);
  });
});
