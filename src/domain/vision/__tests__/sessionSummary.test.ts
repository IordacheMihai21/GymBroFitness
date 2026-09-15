import { buildSetSummary } from '../sessionSummary';
import type { RepAnalysis } from '../formScoring';

function makeRep(overrides: Partial<RepAnalysis> = {}): RepAnalysis {
  return {
    repNumber: 1,
    romScore: 90,
    stabilityScore: 90,
    alignmentScore: 90,
    tempoScore: 90,
    symmetryScore: 90,
    violations: [],
    overallScore: 90,
    ...overrides,
  };
}

describe('buildSetSummary', () => {
  it('handles an empty set without throwing', () => {
    const summary = buildSetSummary([]);
    expect(summary.reps).toBe(0);
    expect(summary.bestRep).toBeNull();
    expect(summary.worstRep).toBeNull();
    expect(summary.recommendations.length).toBeGreaterThan(0);
  });

  it('computes reps count and average score', () => {
    const summary = buildSetSummary([makeRep({ overallScore: 80 }), makeRep({ overallScore: 90 }), makeRep({ overallScore: 100 })]);
    expect(summary.reps).toBe(3);
    expect(summary.averageScore).toBe(90);
  });

  it('identifies the best and worst rep by overallScore', () => {
    const worst = makeRep({ repNumber: 1, overallScore: 40 });
    const best = makeRep({ repNumber: 2, overallScore: 99 });
    const mid = makeRep({ repNumber: 3, overallScore: 70 });
    const summary = buildSetSummary([worst, best, mid]);
    expect(summary.bestRep?.repNumber).toBe(2);
    expect(summary.worstRep?.repNumber).toBe(1);
  });

  it('finds the most frequent violation across all reps', () => {
    const summary = buildSetSummary([
      makeRep({ violations: [{ id: 'knee-cave', message: 'Keep your knees tracking over your toes.', severity: 'error', priority: 0 }] }),
      makeRep({ violations: [{ id: 'knee-cave', message: 'Keep your knees tracking over your toes.', severity: 'error', priority: 0 }] }),
      makeRep({ violations: [{ id: 'depth', message: 'Go deeper.', severity: 'warning', priority: 100 }] }),
    ]);
    expect(summary.mostCommonIssue).toBe('Keep your knees tracking over your toes.');
  });

  it('returns null mostCommonIssue when no rep had any violation', () => {
    const summary = buildSetSummary([makeRep(), makeRep()]);
    expect(summary.mostCommonIssue).toBeNull();
  });

  it('recommends fuller range of motion when average ROM score is low', () => {
    const summary = buildSetSummary([makeRep({ romScore: 50 }), makeRep({ romScore: 55 })]);
    expect(summary.recommendations.some((r) => r.toLowerCase().includes('range of motion'))).toBe(true);
  });

  it('recommends slowing down when average tempo score is low', () => {
    const summary = buildSetSummary([makeRep({ tempoScore: 40 }), makeRep({ tempoScore: 45 })]);
    expect(summary.recommendations.some((r) => r.toLowerCase().includes('slow down'))).toBe(true);
  });

  it('recommends working on symmetry when average symmetry score is low', () => {
    const summary = buildSetSummary([makeRep({ symmetryScore: 60 }), makeRep({ symmetryScore: 65 })]);
    expect(summary.recommendations.some((r) => r.toLowerCase().includes('balance'))).toBe(true);
  });

  it('gives positive-only feedback for a clean set', () => {
    const summary = buildSetSummary([makeRep(), makeRep(), makeRep()]);
    expect(summary.recommendations).toEqual(['Clean set — keep this form as your baseline.']);
  });
});
