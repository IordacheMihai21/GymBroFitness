import { assessTrackingQuality, hasRequiredJoints } from '../confidence';
import type { KeyJoints, Landmark } from '../landmarks';

function makeJoints(overrides: Partial<Record<keyof KeyJoints, number>> = {}): KeyJoints {
  const base = (visibility: number): Landmark => ({ x: 0, y: 0, z: 0, visibility });
  const names: (keyof KeyJoints)[] = [
    'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
    'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
    'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle',
  ];
  const joints = {} as KeyJoints;
  names.forEach((name) => {
    joints[name] = base(overrides[name] ?? 0.9);
  });
  return joints;
}

describe('assessTrackingQuality', () => {
  it('is lost when there are no joints at all', () => {
    expect(assessTrackingQuality(null)).toBe('lost');
  });

  it('is good when the full torso is confidently visible', () => {
    expect(assessTrackingQuality(makeJoints())).toBe('good');
  });

  it('is degraded when about half the torso joints drop out', () => {
    const joints = makeJoints({ leftShoulder: 0.1, leftHip: 0.1 });
    expect(assessTrackingQuality(joints)).toBe('degraded');
  });

  it('is lost when most torso joints drop below the visibility threshold', () => {
    const joints = makeJoints({ leftShoulder: 0.1, rightShoulder: 0.1, leftHip: 0.1 });
    expect(assessTrackingQuality(joints)).toBe('lost');
  });
});

describe('hasRequiredJoints', () => {
  it('is false when joints are null', () => {
    expect(hasRequiredJoints(null, ['rightElbow'])).toBe(false);
  });

  it('is true when every required joint clears the threshold', () => {
    expect(hasRequiredJoints(makeJoints(), ['rightShoulder', 'rightElbow', 'rightWrist'])).toBe(true);
  });

  it('is false when any single required joint is under-confident', () => {
    const joints = makeJoints({ rightWrist: 0.1 });
    expect(hasRequiredJoints(joints, ['rightShoulder', 'rightElbow', 'rightWrist'])).toBe(false);
  });
});
