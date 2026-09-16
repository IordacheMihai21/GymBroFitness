import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SetFormAnalysis } from '@/types';

const STORAGE_KEY = '@GymBroFitness/pending-form-analysis/v1';

export type PendingFormAnalysisResult = {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  analysis: SetFormAnalysis;
};

export async function savePendingFormAnalysisResult(
  result: PendingFormAnalysisResult,
): Promise<void> {
  const current = await readQueue();
  const withoutDuplicate = current.filter(
    (item) =>
      !(
        item.sessionId === result.sessionId &&
        item.exerciseIndex === result.exerciseIndex &&
        item.setIndex === result.setIndex
      ),
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...withoutDuplicate, result]));
}

export async function takePendingFormAnalysisResult(
  sessionId: string,
): Promise<PendingFormAnalysisResult | null> {
  const current = await readQueue();
  const index = current.findIndex((item) => item.sessionId === sessionId);
  if (index === -1) return null;

  const [match] = current.splice(index, 1);
  if (current.length === 0) await AsyncStorage.removeItem(STORAGE_KEY);
  else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  return match ?? null;
}

async function readQueue(): Promise<PendingFormAnalysisResult[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingResult) : [];
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function isPendingResult(value: unknown): value is PendingFormAnalysisResult {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<PendingFormAnalysisResult>;
  const analysis = candidate.analysis as Partial<SetFormAnalysis> | undefined;
  return (
    typeof candidate.sessionId === 'string' &&
    typeof candidate.exerciseIndex === 'number' &&
    typeof candidate.setIndex === 'number' &&
    analysis != null &&
    typeof analysis.id === 'string' &&
    typeof analysis.exerciseId === 'string' &&
    typeof analysis.capturedAt === 'string' &&
    typeof analysis.repCount === 'number' &&
    typeof analysis.averageScore === 'number'
  );
}
