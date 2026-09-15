import { calculateAngle, getMidpoint, getTorsoLean } from '../biomechanics';
import type { VisionExerciseConfig } from './types';

export const lateralRaiseConfig: VisionExerciseConfig = {
  id: 'shoulder_abduction',
  name: 'Lateral Raise',
  recommendedCameraAngle: 'front',
  requiredJoints: ['rightShoulder', 'rightWrist', 'leftHip', 'rightHip'],
  getAngle: (joints) => calculateAngle(getMidpoint(joints.leftHip, joints.rightHip), joints.rightShoulder, joints.rightWrist),
  getAngleLeft: (joints) => calculateAngle(getMidpoint(joints.leftHip, joints.rightHip), joints.leftShoulder, joints.leftWrist),
  getAngleRight: (joints) => calculateAngle(getMidpoint(joints.leftHip, joints.rightHip), joints.rightShoulder, joints.rightWrist),
  direction: 'increasing',
  thresholds: { bottom: 15, top: 85 },
  minRomDegrees: 55,
  concentricDirection: 'towardTop',
  idealTempo: { concentricMs: 900, eccentricMs: 1500 },
  scoringWeights: { rom: 0.25, stability: 0.15, alignment: 0.25, tempo: 0.15, symmetry: 0.2 },
  formRules: [
    {
      id: 'too-high',
      message: "Don't raise above shoulder height.",
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle) => angle > 100,
    },
    {
      id: 'momentum',
      message: "Don't swing your torso.",
      severity: 'error',
      persistMs: 300,
      check: (joints) => getTorsoLean(joints) > 12,
    },
    {
      id: 'partial-raise',
      message: 'Raise to shoulder height.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'peak' && angle < 70,
    },
  ],
};
