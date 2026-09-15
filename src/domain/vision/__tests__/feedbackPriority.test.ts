import { pickTopViolation, resolvePriority } from '../feedbackPriority';
import type { FormViolation } from '../feedbackPriority';

describe('resolvePriority', () => {
  it('defaults errors ahead of warnings', () => {
    expect(resolvePriority('error')).toBeLessThan(resolvePriority('warning'));
  });

  it('honors an explicit override', () => {
    expect(resolvePriority('warning', -5)).toBe(-5);
  });
});

describe('pickTopViolation', () => {
  it('returns null when nothing is active', () => {
    expect(pickTopViolation([])).toBeNull();
  });

  it('picks the single lowest-priority (most urgent) violation', () => {
    const violations: FormViolation[] = [
      { id: 'depth', message: 'Go deeper.', severity: 'warning', priority: 100 },
      { id: 'knee-cave', message: 'Keep your knees tracking over your toes.', severity: 'error', priority: 0 },
      { id: 'lean', message: 'Keep your chest up.', severity: 'error', priority: 5 },
    ];
    expect(pickTopViolation(violations)?.id).toBe('knee-cave');
  });

  it('never returns more than one violation, even with many active', () => {
    const violations: FormViolation[] = Array.from({ length: 5 }, (_, i) => ({
      id: `rule-${i}`,
      message: `msg ${i}`,
      severity: 'warning' as const,
      priority: i,
    }));
    const picked = pickTopViolation(violations);
    expect(picked?.id).toBe('rule-0');
  });
});
