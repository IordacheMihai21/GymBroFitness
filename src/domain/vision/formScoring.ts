import type { CompletedRepTiming } from './repStateMachine';
import type { FormViolation } from './feedbackPriority';
import { resolvePriority } from './feedbackPriority';
import type { ScoringWeights, TempoTarget, VisionExerciseConfig } from './exerciseVisionConfigs/types';

export interface RepAnalysis {
  repNumber: number;
  romScore: number;
  stabilityScore: number;
  alignmentScore: number;
  tempoScore: number;
  symmetryScore: number;
  violations: FormViolation[];
  overallScore: number;
}

export interface RepScoringInput {
  repNumber: number;
  timing: CompletedRepTiming;
  minRomDegrees: number;
  concentricDirection: VisionExerciseConfig['concentricDirection'];
  idealTempo: TempoTarget;
  scoringWeights: ScoringWeights;
  /** Violations from the exercise's per-frame form rules, confirmed active at any point during this rep (deduped by id). */
  ruleViolations: FormViolation[];
  /** Left/right symmetry ratio (0-1) for this rep, or null when the exercise doesn't track both sides / tracking was insufficient. */
  symmetryRatio: number | null;
  /** How much the angle wobbled during the peak hold, in degrees — null when not measured. */
  stabilityJitterDegrees: number | null;
}

const clamp0to100 = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

function scoreRom(romDegrees: number, minRomDegrees: number): number {
  if (minRomDegrees <= 0) return 100;
  return clamp0to100((romDegrees / minRomDegrees) * 100);
}

/** 100 at or beyond the ideal duration (full control); linearly penalized for being faster (rushed/momentum-driven). */
function scoreTempoPhase(actualMs: number | null, idealMs: number): number {
  if (actualMs === null || idealMs <= 0) return 70;
  const ratio = actualMs / idealMs;
  if (ratio >= 1) return 100;
  return clamp0to100(ratio * 100);
}

function scoreAlignment(ruleViolations: FormViolation[]): number {
  const errorCount = ruleViolations.filter((v) => v.severity === 'error').length;
  const warningCount = ruleViolations.filter((v) => v.severity === 'warning').length;
  return clamp0to100(100 - errorCount * 25 - warningCount * 10);
}

function scoreStability(jitterDegrees: number | null): number {
  if (jitterDegrees === null) return 100;
  return clamp0to100(100 - jitterDegrees * 4);
}

function scoreSymmetry(symmetryRatio: number | null): number {
  if (symmetryRatio === null) return 100;
  return clamp0to100(symmetryRatio * 100);
}

function makeSyntheticViolation(id: string, message: string, severity: FormViolation['severity']): FormViolation {
  return { id, message, severity, priority: resolvePriority(severity) };
}

export function scoreRep(input: RepScoringInput): RepAnalysis {
  const concentricMs = input.concentricDirection === 'towardTop' ? input.timing.risingMs : input.timing.fallingMs;
  const eccentricMs = input.concentricDirection === 'towardTop' ? input.timing.fallingMs : input.timing.risingMs;

  const romScore = scoreRom(input.timing.romDegrees, input.minRomDegrees);
  const concentricTempo = scoreTempoPhase(concentricMs, input.idealTempo.concentricMs);
  const eccentricTempo = scoreTempoPhase(eccentricMs, input.idealTempo.eccentricMs);
  const tempoScore = clamp0to100(concentricTempo * 0.4 + eccentricTempo * 0.6);
  const alignmentScore = scoreAlignment(input.ruleViolations);
  const stabilityScore = scoreStability(input.stabilityJitterDegrees);
  const symmetryScore = scoreSymmetry(input.symmetryRatio);

  const violations = [...input.ruleViolations];
  if (eccentricTempo < 60) {
    violations.push(makeSyntheticViolation('control-eccentric', 'Control the eccentric.', 'warning'));
  }
  if (symmetryScore < 75) {
    violations.push(makeSyntheticViolation('asymmetric-movement', 'Your movement is asymmetric.', 'warning'));
  }

  const w = input.scoringWeights;
  const weightSum = w.rom + w.stability + w.alignment + w.tempo + w.symmetry || 1;
  const overallScore = clamp0to100(
    (romScore * w.rom +
      stabilityScore * w.stability +
      alignmentScore * w.alignment +
      tempoScore * w.tempo +
      symmetryScore * w.symmetry) /
      weightSum,
  );

  return {
    repNumber: input.repNumber,
    romScore,
    stabilityScore,
    alignmentScore,
    tempoScore,
    symmetryScore,
    violations,
    overallScore,
  };
}
