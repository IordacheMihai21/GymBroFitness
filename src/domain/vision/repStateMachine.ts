/**
 * Rep counting via hysteresis-banded threshold crossing (ported concept
 * from gouthamx67/ai-gym-trainer's updateExercise, used with permission —
 * see docs/PLAN.md), extended with a four-phase movement cycle instead of a
 * raw up/down flag, so tempo and eccentric-control can actually be scored,
 * not just rep count.
 *
 * The hysteresis band (default 12°) is what prevents duplicate reps from
 * pose-estimation noise near a threshold — a rep only counts once the angle
 * has crossed decisively past the opposite threshold, not on every small
 * oscillation around it.
 *
 * Phases are named by motion direction through the tracked angle
 * (`rising`/`falling` toward the top or bottom threshold), not by muscle
 * physiology — "moving toward the top of the tracked ROM" is NOT always
 * the concentric (muscle-shortening) phase. For a curl, lifting the weight
 * (rising toward the flexed top) is concentric. For a squat, the reverse:
 * standing back up is concentric, and that motion runs from the squat's
 * "top" (deepest knee bend) back to "bottom" (standing) — falling, in this
 * module's vocabulary. Which direction is truly concentric is exercise-
 * specific and is resolved one layer up, in exerciseVisionConfigs, by each
 * config's `concentricDirection` field — this module stays agnostic to it.
 */

/**
 * Whether the "top" of the rep (the ROM's far endpoint from rest) reads as
 * a larger angle (e.g. overhead press: elbow angle grows toward lockout)
 * or a smaller one (e.g. curl: elbow angle shrinks toward full flexion).
 */
export type ThresholdDirection = 'increasing' | 'decreasing';

export type RepEndpoint = 'bottom' | 'top';

export type MovementPhase = 'start' | 'rising' | 'peak' | 'falling';

export interface RepThresholds {
  bottom: number;
  top: number;
}

export interface RepMachineState {
  endpoint: RepEndpoint;
  phase: MovementPhase;
  count: number;
  risingStartMs: number | null;
  fallingStartMs: number | null;
  minAngleThisRep: number;
  maxAngleThisRep: number;
}

export interface CompletedRepTiming {
  /** Duration of the most recent rising-toward-top phase, ms. Null if never captured (e.g. tracking started mid-rep). */
  risingMs: number | null;
  /** Duration of the most recent falling-toward-bottom phase, ms. */
  fallingMs: number | null;
  romDegrees: number;
}

export interface RepMachineResult {
  state: RepMachineState;
  repCompleted: boolean;
  completedRepTiming: CompletedRepTiming | null;
}

const HYSTERESIS_TOLERANCE_DEG = 12;
/** Angular speed below which the joint is considered "holding" rather than actively moving. */
const STABLE_DEG_PER_SEC = 20;

export function createInitialRepMachineState(): RepMachineState {
  return {
    endpoint: 'bottom',
    phase: 'start',
    count: 0,
    risingStartMs: null,
    fallingStartMs: null,
    minAngleThisRep: Infinity,
    maxAngleThisRep: -Infinity,
  };
}

export function updateRepMachine(
  prev: RepMachineState,
  angle: number,
  angularVelocityDegPerSec: number | null,
  direction: ThresholdDirection,
  thresholds: RepThresholds,
  timestampMs: number,
): RepMachineResult {
  const { bottom, top } = thresholds;
  const topTrigger = direction === 'increasing' ? top - HYSTERESIS_TOLERANCE_DEG : top + HYSTERESIS_TOLERANCE_DEG;
  const bottomTrigger =
    direction === 'increasing' ? bottom + HYSTERESIS_TOLERANCE_DEG : bottom - HYSTERESIS_TOLERANCE_DEG;

  let endpoint = prev.endpoint;
  let repCompleted = false;
  let completedRepTiming: CompletedRepTiming | null = null;

  const minAngleThisRep = Math.min(prev.minAngleThisRep, angle);
  const maxAngleThisRep = Math.max(prev.maxAngleThisRep, angle);

  const crossedToTop = direction === 'increasing' ? angle > topTrigger : angle < topTrigger;
  const crossedToBottom = direction === 'increasing' ? angle < bottomTrigger : angle > bottomTrigger;

  if (prev.endpoint === 'bottom' && crossedToTop) {
    endpoint = 'top';
  } else if (prev.endpoint === 'top' && crossedToBottom) {
    endpoint = 'bottom';
    repCompleted = true;
    completedRepTiming = {
      risingMs: prev.risingStartMs === null ? null : timestampMs - prev.risingStartMs,
      fallingMs: prev.fallingStartMs === null ? null : timestampMs - prev.fallingStartMs,
      romDegrees: Math.abs(maxAngleThisRep - minAngleThisRep),
    };
  }

  const isStable = angularVelocityDegPerSec === null || Math.abs(angularVelocityDegPerSec) < STABLE_DEG_PER_SEC;
  // Instantaneous motion headed toward the top threshold, independent of which
  // endpoint we're nominally at — this is what distinguishes rising and falling.
  const headingTowardTop =
    angularVelocityDegPerSec !== null &&
    (direction === 'increasing' ? angularVelocityDegPerSec > 0 : angularVelocityDegPerSec < 0);

  let phase: MovementPhase;
  if (isStable) {
    phase = endpoint === 'top' ? 'peak' : 'start';
  } else if (headingTowardTop) {
    phase = 'rising';
  } else {
    phase = 'falling';
  }

  const risingStartMs = phase === 'rising' && prev.phase !== 'rising' ? timestampMs : prev.risingStartMs;
  const fallingStartMs = phase === 'falling' && prev.phase !== 'falling' ? timestampMs : prev.fallingStartMs;

  const nextState: RepMachineState = {
    endpoint,
    phase,
    count: repCompleted ? prev.count + 1 : prev.count,
    risingStartMs: repCompleted ? null : risingStartMs,
    fallingStartMs: repCompleted ? null : fallingStartMs,
    minAngleThisRep: repCompleted ? angle : minAngleThisRep,
    maxAngleThisRep: repCompleted ? angle : maxAngleThisRep,
  };

  return { state: nextState, repCompleted, completedRepTiming };
}
