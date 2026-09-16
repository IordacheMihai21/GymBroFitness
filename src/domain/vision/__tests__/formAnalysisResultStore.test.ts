import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SetFormAnalysis } from '@/types';

import {
  savePendingFormAnalysisResult,
  takePendingFormAnalysisResult,
} from '../formAnalysisResultStore';

function analysis(patch: Partial<SetFormAnalysis> = {}): SetFormAnalysis {
  return {
    id: 'analysis-1',
    exerciseId: 'barbell-squat',
    capturedAt: '2026-09-15T12:00:00.000Z',
    repCount: 8,
    averageScore: 88,
    averageRomScore: 91,
    averageTempoScore: 84,
    bestRepScore: 96,
    worstRepScore: 74,
    mostCommonIssue: null,
    recommendations: ['Clean set.'],
    ...patch,
  };
}

describe('formAnalysisResultStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves and consumes one pending result for a workout session', async () => {
    await savePendingFormAnalysisResult({
      sessionId: 'session-1',
      exerciseIndex: 0,
      setIndex: 1,
      analysis: analysis(),
    });

    await expect(takePendingFormAnalysisResult('session-1')).resolves.toMatchObject({
      sessionId: 'session-1',
      exerciseIndex: 0,
      setIndex: 1,
      analysis: { averageScore: 88 },
    });
    await expect(takePendingFormAnalysisResult('session-1')).resolves.toBeNull();
  });

  it('replaces an older result for the same set target', async () => {
    await savePendingFormAnalysisResult({
      sessionId: 'session-1',
      exerciseIndex: 0,
      setIndex: 0,
      analysis: analysis({ id: 'old', averageScore: 70 }),
    });
    await savePendingFormAnalysisResult({
      sessionId: 'session-1',
      exerciseIndex: 0,
      setIndex: 0,
      analysis: analysis({ id: 'new', averageScore: 92 }),
    });

    const result = await takePendingFormAnalysisResult('session-1');
    expect(result?.analysis).toMatchObject({ id: 'new', averageScore: 92 });
  });
});
