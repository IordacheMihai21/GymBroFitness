import {
  cameraAngleMismatchMessage,
  detectCameraOrientation,
  isCameraAngleMismatched,
} from '../cameraOrientation';
import type { KeyJoints, Landmark } from '../landmarks';

function makeLandmark(x: number, y: number): Landmark {
  return { x, y, z: 0, visibility: 0.9 };
}

function makeJoints(shoulderHalfWidth: number, torsoSpan: number): KeyJoints {
  return {
    leftShoulder: makeLandmark(-shoulderHalfWidth, 0),
    rightShoulder: makeLandmark(shoulderHalfWidth, 0),
    leftHip: makeLandmark(-shoulderHalfWidth, torsoSpan),
    rightHip: makeLandmark(shoulderHalfWidth, torsoSpan),
  } as unknown as KeyJoints;
}

describe('detectCameraOrientation', () => {
  it('reads as front-on when the shoulders are clearly separated relative to body scale', () => {
    // Shoulder width 0.2 (span 0.2), torso span 0.2 -> body scale 0.2, ratio 1.0.
    expect(detectCameraOrientation(makeJoints(0.1, 0.2))).toBe('front');
  });

  it('reads as side-on when the shoulders nearly coincide relative to body scale', () => {
    // Shoulder width 0.02 (span 0.02), torso span 0.3 -> ratio ~0.067.
    expect(detectCameraOrientation(makeJoints(0.01, 0.3))).toBe('side');
  });

  it('reads as front-45 for an in-between separation', () => {
    // Shoulder width 0.08 (span 0.08), torso span 0.25 -> ratio 0.32.
    expect(detectCameraOrientation(makeJoints(0.04, 0.25))).toBe('front-45');
  });
});

describe('isCameraAngleMismatched', () => {
  it('is false when the detected orientation matches the recommendation exactly', () => {
    expect(isCameraAngleMismatched('side', 'side')).toBe(false);
    expect(isCameraAngleMismatched('front', 'front')).toBe(false);
  });

  it('is true for a clear front/side mismatch', () => {
    expect(isCameraAngleMismatched('front', 'side')).toBe(true);
    expect(isCameraAngleMismatched('side', 'front')).toBe(true);
  });

  it('treats front-45 as compatible with either neighbor', () => {
    expect(isCameraAngleMismatched('front-45', 'side')).toBe(false);
    expect(isCameraAngleMismatched('front-45', 'front')).toBe(false);
    expect(isCameraAngleMismatched('front', 'front-45')).toBe(false);
    expect(isCameraAngleMismatched('side', 'front-45')).toBe(false);
  });
});

describe('cameraAngleMismatchMessage', () => {
  it('gives distinct, actionable copy per recommended angle', () => {
    expect(cameraAngleMismatchMessage('front')).toMatch(/face the camera/i);
    expect(cameraAngleMismatchMessage('side')).toMatch(/side-on/i);
    expect(cameraAngleMismatchMessage('front-45')).toMatch(/45/);
  });
});
