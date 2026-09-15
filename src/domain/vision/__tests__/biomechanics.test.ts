import {
  calculateAngle,
  calculateAngle3D,
  getBodyScale,
  getSymmetryRatio,
  getTorsoLean,
  normalizedDistance,
  VelocityTracker,
} from '../biomechanics';
import type { Landmark } from '../landmarks';

function makeLandmark(x: number, y: number, z = 0, visibility = 0.9): Landmark {
  return { x, y, z, visibility };
}

describe('calculateAngle', () => {
  it('returns 90 degrees for a right-angled triangle', () => {
    const shoulder = makeLandmark(0, 0);
    const elbow = makeLandmark(1, 0);
    const wrist = makeLandmark(1, 1);
    expect(calculateAngle(shoulder, elbow, wrist)).toBeCloseTo(90);
  });

  it('returns 180 degrees for a straight line', () => {
    expect(calculateAngle(makeLandmark(0, 0), makeLandmark(1, 0), makeLandmark(2, 0))).toBeCloseTo(180);
  });

  it('returns 0 degrees for a fully closed joint', () => {
    expect(calculateAngle(makeLandmark(0, 0), makeLandmark(1, 1), makeLandmark(0, 0))).toBeCloseTo(0);
  });
});

describe('calculateAngle3D', () => {
  it('matches the 2D result when z is flat', () => {
    const a = makeLandmark(0, 0, 0);
    const b = makeLandmark(1, 0, 0);
    const c = makeLandmark(1, 1, 0);
    expect(calculateAngle3D(a, b, c)).toBeCloseTo(90);
  });

  it('returns 0 for a degenerate (zero-length) segment', () => {
    expect(calculateAngle3D(makeLandmark(0, 0), makeLandmark(0, 0), makeLandmark(1, 1))).toBe(0);
  });
});

describe('getTorsoLean', () => {
  it('reads 0 when shoulders sit directly above hips', () => {
    const joints = {
      leftShoulder: makeLandmark(-0.1, 0),
      rightShoulder: makeLandmark(0.1, 0),
      leftHip: makeLandmark(-0.1, 1),
      rightHip: makeLandmark(0.1, 1),
    } as any;
    expect(getTorsoLean(joints)).toBeCloseTo(0, 0);
  });

  it('reads close to 90 when leaning fully horizontal', () => {
    const joints = {
      leftShoulder: makeLandmark(-0.1, 0.5),
      rightShoulder: makeLandmark(0.1, 0.5),
      leftHip: makeLandmark(-1.1, 0.5),
      rightHip: makeLandmark(-0.9, 0.5),
    } as any;
    expect(getTorsoLean(joints)).toBeCloseTo(90, 0);
  });
});

describe('getSymmetryRatio', () => {
  it('is 1 for identical angles', () => {
    expect(getSymmetryRatio(45, 45)).toBe(1);
  });

  it('is 1 when both angles are 0', () => {
    expect(getSymmetryRatio(0, 0)).toBe(1);
  });

  it('is proportionally lower for a bigger left/right gap', () => {
    expect(getSymmetryRatio(50, 100)).toBeCloseTo(0.5);
  });
});

describe('getBodyScale / normalizedDistance', () => {
  it('scales the same real-world deviation down for a closer (larger-in-frame) subject', () => {
    const farJoints = {
      leftShoulder: makeLandmark(-0.05, 0.3),
      rightShoulder: makeLandmark(0.05, 0.3),
      leftHip: makeLandmark(-0.05, 0.5),
      rightHip: makeLandmark(0.05, 0.5),
    } as any;
    const closeJoints = {
      leftShoulder: makeLandmark(-0.15, 0.3),
      rightShoulder: makeLandmark(0.15, 0.3),
      leftHip: makeLandmark(-0.15, 0.9),
      rightHip: makeLandmark(0.15, 0.9),
    } as any;

    expect(getBodyScale(closeJoints)).toBeGreaterThan(getBodyScale(farJoints));

    // The same raw pixel-space offset is a smaller fraction of body scale up close.
    const offset = 0.05;
    const farKnee = makeLandmark(farJoints.rightHip.x + offset, farJoints.rightHip.y);
    const closeKnee = makeLandmark(closeJoints.rightHip.x + offset, closeJoints.rightHip.y);
    const farNormalized = normalizedDistance(farKnee, farJoints.rightHip, farJoints);
    const closeNormalized = normalizedDistance(closeKnee, closeJoints.rightHip, closeJoints);
    expect(closeNormalized).toBeLessThan(farNormalized);
  });
});

describe('VelocityTracker', () => {
  it('returns null on the first update', () => {
    const tracker = new VelocityTracker();
    expect(tracker.update(90, 1000)).toBeNull();
  });

  it('computes signed degrees-per-second between two calls', () => {
    const tracker = new VelocityTracker();
    tracker.update(90, 1000);
    const velocity = tracker.update(100, 1100);
    expect(velocity).toBeCloseTo(100); // +10deg over 0.1s = 100deg/s
  });

  it('reports a negative velocity when the angle decreases', () => {
    const tracker = new VelocityTracker();
    tracker.update(100, 1000);
    const velocity = tracker.update(90, 1100);
    expect(velocity).toBeCloseTo(-100);
  });

  it('resets cleanly', () => {
    const tracker = new VelocityTracker();
    tracker.update(90, 1000);
    tracker.reset();
    expect(tracker.update(90, 2000)).toBeNull();
  });
});
