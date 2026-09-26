export type MotivationalQuote = {
  text: string;
  author: string;
};

/**
 * A small curated set, not a live feed — no network dependency for a home-
 * screen greeting, and no attribution risk from scraping. Rotates by
 * calendar day so it feels like "today's quote" (stable across reopens the
 * same day) rather than a random one every launch.
 */
const QUOTES: MotivationalQuote[] = [
  { text: 'The only bad workout is the one that didn’t happen.', author: 'Unknown' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Unknown' },
  { text: 'Strength does not come from winning. Your struggles develop your strengths.', author: 'Arnold Schwarzenegger' },
  { text: 'The pain of discipline is far less than the pain of regret.', author: 'Unknown' },
  { text: 'You don’t have to be extreme, just consistent.', author: 'Unknown' },
  { text: 'The body achieves what the mind believes.', author: 'Unknown' },
  { text: 'It never gets easier, you just get stronger.', author: 'Unknown' },
  { text: 'Every rep counts, even the ones you almost skip.', author: 'Unknown' },
  { text: 'Progress is progress, no matter how small.', author: 'Unknown' },
  { text: 'The only person you should try to be better than is who you were yesterday.', author: 'Unknown' },
  { text: 'Sore today, strong tomorrow.', author: 'Unknown' },
  { text: 'Don’t wish for it. Work for it.', author: 'Unknown' },
  { text: 'Champions train, losers complain.', author: 'Unknown' },
  { text: 'Your only limit is you.', author: 'Unknown' },
  { text: 'Small steps every day.', author: 'Unknown' },
  { text: 'What seems impossible today will one day become your warm-up.', author: 'Unknown' },
  { text: 'The last three or four reps is what makes the muscle grow.', author: 'Arnold Schwarzenegger' },
  { text: 'Motivation gets you started. Habit keeps you going.', author: 'Jim Ryun' },
  { text: 'Nothing works unless you do.', author: 'Maya Angelou' },
  { text: 'You are stronger than you think.', author: 'Unknown' },
];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

/** Deterministic by calendar day (UTC) — same quote all day, a new one tomorrow. */
export function dailyQuote(date: Date = new Date()): MotivationalQuote {
  const index = dayOfYear(date) % QUOTES.length;
  return QUOTES[index];
}
