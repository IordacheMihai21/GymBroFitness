/**
 * Velocity-based auto-regulation: how much a set's concentric speed has
 * dropped from its first rep, the standard signal lifting trackers use to
 * flag "you're grinding now, consider stopping" independent of rep count or
 * subjective RIR. Built on the same per-rep peak angular velocity the rep
 * state machine already tracks (see repStateMachine.ts) — no new sensor or
 * camera wiring, just a set-level view over a signal that already exists.
 *
 * Angular velocity (deg/sec) is used as the speed proxy rather than true
 * linear bar speed (m/s): for a single tracked joint with a fixed limb
 * length, angular velocity is monotonically related to the hand/bar's
 * linear speed, and this pipeline has no barbell/object detection to
 * measure linear displacement directly. Good enough to detect a *relative*
 * drop within one set, which is all velocity-loss auto-regulation needs.
 */

export type VelocityLossZone = 'fresh' | 'moderate_loss' | 'high_loss' | 'stop_recommended';

export interface VelocityLossReading {
  repNumber: number;
  peakVelocityDegPerSec: number | null;
  /** % drop from the set's baseline (first rep with a measured velocity). Null when this rep or the baseline has no measurement. */
  velocityLossPct: number | null;
  zone: VelocityLossZone;
}

const MODERATE_LOSS_PCT = 10;
const HIGH_LOSS_PCT = 20;

function classifyZone(velocityLossPct: number | null, stopThresholdPct: number): VelocityLossZone {
  if (velocityLossPct === null) return 'fresh';
  if (velocityLossPct >= stopThresholdPct) return 'stop_recommended';
  if (velocityLossPct >= HIGH_LOSS_PCT) return 'high_loss';
  if (velocityLossPct >= MODERATE_LOSS_PCT) return 'moderate_loss';
  return 'fresh';
}

/**
 * @param peakVelocities One entry per completed rep, in rep order (null for a rep whose velocity was never measured).
 * @param stopThresholdPct Loss % at which a set is considered ground-out. Common ranges: ~15-20% for strength work, ~25-35% for hypertrophy — callers pass a value suited to the current goal rather than this module guessing one.
 */
export function computeVelocityLoss(
  peakVelocities: (number | null)[],
  stopThresholdPct: number,
): VelocityLossReading[] {
  const baseline = peakVelocities.find((value) => value !== null && value > 0) ?? null;

  return peakVelocities.map((peakVelocityDegPerSec, index) => {
    const velocityLossPct =
      baseline === null || peakVelocityDegPerSec === null
        ? null
        : Math.max(0, ((baseline - peakVelocityDegPerSec) / baseline) * 100);

    return {
      repNumber: index + 1,
      peakVelocityDegPerSec,
      velocityLossPct,
      zone: classifyZone(velocityLossPct, stopThresholdPct),
    };
  });
}

/** The most recent rep's reading, or null when no rep has a measured velocity yet — the live "how's this set going" signal during a working set. */
export function latestVelocityLoss(
  peakVelocities: (number | null)[],
  stopThresholdPct: number,
): VelocityLossReading | null {
  const readings = computeVelocityLoss(peakVelocities, stopThresholdPct);
  for (let i = readings.length - 1; i >= 0; i -= 1) {
    if (readings[i].velocityLossPct !== null) return readings[i];
  }
  return null;
}
