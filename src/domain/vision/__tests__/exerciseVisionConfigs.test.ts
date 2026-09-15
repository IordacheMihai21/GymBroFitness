import { curlConfig } from '../exerciseVisionConfigs/curl';
import { lateralRaiseConfig } from '../exerciseVisionConfigs/lateralRaise';
import { overheadPressConfig } from '../exerciseVisionConfigs/overheadPress';
import { pushUpConfig } from '../exerciseVisionConfigs/pushUp';
import { squatConfig } from '../exerciseVisionConfigs/squat';
import { getVisionConfigForMovementPattern, VISION_EXERCISE_CONFIGS } from '../exerciseVisionConfigs';
import type { KeyJoints, Landmark } from '../landmarks';

function L(x: number, y: number, visibility = 0.9): Landmark {
  return { x, y, z: 0, visibility };
}

/** A neutral standing pose: shoulders above hips above knees above ankles, arms straight down at the sides. */
function neutralStandingJoints(overrides: Partial<KeyJoints> = {}): KeyJoints {
  const joints: KeyJoints = {
    nose: L(0, -0.6),
    leftEye: L(-0.02, -0.62),
    rightEye: L(0.02, -0.62),
    leftEar: L(-0.05, -0.6),
    rightEar: L(0.05, -0.6),
    leftShoulder: L(-0.15, -0.4),
    rightShoulder: L(0.15, -0.4),
    leftElbow: L(-0.17, -0.1),
    rightElbow: L(0.17, -0.1),
    leftWrist: L(-0.19, 0.2),
    rightWrist: L(0.19, 0.2),
    leftHip: L(-0.1, 0),
    rightHip: L(0.1, 0),
    leftKnee: L(-0.1, 0.4),
    rightKnee: L(0.1, 0.4),
    leftAnkle: L(-0.1, 0.8),
    rightAnkle: L(0.1, 0.8),
  };
  return { ...joints, ...overrides };
}

describe('registry', () => {
  it('registers exactly the 5 initial movement patterns', () => {
    expect(Object.keys(VISION_EXERCISE_CONFIGS).sort()).toEqual(
      ['elbow_flexion', 'horizontal_push', 'shoulder_abduction', 'squat', 'vertical_push'].sort(),
    );
  });

  it('resolves a config by movement pattern', () => {
    expect(getVisionConfigForMovementPattern('elbow_flexion')?.name).toBe('Bicep Curl');
  });

  it('returns undefined for a pattern with no vision config yet', () => {
    expect(getVisionConfigForMovementPattern('hip_hinge')).toBeUndefined();
  });
});

describe('curlConfig', () => {
  it('reads a large angle for an extended arm and a small angle for a flexed one', () => {
    const extended = neutralStandingJoints();
    const flexed = neutralStandingJoints({
      rightElbow: L(0.15, -0.4 + 0.3),
      rightWrist: L(0.15, -0.4 + 0.05),
    });
    expect(curlConfig.getAngle(extended)).toBeGreaterThan(curlConfig.getAngle(flexed));
    // direction is 'decreasing': the top (flexed) threshold must be the smaller value.
    expect(curlConfig.thresholds.top).toBeLessThan(curlConfig.thresholds.bottom);
  });

  it('flags torso lean as body-swing', () => {
    const swinging = neutralStandingJoints({
      leftShoulder: L(-0.45, -0.4),
      rightShoulder: L(-0.15, -0.4),
    });
    const rule = curlConfig.formRules.find((r) => r.id === 'body-swing')!;
    expect(rule.check(swinging, 90, 'rising')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 90, 'rising')).toBe(false);
  });

  it('flags an elbow drifting away from the torso', () => {
    const drifted = neutralStandingJoints({ rightElbow: L(0.55, -0.1) });
    const rule = curlConfig.formRules.find((r) => r.id === 'elbow-drift')!;
    expect(rule.check(drifted, 90, 'rising')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 90, 'rising')).toBe(false);
  });
});

describe('squatConfig', () => {
  it('reads a large angle standing and a small angle squatted', () => {
    const standing = neutralStandingJoints();
    const squatted = neutralStandingJoints({
      rightHip: L(0.1, -0.1),
      rightKnee: L(0.15, 0.3),
      rightAnkle: L(0.1, 0.8),
    });
    expect(squatConfig.getAngle(standing)).toBeGreaterThan(squatConfig.getAngle(squatted));
  });

  it('flags a knee caving in past the ankle', () => {
    const caved = neutralStandingJoints({ rightKnee: L(0.3, 0.4), rightAnkle: L(0.1, 0.8) });
    const rule = squatConfig.formRules.find((r) => r.id === 'knee-cave')!;
    expect(rule.check(caved, 100, 'peak')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 100, 'peak')).toBe(false);
  });

  it('flags forward torso lean', () => {
    const leaning = neutralStandingJoints({
      leftShoulder: L(-0.55, -0.4),
      rightShoulder: L(-0.25, -0.4),
    });
    const rule = squatConfig.formRules.find((r) => r.id === 'forward-lean')!;
    expect(rule.check(leaning, 100, 'rising')).toBe(true);
  });

  it('flags shallow depth only at the peak phase', () => {
    const rule = squatConfig.formRules.find((r) => r.id === 'depth')!;
    expect(rule.check(neutralStandingJoints(), 100, 'peak')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 100, 'rising')).toBe(false);
  });
});

describe('lateralRaiseConfig', () => {
  it('reads a small angle at the sides and a large angle raised', () => {
    const atSides = neutralStandingJoints();
    const raised = neutralStandingJoints({ rightWrist: L(0.5, -0.4), rightElbow: L(0.35, -0.4) });
    expect(lateralRaiseConfig.getAngle(raised)).toBeGreaterThan(lateralRaiseConfig.getAngle(atSides));
  });

  it('flags raising the torso-swing momentum cue on lean', () => {
    const swinging = neutralStandingJoints({
      leftShoulder: L(-0.45, -0.4),
      rightShoulder: L(-0.15, -0.4),
    });
    const rule = lateralRaiseConfig.formRules.find((r) => r.id === 'momentum')!;
    expect(rule.check(swinging, 60, 'rising')).toBe(true);
  });

  it('flags raising above shoulder height', () => {
    const rule = lateralRaiseConfig.formRules.find((r) => r.id === 'too-high')!;
    expect(rule.check(neutralStandingJoints(), 130, 'peak')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 80, 'peak')).toBe(false);
  });
});

describe('pushUpConfig', () => {
  it('reads a large angle in plank and a small angle at the bottom', () => {
    const plank = neutralStandingJoints();
    const bottom = neutralStandingJoints({ rightElbow: L(0.3, -0.35), rightWrist: L(0.15, -0.3) });
    expect(pushUpConfig.getAngle(plank)).toBeGreaterThan(pushUpConfig.getAngle(bottom));
  });

  it('flags sagging hips', () => {
    const sagging = neutralStandingJoints({ rightHip: L(0.1, 0.35) });
    const rule = pushUpConfig.formRules.find((r) => r.id === 'hip-sag')!;
    expect(rule.check(sagging, 100, 'peak')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 100, 'peak')).toBe(false);
  });

  it('flags a piked (hips too high) position', () => {
    const piked = neutralStandingJoints({ rightHip: L(0.1, -0.35) });
    const rule = pushUpConfig.formRules.find((r) => r.id === 'hip-pike')!;
    expect(rule.check(piked, 100, 'peak')).toBe(true);
  });
});

describe('overheadPressConfig', () => {
  it('reads a small angle at the shoulders and a large angle locked out overhead', () => {
    const racked = neutralStandingJoints({ rightElbow: L(0.15, -0.4), rightWrist: L(0.15, -0.2) });
    const lockedOut = neutralStandingJoints({ rightElbow: L(0.15, -0.8), rightWrist: L(0.15, -1.1) });
    expect(overheadPressConfig.getAngle(lockedOut)).toBeGreaterThan(overheadPressConfig.getAngle(racked));
  });

  it('flags leaning back', () => {
    const leaningBack = neutralStandingJoints({
      leftShoulder: L(0.15, -0.4),
      rightShoulder: L(0.45, -0.4),
    });
    const rule = overheadPressConfig.formRules.find((r) => r.id === 'lean-back')!;
    expect(rule.check(leaningBack, 150, 'rising')).toBe(true);
    expect(rule.check(neutralStandingJoints(), 150, 'rising')).toBe(false);
  });
});
