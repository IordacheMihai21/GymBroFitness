import { formatPlateBreakdown, plateBreakdown } from '../plateMath';

describe('plateBreakdown', () => {
  it('returns bar-only for the empty bar weight', () => {
    const result = plateBreakdown(20, 'kg');
    expect(result.perSide).toHaveLength(0);
    expect(result.exact).toBe(true);
    expect(result.achievedWeight).toBe(20);
  });

  it('greedily fills plates per side for an exact target', () => {
    const result = plateBreakdown(100, 'kg');
    expect(result.exact).toBe(true);
    expect(result.achievedWeight).toBe(100);
    // (100 - 20) / 2 = 40kg per side -> 25 + 15
    expect(result.perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
  });

  it('rounds down to the nearest achievable weight when the target is unreachable', () => {
    const result = plateBreakdown(101, 'kg');
    expect(result.exact).toBe(false);
    expect(result.achievedWeight).toBeLessThanOrEqual(101);
  });

  it('never goes negative when the target is below the bar weight', () => {
    const result = plateBreakdown(5, 'kg');
    expect(result.perSide).toHaveLength(0);
    expect(result.achievedWeight).toBe(20);
  });

  it('supports lb units with the lb default bar and plates', () => {
    const result = plateBreakdown(135, 'lb');
    expect(result.barWeight).toBe(45);
    expect(result.exact).toBe(true);
  });

  it('formats a plate breakdown as a readable string', () => {
    const result = plateBreakdown(100, 'kg');
    expect(formatPlateBreakdown(result)).toBe('25 + 15');
  });

  it('formats bar-only', () => {
    expect(formatPlateBreakdown(plateBreakdown(20, 'kg'))).toBe('Bar only');
  });
});
