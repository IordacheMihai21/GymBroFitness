export type FormAnalysisPerformance = {
  processedFps: number;
  averageInferenceMs: number;
  maxInferenceMs: number;
  sampleCount: number;
};

/** Aggregates short rolling windows without allocating once per camera frame. */
export class FormAnalysisPerformanceTracker {
  private windowStartedAt: number | null = null;
  private sampleCount = 0;
  private totalInferenceMs = 0;
  private maxInferenceMs = 0;

  constructor(private readonly windowDurationMs = 5000) {}

  record(timestampMs: number, inferenceMs: number): FormAnalysisPerformance | null {
    if (!Number.isFinite(timestampMs) || !Number.isFinite(inferenceMs) || inferenceMs < 0) {
      return null;
    }
    if (this.windowStartedAt == null) this.windowStartedAt = timestampMs;

    this.sampleCount += 1;
    this.totalInferenceMs += inferenceMs;
    this.maxInferenceMs = Math.max(this.maxInferenceMs, inferenceMs);

    const elapsedMs = timestampMs - this.windowStartedAt;
    if (elapsedMs < this.windowDurationMs || elapsedMs <= 0) return null;

    const snapshot: FormAnalysisPerformance = {
      processedFps: (this.sampleCount * 1000) / elapsedMs,
      averageInferenceMs: this.totalInferenceMs / this.sampleCount,
      maxInferenceMs: this.maxInferenceMs,
      sampleCount: this.sampleCount,
    };
    this.reset(timestampMs);
    return snapshot;
  }

  reset(nextWindowStartedAt: number | null = null): void {
    this.windowStartedAt = nextWindowStartedAt;
    this.sampleCount = 0;
    this.totalInferenceMs = 0;
    this.maxInferenceMs = 0;
  }
}
