import { computeLevel, computeStreak } from '../gamification';

describe('computeStreak', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');

  it('is 0 with no sessions', () => {
    expect(computeStreak([], now)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const dates = ['2026-09-11', '2026-09-10', '2026-09-09'].map((d) => `${d}T08:00:00.000Z`);
    expect(computeStreak(dates, now)).toBe(3);
  });

  it('keeps the streak alive if yesterday was trained but not yet today', () => {
    const dates = ['2026-09-10', '2026-09-09'].map((d) => `${d}T08:00:00.000Z`);
    expect(computeStreak(dates, now)).toBe(2);
  });

  it('breaks on a gap', () => {
    const dates = ['2026-09-11', '2026-09-09'].map((d) => `${d}T08:00:00.000Z`);
    expect(computeStreak(dates, now)).toBe(1);
  });

  it('is 0 if the last session was more than a day ago', () => {
    const dates = ['2026-09-08T08:00:00.000Z'];
    expect(computeStreak(dates, now)).toBe(0);
  });
});

describe('computeLevel', () => {
  it('starts at Rookie', () => {
    expect(computeLevel(0).tier.name).toBe('Rookie');
  });

  it('promotes at tier thresholds', () => {
    expect(computeLevel(10).tier.name).toBe('Grinder');
    expect(computeLevel(29).tier.name).toBe('Grinder');
    expect(computeLevel(30).tier.name).toBe('Beast');
  });

  it('caps progress at 1 for the max tier', () => {
    expect(computeLevel(500).progress).toBe(1);
    expect(computeLevel(500).nextTier).toBeNull();
  });
});
