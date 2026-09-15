import type { KeyJoints } from '../landmarks';
import type { MovementPhase, ThresholdDirection } from '../repStateMachine';
import type { MovementPattern } from '@/types';

/** Where to position the phone/camera for this movement to be trackable. */
export type CameraAngle = 'front' | 'side' | 'front-45';

export interface FormRule {
  id: string;
  message: string;
  severity: 'warning' | 'error';
  /** Lower fires first when multiple violations are active simultaneously. Defaults by severity (errors before warnings). */
  priority?: number;
  /** How long this must hold continuously true before it's surfaced (ms) — see temporalFilter.ts. */
  persistMs: number;
  check: (joints: KeyJoints, angle: number, phase: MovementPhase) => boolean;
}

export interface ScoringWeights {
  rom: number;
  stability: number;
  alignment: number;
  tempo: number;
  symmetry: number;
}

export interface TempoTarget {
  concentricMs: number;
  eccentricMs: number;
}

export interface VisionExerciseConfig {
  /** Keyed by movement pattern, not exercise slug — one config covers every equipment variant of the same movement (see docs/PLAN.md). */
  id: MovementPattern;
  name: string;
  recommendedCameraAngle: CameraAngle;
  requiredJoints: (keyof KeyJoints)[];
  /** Primary angle driving the rep state machine (the side tracked when only one side is visible). */
  getAngle: (joints: KeyJoints) => number;
  /** Present when both sides can be compared for a symmetry score. */
  getAngleLeft?: (joints: KeyJoints) => number;
  getAngleRight?: (joints: KeyJoints) => number;
  direction: ThresholdDirection;
  thresholds: { bottom: number; top: number };
  /** Minimum |top - bottom| angle delta for a rep to count as full range of motion. */
  minRomDegrees: number;
  /**
   * Which rep-machine motion direction is the true concentric (muscle-
   * shortening) phase. 'towardTop' for lift-first movements (curl, lateral
   * raise, overhead press — you move away from rest to reach the ROM's far
   * endpoint by contracting). 'towardBottom' for descend-first movements
   * (squat, push-up — the rep starts at the ROM's far endpoint, you lower
   * into rest first, then the concentric drive returns you to "bottom").
   */
  concentricDirection: 'towardTop' | 'towardBottom';
  idealTempo: TempoTarget;
  formRules: FormRule[];
  scoringWeights: ScoringWeights;
}
