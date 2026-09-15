import { VelocityTracker } from '../biomechanics';
import {
  createInitialRepMachineState,
  updateRepMachine,
  type RepMachineResult,
  type RepMachineState,
  type RepThresholds,
  type ThresholdDirection,
} from '../repStateMachine';

const FRAME_MS = 1000 / 30;

/** Drives the state machine through a sequence of angles, exactly as real per-frame usage would. */
function runSequence(
  angles: number[],
  direction: ThresholdDirection,
  thresholds: RepThresholds,
): { results: RepMachineResult[]; finalState: RepMachineState } {
  const velocityTracker = new VelocityTracker();
  let state = createInitialRepMachineState();
  const results: RepMachineResult[] = [];
  angles.forEach((angle, i) => {
    const t = i * FRAME_MS;
    const velocity = velocityTracker.update(angle, t);
    const result = updateRepMachine(state, angle, velocity, direction, thresholds, t);
    state = result.state;
    results.push(result);
  });
  return { results, finalState: state };
}

/** A curl-shaped rep: rest -> flex -> hold -> extend -> rest, with a few repeats. */
function curlRepAngles(reps: number): number[] {
  const down = [160, 158];
  const rising = [140, 120, 100, 80, 60, 40, 25];
  const hold = [25, 25, 25];
  const falling = [40, 60, 80, 100, 120, 140, 155, 162];
  const settle = [160, 160];
  const oneRep = [...rising, ...hold, ...falling];
  return [...down, ...Array(reps).fill(oneRep).flat(), ...settle];
}

const CURL_THRESHOLDS: RepThresholds = { bottom: 160, top: 30 };

describe('updateRepMachine — curl (decreasing direction)', () => {
  it('counts exactly one rep for one full flex/extend cycle', () => {
    const { finalState } = runSequence(curlRepAngles(1), 'decreasing', CURL_THRESHOLDS);
    expect(finalState.count).toBe(1);
  });

  it('counts multiple distinct reps without double-counting', () => {
    const { finalState } = runSequence(curlRepAngles(3), 'decreasing', CURL_THRESHOLDS);
    expect(finalState.count).toBe(3);
  });

  it('does not count a rep that never reaches the top threshold (hysteresis rejects noise)', () => {
    const noisyAngles = [160, 150, 140, 130, 120, 110, 100, 110, 120, 130, 140, 150, 160];
    const { finalState } = runSequence(noisyAngles, 'decreasing', CURL_THRESHOLDS);
    expect(finalState.count).toBe(0);
  });

  it('does not double-count small oscillations right at the top endpoint', () => {
    const angles = [160, 130, 100, 70, 40, 25, 28, 25, 29, 26, 40, 70, 100, 130, 162];
    const { finalState } = runSequence(angles, 'decreasing', CURL_THRESHOLDS);
    expect(finalState.count).toBe(1);
  });

  it('reports a rising phase while flexing and a falling phase while extending', () => {
    const { results } = runSequence(curlRepAngles(1), 'decreasing', CURL_THRESHOLDS);
    const phases = results.map((r) => r.state.phase);
    const risingIndex = phases.indexOf('rising');
    const fallingIndex = phases.indexOf('falling');
    expect(risingIndex).toBeGreaterThan(-1);
    expect(fallingIndex).toBeGreaterThan(risingIndex);
  });

  it('reaches a peak phase while holding at the top', () => {
    const { results } = runSequence(curlRepAngles(1), 'decreasing', CURL_THRESHOLDS);
    expect(results.some((r) => r.state.phase === 'peak')).toBe(true);
  });

  it('settles back into the start phase once resting at the bottom', () => {
    const { finalState } = runSequence(curlRepAngles(1), 'decreasing', CURL_THRESHOLDS);
    expect(finalState.phase).toBe('start');
  });

  it('produces non-null rising/falling timing and a plausible ROM on rep completion', () => {
    const { results } = runSequence(curlRepAngles(1), 'decreasing', CURL_THRESHOLDS);
    const completed = results.find((r) => r.repCompleted);
    expect(completed?.completedRepTiming).not.toBeNull();
    expect(completed?.completedRepTiming?.risingMs).toBeGreaterThan(0);
    expect(completed?.completedRepTiming?.fallingMs).toBeGreaterThan(0);
    expect(completed?.completedRepTiming?.romDegrees).toBeGreaterThan(100);
  });
});

const PRESS_THRESHOLDS: RepThresholds = { bottom: 90, top: 170 };

describe('updateRepMachine — overhead press (increasing direction)', () => {
  function pressRepAngles(): number[] {
    return [90, 92, 110, 130, 150, 165, 172, 174, 172, 165, 150, 130, 110, 92, 88];
  }

  it('counts one rep for a full press/return cycle', () => {
    const { finalState } = runSequence(pressRepAngles(), 'increasing', PRESS_THRESHOLDS);
    expect(finalState.count).toBe(1);
  });

  it('does not count a rep on partial-range noise', () => {
    const angles = [90, 100, 110, 120, 130, 120, 110, 100, 90];
    const { finalState } = runSequence(angles, 'increasing', PRESS_THRESHOLDS);
    expect(finalState.count).toBe(0);
  });
});

describe('updateRepMachine — state carries forward correctly across reps', () => {
  it('resets min/max angle tracking after each completed rep', () => {
    const { results } = runSequence(curlRepAngles(2), 'decreasing', CURL_THRESHOLDS);
    const completions = results.filter((r) => r.repCompleted);
    expect(completions).toHaveLength(2);
    // Both reps should report a comparable ROM — a leaked min/max from rep 1
    // would make rep 2's reported ROM implausibly large.
    const [first, second] = completions.map((r) => r.completedRepTiming!.romDegrees);
    expect(Math.abs(first - second)).toBeLessThan(15);
  });
});
