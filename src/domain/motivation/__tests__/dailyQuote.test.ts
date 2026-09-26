import { dailyQuote } from '../dailyQuote';

describe('dailyQuote', () => {
  it('returns the same quote for two different times on the same UTC calendar day', () => {
    const morning = new Date('2026-03-05T01:00:00.000Z');
    const night = new Date('2026-03-05T23:59:00.000Z');
    expect(dailyQuote(morning)).toEqual(dailyQuote(night));
  });

  it('can return a different quote on a different day', () => {
    const day1 = dailyQuote(new Date('2026-03-05T12:00:00.000Z'));
    const day2 = dailyQuote(new Date('2026-03-06T12:00:00.000Z'));
    // Not guaranteed different for every possible pair (the list wraps), but
    // adjacent days should not collide given the list length used here.
    expect(day1).not.toEqual(day2);
  });

  it('returns the same quote a year later (deterministic, not random)', () => {
    const thisYear = dailyQuote(new Date('2026-03-05T12:00:00.000Z'));
    const nextYear = dailyQuote(new Date('2027-03-05T12:00:00.000Z'));
    expect(thisYear).toEqual(nextYear);
  });

  it('always returns a non-empty quote text and author', () => {
    const quote = dailyQuote(new Date('2026-07-19T12:00:00.000Z'));
    expect(quote.text.length).toBeGreaterThan(0);
    expect(quote.author.length).toBeGreaterThan(0);
  });
});
