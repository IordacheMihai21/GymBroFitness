import { FormAnalysisPerformanceTracker } from '../performanceTracker';

describe('FormAnalysisPerformanceTracker', () => {
  it('emits one aggregate after the configured window', () => {
    const tracker = new FormAnalysisPerformanceTracker(1000);

    expect(tracker.record(0, 20)).toBeNull();
    expect(tracker.record(500, 40)).toBeNull();
    expect(tracker.record(1000, 30)).toEqual({
      processedFps: 3,
      averageInferenceMs: 30,
      maxInferenceMs: 40,
      sampleCount: 3,
    });
  });

  it('starts a fresh window after emitting a snapshot', () => {
    const tracker = new FormAnalysisPerformanceTracker(1000);
    tracker.record(0, 10);
    tracker.record(1000, 20);

    expect(tracker.record(1500, 50)).toBeNull();
    expect(tracker.record(2000, 30)).toEqual({
      processedFps: 2,
      averageInferenceMs: 40,
      maxInferenceMs: 50,
      sampleCount: 2,
    });
  });

  it('ignores invalid measurements', () => {
    const tracker = new FormAnalysisPerformanceTracker(1000);

    expect(tracker.record(Number.NaN, 10)).toBeNull();
    expect(tracker.record(0, -1)).toBeNull();
    expect(tracker.record(1000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
