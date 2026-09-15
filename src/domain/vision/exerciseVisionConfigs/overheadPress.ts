import { calculateAngle, getTorsoLean } from '../biomechanics';
import type { VisionExerciseConfig } from './types';

export const overheadPressConfig: VisionExerciseConfig = {
  id: 'vertical_push',
  name: 'Overhead Press',
  recommendedCameraAngle: 'front-45',
  requiredJoints: ['rightShoulder', 'rightElbow', 'rightHip', 'leftHip'],
  getAngle: (joints) => calculateAngle(joints.rightHip, joints.rightShoulder, joints.rightElbow),
  getAngleLeft: (joints) => calculateAngle(joints.leftHip, joints.leftShoulder, joints.leftElbow),
  getAngleRight: (joints) => calculateAngle(joints.rightHip, joints.rightShoulder, joints.rightElbow),
  direction: 'increasing',
  thresholds: { bottom: 90, top: 170 },
  minRomDegrees: 60,
  concentricDirection: 'towardTop',
  idealTempo: { concentricMs: 800, eccentricMs: 1500 },
  scoringWeights: { rom: 0.25, stability: 0.15, alignment: 0.35, tempo: 0.15, symmetry: 0.1 },
  formRules: [
    {
      id: 'lean-back',
      message: "Don't lean back — brace your core.",
      severity: 'error',
      persistMs: 300,
      check: (joints) => getTorsoLean(joints) > 15,
    },
    {
      id: 'partial-lockout',
      message: 'Fully extend your arms.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'peak' && angle < 155,
    },
  ],
};
