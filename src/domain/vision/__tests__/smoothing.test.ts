import { LandmarkSmoother } from '../smoothing';
import type { PoseLandmarks } from '../landmarks';

function frameAt(value: number, visibility = 0.9): PoseLandmarks {
  return Array.from({ length: 17 }, () => ({ x: value, y: value, z: 0, visibility }));
}

function variance(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

describe('LandmarkSmoother', () => {
  it('reduces jitter on a stationary-but-noisy signal', () => {
    const smoother = new LandmarkSmoother();
    const raw: number[] = [];
    const smoothed: number[] = [];
    let t = 0;
    // Deterministic pseudo-noise around 0.5, alternating +/- so mean stays 0.5.
    for (let i = 0; i < 60; i += 1) {
      const noise = (i % 2 === 0 ? 1 : -1) * 0.03;
      const value = 0.5 + noise;
      raw.push(value);
      t += 1000 / 30;
      const result = smoother.smooth(frameAt(value), t);
      smoothed.push(result[0].x);
    }

    // Drop the first few frames (filter warm-up) before comparing steady-state jitter.
    expect(variance(smoothed.slice(10))).toBeLessThan(variance(raw.slice(10)));
  });

  it('tracks a fast linear ramp without major lag', () => {
    const smoother = new LandmarkSmoother();
    let t = 0;
    let last = 0;
    for (let i = 0; i <= 30; i += 1) {
      const value = i / 30; // 0 -> 1 over 1 second at 30fps
      t += 1000 / 30;
      last = smoother.smooth(frameAt(value), t)[0].x;
    }
    expect(last).toBeGreaterThan(0.85);
  });

  it('passes visibility through unsmoothed', () => {
    const smoother = new LandmarkSmoother();
    const result = smoother.smooth(frameAt(0.5, 0.42), 0);
    expect(result[0].visibility).toBe(0.42);
  });

  it('resets cleanly, forgetting prior state', () => {
    const smoother = new LandmarkSmoother();
    smoother.smooth(frameAt(0.9), 0);
    smoother.smooth(frameAt(0.9), 33);
    smoother.reset();
    // Immediately after reset, the filter has no history — first value passes through as-is.
    const result = smoother.smooth(frameAt(0.1), 1000);
    expect(result[0].x).toBeCloseTo(0.1);
  });
});
