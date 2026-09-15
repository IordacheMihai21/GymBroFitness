/**
 * One Euro Filter (Casiez, Roussel & Vogel, 2012) — a low-latency adaptive
 * low-pass filter: heavy smoothing when a signal is nearly still (killing
 * jitter), automatically backing off smoothing as speed increases (so a
 * fast rep doesn't lag behind the real movement). This is the standard
 * choice for exactly this problem (raw pose-landmark jitter) and is what
 * MediaPipe uses internally for its own landmark smoothing.
 */

import type { Landmark, PoseLandmarks } from './landmarks';

function lowPassAlpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class OneEuroScalar {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private prevValue: number | null = null;
  private prevDerivative = 0;

  constructor(minCutoff = 1.0, beta = 0.3, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(value: number, dtSeconds: number): number {
    if (this.prevValue === null || dtSeconds <= 0) {
      this.prevValue = value;
      return value;
    }

    const rawDerivative = (value - this.prevValue) / dtSeconds;
    const dAlpha = lowPassAlpha(this.dCutoff, dtSeconds);
    const derivative = dAlpha * rawDerivative + (1 - dAlpha) * this.prevDerivative;

    const cutoff = this.minCutoff + this.beta * Math.abs(derivative);
    const alpha = lowPassAlpha(cutoff, dtSeconds);
    const smoothed = alpha * value + (1 - alpha) * this.prevValue;

    this.prevValue = smoothed;
    this.prevDerivative = derivative;
    return smoothed;
  }

  reset(): void {
    this.prevValue = null;
    this.prevDerivative = 0;
  }
}

/**
 * Smooths a whole pose (17 landmarks × x/y/z) frame by frame. Visibility is
 * passed through unsmoothed — it's a confidence score, not a position, and
 * smoothing it would delay detecting a genuinely lost joint.
 */
export class LandmarkSmoother {
  private filters: { x: OneEuroScalar; y: OneEuroScalar; z: OneEuroScalar }[] = [];
  private lastTimestampMs: number | null = null;

  constructor(
    private readonly minCutoff = 1.5,
    private readonly beta = 0.4,
  ) {}

  smooth(landmarks: PoseLandmarks, timestampMs: number): PoseLandmarks {
    const dtSeconds = this.lastTimestampMs === null ? 1 / 30 : (timestampMs - this.lastTimestampMs) / 1000;
    this.lastTimestampMs = timestampMs;

    return landmarks.map((landmark, index): Landmark => {
      if (!this.filters[index]) {
        this.filters[index] = {
          x: new OneEuroScalar(this.minCutoff, this.beta),
          y: new OneEuroScalar(this.minCutoff, this.beta),
          z: new OneEuroScalar(this.minCutoff, this.beta),
        };
      }
      const f = this.filters[index];
      return {
        x: f.x.filter(landmark.x, dtSeconds),
        y: f.y.filter(landmark.y, dtSeconds),
        z: f.z.filter(landmark.z, dtSeconds),
        visibility: landmark.visibility,
      };
    });
  }

  reset(): void {
    this.filters = [];
    this.lastTimestampMs = null;
  }
}
