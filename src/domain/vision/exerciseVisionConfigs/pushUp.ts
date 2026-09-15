import { calculateAngle, getMidpoint, normalizedVerticalOffset } from '../biomechanics';
import type { VisionExerciseConfig } from './types';

export const pushUpConfig: VisionExerciseConfig = {
  id: 'horizontal_push',
  name: 'Push-Up',
  recommendedCameraAngle: 'side',
  requiredJoints: ['rightShoulder', 'rightElbow', 'rightWrist', 'rightHip', 'rightAnkle'],
  getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
  getAngleLeft: (joints) => calculateAngle(joints.leftShoulder, joints.leftElbow, joints.leftWrist),
  getAngleRight: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
  direction: 'decreasing',
  thresholds: { bottom: 160, top: 60 },
  minRomDegrees: 70,
  // The rep starts in a plank (bottom), lowers to chest-near-floor (top),
  // then presses back up to plank — that press is the concentric
  // (chest/triceps-shortening) phase, and it runs top -> bottom.
  concentricDirection: 'towardBottom',
  idealTempo: { concentricMs: 700, eccentricMs: 1500 },
  scoringWeights: { rom: 0.25, stability: 0.2, alignment: 0.35, tempo: 0.1, symmetry: 0.1 },
  formRules: [
    {
      id: 'hip-sag',
      message: "Don't sag your hips — tighten your core.",
      severity: 'error',
      persistMs: 300,
      check: (joints) => {
        const shoulderAnkleMid = getMidpoint(joints.rightShoulder, joints.rightAnkle);
        return normalizedVerticalOffset(joints.rightHip, shoulderAnkleMid, joints) > 0.18;
      },
    },
    {
      id: 'hip-pike',
      message: "Don't pike your hips — keep your body straight.",
      severity: 'error',
      persistMs: 300,
      check: (joints) => {
        const shoulderAnkleMid = getMidpoint(joints.rightShoulder, joints.rightAnkle);
        return normalizedVerticalOffset(joints.rightHip, shoulderAnkleMid, joints) < -0.18;
      },
    },
    {
      id: 'partial-rep',
      message: 'Go deeper.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'peak' && angle > 90,
    },
    {
      id: 'partial-lockout',
      message: 'Fully extend your arms.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'start' && angle < 145,
    },
  ],
};
