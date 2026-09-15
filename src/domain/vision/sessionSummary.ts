import type { RepAnalysis } from './formScoring';

export interface FormSetSummary {
  reps: number;
  averageScore: number;
  bestRep: RepAnalysis | null;
  worstRep: RepAnalysis | null;
  mostCommonIssue: string | null;
  averageRomScore: number;
  averageTempoScore: number;
  recommendations: string[];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function mostCommonViolationMessage(reps: RepAnalysis[]): string | null {
  const counts = new Map<string, { message: string; count: number }>();
  for (const rep of reps) {
    for (const violation of rep.violations) {
      const entry = counts.get(violation.id);
      if (entry) entry.count += 1;
      else counts.set(violation.id, { message: violation.message, count: 1 });
    }
  }
  if (counts.size === 0) return null;
  return [...counts.values()].sort((a, b) => b.count - a.count)[0].message;
}

function buildRecommendations(reps: RepAnalysis[], mostCommonIssue: string | null, averageRomScore: number, averageTempoScore: number): string[] {
  const recommendations: string[] = [];
  if (mostCommonIssue) {
    recommendations.push(`Focus on this next set: "${mostCommonIssue}" was your most frequent form issue.`);
  }
  if (averageRomScore < 75) {
    recommendations.push('Aim for a fuller range of motion — several reps stopped short.');
  }
  if (averageTempoScore < 70) {
    recommendations.push('Slow down, especially on the way down — several reps looked rushed.');
  }
  const avgSymmetry = average(reps.map((r) => r.symmetryScore));
  if (avgSymmetry < 80) {
    recommendations.push('Work on left/right balance — one side is doing more of the work.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Clean set — keep this form as your baseline.');
  }
  return recommendations;
}

export function buildSetSummary(reps: RepAnalysis[]): FormSetSummary {
  if (reps.length === 0) {
    return {
      reps: 0,
      averageScore: 0,
      bestRep: null,
      worstRep: null,
      mostCommonIssue: null,
      averageRomScore: 0,
      averageTempoScore: 0,
      recommendations: ['No reps recorded for this set.'],
    };
  }

  const bestRep = reps.reduce((best, rep) => (rep.overallScore > best.overallScore ? rep : best));
  const worstRep = reps.reduce((worst, rep) => (rep.overallScore < worst.overallScore ? rep : worst));
  const mostCommonIssue = mostCommonViolationMessage(reps);
  const averageRomScore = average(reps.map((r) => r.romScore));
  const averageTempoScore = average(reps.map((r) => r.tempoScore));

  return {
    reps: reps.length,
    averageScore: average(reps.map((r) => r.overallScore)),
    bestRep,
    worstRep,
    mostCommonIssue,
    averageRomScore,
    averageTempoScore,
    recommendations: buildRecommendations(reps, mostCommonIssue, averageRomScore, averageTempoScore),
  };
}
