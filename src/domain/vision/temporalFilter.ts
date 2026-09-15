/**
 * Debounces a boolean signal per key so it only reads as "confirmed" once
 * it has held continuously true for at least that key's configured
 * duration. Used to stop a single bad pose-estimation frame from flashing
 * a form-correction message — a real error has to persist to be worth
 * interrupting the lifter over.
 */
export class TemporalFilter {
  private activeSince = new Map<string, number>();

  /** Feed this key's raw (per-frame) state. Returns true once it has been continuously true for `persistMs`. */
  update(key: string, isActive: boolean, timestampMs: number, persistMs: number): boolean {
    if (!isActive) {
      this.activeSince.delete(key);
      return false;
    }

    const since = this.activeSince.get(key);
    if (since === undefined) {
      this.activeSince.set(key, timestampMs);
      return persistMs <= 0;
    }

    return timestampMs - since >= persistMs;
  }

  /** Whether `key` is currently confirmed-active without re-feeding it a frame. */
  isConfirmed(key: string, timestampMs: number, persistMs: number): boolean {
    const since = this.activeSince.get(key);
    if (since === undefined) return false;
    return timestampMs - since >= persistMs;
  }

  reset(key?: string): void {
    if (key) this.activeSince.delete(key);
    else this.activeSince.clear();
  }
}
