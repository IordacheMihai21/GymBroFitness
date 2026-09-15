import { calculateAngle, getTorsoLean, normalizedHorizontalOffset } from '../biomechanics';
import type { VisionExerciseConfig } from './types';

export const squatConfig: VisionExerciseConfig = {
  id: 'squat',
  name: 'Squat',
  recommendedCameraAngle: 'side',
  requiredJoints: ['rightHip', 'rightKnee', 'rightAnkle', 'rightShoulder'],
  getAngle: (joints) => calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle),
  getAngleLeft: (joints) => calculateAngle(joints.leftHip, joints.leftKnee, joints.leftAnkle),
  getAngleRight: (joints) => calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle),
  direction: 'decreasing',
  thresholds: { bottom: 160, top: 90 },
  minRomDegrees: 60,
  // The rep starts standing (bottom), descends to the squat's deepest point
  // (top), then drives back up to standing — that drive-up is the
  // concentric (quads/glutes-shortening) phase, and it runs top -> bottom.
  concentricDirection: 'towardBottom',
  idealTempo: { concentricMs: 800, eccentricMs: 1800 },
  scoringWeights: { rom: 0.3, stability: 0.15, alignment: 0.35, tempo: 0.1, symmetry: 0.1 },
  formRules: [
    {
      id: 'depth',
      message: 'Go deeper.',
      severity: 'warning',
      persistMs: 400,
      check: (_joints, angle, phase) => phase === 'peak' && angle > 95,
    },
    {
      id: 'knee-cave',
      message: 'Keep your knees tracking over your toes.',
      severity: 'error',
      persistMs: 300,
      check: (joints) => normalizedHorizontalOffset(joints.rightKnee, joints.rightAnkle, joints) > 0.12,
    },
    {
      id: 'forward-lean',
      message: 'Keep your chest up.',
      severity: 'error',
      persistMs: 300,
      check: (joints) => getTorsoLean(joints) > 35,
    },
  ],
};
