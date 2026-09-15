/**
 * 0 (failure) to 5 (very easy) in half-point steps — the precision serious
 * lifters actually use to self-report reps-in-reserve.
 */
export const RIR_VALUES: number[] = Array.from({ length: 11 }, (_, i) => i * 0.5);

export function formatRir(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
