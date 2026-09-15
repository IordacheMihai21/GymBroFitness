import { formatRir } from '../rir';

describe('formatRir', () => {
  it('formats whole numbers without a decimal', () => {
    expect(formatRir(0)).toBe('0');
    expect(formatRir(2)).toBe('2');
    expect(formatRir(5)).toBe('5');
  });

  it('formats half-points with one decimal', () => {
    expect(formatRir(0.5)).toBe('0.5');
    expect(formatRir(2.5)).toBe('2.5');
  });
});
