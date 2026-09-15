import { scoreRep, type RepScoringInput } from '../formScoring';
import type { CompletedRepTiming } from '../repStateMachine';
import type { ScoringWeights, TempoTarget } from '../exerciseVisionConfigs/types';

const EVEN_WEIGHTS: ScoringWeights = { rom: 0.2, stability: 0.2, alignment: 0.2, tempo: 0.2, symmetry: 0.2 };
const IDEAL_TEMPO: TempoTarget = { concentricMs: 700, eccentricMs: 1500 };

function baseInput(overrides: Partial<RepScoringInput> = {}): RepScoringInput {
  const timing: CompletedRepTiming = { risingMs: 700, fallingMs: 1500, romDegrees: 130 };
  return {
    repNumber: 1,
    timing,
    minRomDegrees: 100,
    concentricDirection: 'towardTop',
    idealTempo: IDEAL_TEMPO,
    scoringWeights: EVEN_WEIGHTS,
    ruleViolations: [],
    symmetryRatio: 1,
    stabilityJitterDegrees: 0,
    ...overrides,
  };
}

describe('scoreRep', () => {
  it('scores a clean, full-ROM, on-tempo, symmetric rep near 100', () => {
    const analysis = scoreRep(baseInput());
    expect(analysis.overallScore).toBeGreaterThanOrEqual(95);
    expect(analysis.violations).toHaveLength(0);
  });

  it('caps romScore at 100 even when ROM exceeds the minimum', () => {
    const analysis = scoreRep(baseInput({ timing: { risingMs: 700, fallingMs: 1500, romDegrees: 999 } }));
    expect(analysis.romScore).toBe(100);
  });

  it('scores partial ROM proportionally', () => {
    const analysis = scoreRep(baseInput({ timing: { risingMs: 700, fallingMs: 1500, romDegrees: 50 } }));
    expect(analysis.romScore).toBe(50);
  });

  it('penalizes alignment for each active rule violation, errors more than warnings', () => {
    const withError = scoreRep(
      baseInput({ ruleViolations: [{ id: 'knee-cave', message: 'x', severity: 'error', priority: 0 }] }),
    );
    const withWarning = scoreRep(
      baseInput({ ruleViolations: [{ id: 'depth', message: 'x', severity: 'warning', priority: 100 }] }),
    );
    expect(withError.alignmentScore).toBeLessThan(withWarning.alignmentScore);
    expect(withError.alignmentScore).toBe(75);
    expect(withWarning.alignmentScore).toBe(90);
  });

  it('maps concentric/eccentric duration by concentricDirection, not always rising-is-concentric', () => {
    // A squat-shaped rep: fast rise (fast, uncontrolled descent) + slow fall (a
    // controlled stand-up drive) — concentricDirection 'towardBottom' means the
    // "fall" (rising->top->falling->bottom) duration is what's scored as concentric.
    const towardTop = scoreRep(
      baseInput({
        concentricDirection: 'towardTop',
        timing: { risingMs: 200, fallingMs: 1600, romDegrees: 130 },
      }),
    );
    const towardBottom = scoreRep(
      baseInput({
        concentricDirection: 'towardBottom',
        timing: { risingMs: 200, fallingMs: 1600, romDegrees: 130 },
      }),
    );
    // Same raw timings, opposite concentricDirection, should give different tempo scores
    // since which duration is judged against which ideal target flips.
    expect(towardTop.tempoScore).not.toBe(towardBottom.tempoScore);
  });

  it('injects a "control the eccentric" violation when the eccentric phase is too fast', () => {
    const analysis = scoreRep(baseInput({ timing: { risingMs: 700, fallingMs: 200, romDegrees: 130 } }));
    expect(analysis.violations.some((v) => v.id === 'control-eccentric')).toBe(true);
  });

  it('does not inject the eccentric-control violation for a well-controlled rep', () => {
    const analysis = scoreRep(baseInput());
    expect(analysis.violations.some((v) => v.id === 'control-eccentric')).toBe(false);
  });

  it('injects an asymmetry violation when the symmetry ratio is low', () => {
    const analysis = scoreRep(baseInput({ symmetryRatio: 0.5 }));
    expect(analysis.violations.some((v) => v.id === 'asymmetric-movement')).toBe(true);
    expect(analysis.symmetryScore).toBe(50);
  });

  it('treats a null symmetryRatio as fully symmetric (not every exercise tracks both sides)', () => {
    const analysis = scoreRep(baseInput({ symmetryRatio: null }));
    expect(analysis.symmetryScore).toBe(100);
    expect(analysis.violations.some((v) => v.id === 'asymmetric-movement')).toBe(false);
  });

  it('treats null stability jitter as perfectly stable', () => {
    const analysis = scoreRep(baseInput({ stabilityJitterDegrees: null }));
    expect(analysis.stabilityScore).toBe(100);
  });

  it('penalizes stability proportionally to jitter', () => {
    const analysis = scoreRep(baseInput({ stabilityJitterDegrees: 10 }));
    expect(analysis.stabilityScore).toBe(60);
  });

  it('produces a valid 0-100 overallScore even when weights do not sum to exactly 1', () => {
    const skewedWeights: ScoringWeights = { rom: 1, stability: 1, alignment: 1, tempo: 1, symmetry: 1 };
    const analysis = scoreRep(baseInput({ scoringWeights: skewedWeights }));
    expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
    expect(analysis.overallScore).toBeLessThanOrEqual(100);
  });
});
