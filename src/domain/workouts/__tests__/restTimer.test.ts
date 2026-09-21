import { extendRestTimer, remainingRestSeconds, startRestTimer } from '../restTimer';

describe('rest timer', () => {
  const now = Date.parse('2026-09-20T10:00:00.000Z');

  it('derives remaining time from an absolute deadline after background time passes', () => {
    const timer = startRestTimer(120, now);

    expect(timer).not.toBeNull();
    expect(remainingRestSeconds(timer!, now + 35_250)).toBe(85);
    expect(remainingRestSeconds(timer!, now + 121_000)).toBe(0);
  });

  it('extends a running or expired deadline without losing the persisted duration', () => {
    const running = startRestTimer(60, now)!;
    const extended = extendRestTimer(running, 30, now + 20_000);
    expect(extended.durationSeconds).toBe(90);
    expect(remainingRestSeconds(extended, now + 20_000)).toBe(70);

    const restarted = extendRestTimer(running, 30, now + 90_000);
    expect(remainingRestSeconds(restarted, now + 90_000)).toBe(30);
  });
});
