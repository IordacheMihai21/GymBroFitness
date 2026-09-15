export type ViolationSeverity = 'warning' | 'error';

export interface FormViolation {
  id: string;
  message: string;
  severity: ViolationSeverity;
  priority: number;
}

const DEFAULT_PRIORITY_BY_SEVERITY: Record<ViolationSeverity, number> = {
  error: 0,
  warning: 100,
};

export function resolvePriority(severity: ViolationSeverity, explicitPriority?: number): number {
  return explicitPriority ?? DEFAULT_PRIORITY_BY_SEVERITY[severity];
}

/**
 * Never show every active correction at once — a lifter mid-rep can act on
 * one cue, not five. Rank by priority (lower first; errors default ahead of
 * warnings) and return only the single most important one, or null when
 * nothing is currently confirmed-active.
 */
export function pickTopViolation(activeViolations: FormViolation[]): FormViolation | null {
  if (activeViolations.length === 0) return null;
  return [...activeViolations].sort((a, b) => a.priority - b.priority)[0];
}
