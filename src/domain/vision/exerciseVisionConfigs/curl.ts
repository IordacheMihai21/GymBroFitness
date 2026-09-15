import { calculateAngle, getTorsoLean, normalizedHorizontalOffset } from '../biomechanics';
import type { VisionExerciseConfig } from './types';

export const curlConfig: VisionExerciseConfig = {
  id: 'elbow_flexion',
  name: 'Bicep Curl',
  recommendedCameraAngle: 'front',
  requiredJoints: ['rightShoulder', 'rightElbow', 'rightWrist', 'leftHip', 'rightHip'],
  getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
  getAngleLeft: (joints) => calculateAngle(joints.leftShoulder, joints.leftElbow, joints.leftWrist),
  getAngleRight: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
  direction: 'decreasing',
  thresholds: { bottom: 160, top: 30 },
  minRomDegrees: 100,
  concentricDirection: 'towardTop',
  idealTempo: { concentricMs: 700, eccentricMs: 1500 },
  scoringWeights: { rom: 0.3, stability: 0.1, alignment: 0.35, tempo: 0.15, symmetry: 0.1 },
  formRules: [
    {
      id: 'body-swing',
      message: "Don't swing your torso.",
      severity: 'error',
      persistMs: 300,
      check: (joints) => getTorsoLean(joints) > 15,
    },
    {
      id: 'elbow-drift',
      message: 'Keep your elbows closer to your body.',
      severity: 'error',
      persistMs: 400,
      check: (joints) => Math.abs(normalizedHorizontalOffset(joints.rightElbow, joints.rightShoulder, joints)) > 0.35,
    },
    {
      id: 'partial-curl',
      message: 'Squeeze harder — curl all the way up.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'peak' && angle > 45,
    },
    {
      id: 'partial-extend',
      message: 'Fully extend your arms.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'start' && angle < 145,
    },
  ],
};
