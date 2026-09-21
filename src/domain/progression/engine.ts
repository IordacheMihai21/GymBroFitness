import type {
  PerformedSet,
  ProgressionDecision,
  ProgressionInput,
  ProgressionReasonCode,
} from '@/types';
import { roundToIncrement, smallestIncrementKg } from '@/utils/units';

import { MAX_WEEKLY_SETS_BY_EXPERIENCE, PROGRESSION_CONSTRAINTS as C } from './constraints';
import { explain } from './explanations';
import { PROGRESSION_RULE_VERSION } from './rules';

/**
 * Deterministic double-progression engine.
 *
 * Rep range is the primary progression axis; when the top of the range is
 * earned on every working set at the target RIR, load goes up by the
 * smallest usable increment and reps reset to the bottom of the range.
 * Every decision carries a reason code, an explanation, and the metrics
 * that produced it.
 */

export function completedWorkingSets(sets: PerformedSet[]): PerformedSet[] {
  return sets.filter((s) => s.kind !== 'warmup' && s.completed && !s.skipped);
}

/** The rep-equivalent metric: reps for rep-tracked, seconds for time-tracked. */
function effortValue(set: PerformedSet, isTime: boolean): number {
  return (isTime ? set.durationSeconds : set.reps) ?? 0;
}

type SessionMetrics = {
  sets: PerformedSet[];
  topLoad: number;
  avgReps: number;
  minReps: number;
  allAtCeiling: boolean;
  allAtOrAboveFloor: boolean;
  setsBelowFloor: number;
  avgRir: number | null;
  rirCount: number;
  hitFailure: boolean;
  sharpIntrasetDrop: boolean;
};

function measure(
  sets: PerformedSet[],
  minTarget: number,
  maxTarget: number,
  isTime: boolean,
): SessionMetrics | null {
  const working = completedWorkingSets(sets);
  if (working.length === 0) return null;
  const efforts = working.map((s) => effortValue(s, isTime));
  const loads = working.map((s) => s.loadKg ?? 0);
  const rirs = working.map((s) => s.rir).filter((r): r is number => r != null);
  const first = efforts[0];
  const last = efforts[efforts.length - 1];
  return {
    sets: working,
    topLoad: Math.max(...loads),
    avgReps: efforts.reduce((a, b) => a + b, 0) / efforts.length,
    minReps: Math.min(...efforts),
    allAtCeiling: efforts.every((r) => r >= maxTarget),
    allAtOrAboveFloor: efforts.every((r) => r >= minTarget),
    setsBelowFloor: efforts.filter((r) => r < minTarget).length,
    avgRir: rirs.length > 0 ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
    rirCount: rirs.length,
    hitFailure: rirs.some((r) => r === 0),
    sharpIntrasetDrop: working.length >= 2 && first > 0 && last / first < 0.6,
  };
}

/** True when the session met its prescription (in range at sane RIR). */
function sessionSuccessful(m: SessionMetrics | null, expectedSets: number): boolean {
  return m != null && m.sets.length >= expectedSets && m.allAtOrAboveFloor;
}

function readinessPoor(input: ProgressionInput): boolean {
  const r = input.readiness;
  if (!r) return false;
  const score = r.energy + r.sleepQuality + r.recovery;
  return score <= 7; // average ≤ ~2.3 of 5
}

export function runProgression(input: ProgressionInput): ProgressionDecision {
  const { prescription: p, exercise, previousSessions } = input;
  const isTime = exercise.trackingType === 'time';
  const isLoadable =
    exercise.trackingType === 'weight_reps' || exercise.trackingType === 'weighted_bodyweight';

  const base = {
    exerciseId: exercise.id,
    nextMinReps: p.minReps,
    nextMaxReps: p.maxReps,
    nextWorkingSets: p.workingSets,
    createdAt: new Date().toISOString(),
    sessionId: '',
  };

  const m = measure(input.performedSets, p.minReps, p.maxReps, isTime);
  const historyMetrics = previousSessions.map((session) => ({
    metrics: measure(
      session.sets,
      session.prescription.minReps,
      session.prescription.maxReps,
      isTime,
    ),
    expectedSets: session.prescription.workingSets,
  }));
  const comparableHistoryMetrics = historyMetrics.filter(
    ({ metrics, expectedSets }) => metrics != null && metrics.sets.length >= expectedSets,
  );
  const comparableHistoryCount = comparableHistoryMetrics.length;
  const confidence: ProgressionDecision['confidence'] =
    comparableHistoryCount >= 2 ? 'high' : comparableHistoryCount === 1 ? 'medium' : 'low';

  const supportingMetrics: Record<string, number | string> = m
    ? {
        comparableHistorySessions: comparableHistoryCount,
        completedSets: m.sets.length,
        avgReps: Math.round(m.avgReps * 10) / 10,
        minReps: m.minReps,
        topLoadKg: m.topLoad,
        avgRir: m.avgRir == null ? 'n/a' : Math.round(m.avgRir * 10) / 10,
        rirCoverage: `${m.rirCount}/${m.sets.length}`,
        completedPrescription: m.sets.length >= p.workingSets ? 'yes' : 'no',
        targetRange: `${p.minReps}–${p.maxReps}`,
        targetRir: p.targetRir,
        nutritionContext: input.nutritionContext ?? 'unknown',
      }
    : { completedSets: 0, comparableHistorySessions: comparableHistoryCount };

  const decide = (
    partial: Pick<ProgressionDecision, 'action'> & {
      reasonCode: ProgressionReasonCode;
    } & Partial<ProgressionDecision>,
  ): ProgressionDecision => {
    const d: ProgressionDecision = {
      ...base,
      confidence,
      ruleVersion: PROGRESSION_RULE_VERSION,
      supportingMetrics,
      explanation: '',
      ...partial,
    };
    // Clamp everything to configured constraints.
    d.nextMinReps = Math.max(C.minRepTarget, Math.min(C.maxRepTarget, d.nextMinReps));
    d.nextMaxReps = Math.max(d.nextMinReps, Math.min(C.maxRepTarget, d.nextMaxReps));
    d.nextWorkingSets = Math.max(C.minWorkingSets, Math.min(C.maxWorkingSets, d.nextWorkingSets));
    if (d.nextLoad != null && m && m.topLoad > 0) {
      const maxAllowed = m.topLoad * (1 + C.maxLoadIncreasePercent / 100);
      d.nextLoad = Math.min(d.nextLoad, roundToIncrement(maxAllowed, 0.5));
    }
    d.explanation = partial.explanation ?? explain(d, exercise, m ?? undefined);
    return d;
  };

  // 1. Nothing logged → nothing to conclude.
  if (!m) {
    return decide({ action: 'needs_more_data', reasonCode: 'NO_COMPLETED_SETS' });
  }

  // 2. Pain or discomfort: never progress load on top of a pain signal.
  if (input.reportedDiscomfort || input.readiness?.hasPain) {
    return decide({
      action: 'maintain',
      reasonCode: 'PAIN_HOLD',
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 3. A partial session is useful history, but it does not prove the prescription was achieved.
  if (m.sets.length < p.workingSets) {
    return decide({
      action: 'maintain',
      reasonCode: 'INCOMPLETE_PRESCRIPTION',
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 4. First loadable session without a meaningful load: calibration.
  if (isLoadable && m.topLoad === 0 && previousSessions.length === 0) {
    return decide({ action: 'needs_more_data', reasonCode: 'CALIBRATING_LOAD' });
  }

  // 5. Missing effort data never silently counts as permission to progress.
  if (m.rirCount < m.sets.length) {
    return decide({
      action: 'maintain',
      reasonCode: 'MISSING_RIR_HOLD',
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 6. Deload: several aligned signals, never forced automatically.
  if (comparableHistoryMetrics.length >= C.sessionsBeforeDeload - 1) {
    const recent = [
      ...comparableHistoryMetrics.slice(-(C.sessionsBeforeDeload - 1)),
      { metrics: m, expectedSets: p.workingSets },
    ];
    const regressions = recent.filter(
      ({ metrics, expectedSets }) => !sessionSuccessful(metrics, expectedSets),
    ).length;
    const grinding = m.avgRir != null && m.avgRir < 0.5 && !m.allAtOrAboveFloor;
    if (regressions >= C.sessionsBeforeDeload && (readinessPoor(input) || grinding)) {
      return decide({
        action: 'suggest_deload',
        reasonCode: 'DELOAD_SIGNALS',
        nextLoad:
          isLoadable && m.topLoad > 0
            ? roundToIncrement(
                m.topLoad * (1 - C.deloadLoadPercent / 100),
                smallestIncrementKg(exercise.equipment),
              )
            : undefined,
      });
    }
  }

  // 7. Sharp performance drop within the session → trim one accessory set.
  if (m.sharpIntrasetDrop && p.workingSets > 2 && exercise.exerciseType === 'isolation') {
    return decide({
      action: 'reduce_sets',
      reasonCode: 'SHARP_INTRASET_DROP',
      nextWorkingSets: p.workingSets - 1,
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 8. Below the rep floor.
  if (!m.allAtOrAboveFloor) {
    const extremeMiss = m.avgReps < p.minReps - 2 && m.hitFailure;
    const previous = comparableHistoryMetrics[comparableHistoryMetrics.length - 1];
    const repeatedMiss =
      previous != null &&
      !sessionSuccessful(previous.metrics, previous.expectedSets) &&
      m.setsBelowFloor >= 1;
    if (isLoadable && m.topLoad > 0 && (extremeMiss || repeatedMiss)) {
      return decide({
        action: 'decrease_load',
        reasonCode: extremeMiss ? 'EXTREME_MISS' : 'REPEATED_BELOW_MIN',
        nextLoad: roundToIncrement(
          m.topLoad * (1 - C.loadDecreasePercent / 100),
          smallestIncrementKg(exercise.equipment),
        ),
      });
    }
    return decide({
      action: 'maintain',
      reasonCode: 'ONE_OFF_MISS',
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 9. Top of range on every set at (or easier than) target RIR → add load.
  const rirOk = m.avgRir != null && m.avgRir >= p.targetRir - 0.5;
  if (m.allAtCeiling && rirOk) {
    if (isLoadable && m.topLoad > 0) {
      const increment = smallestIncrementKg(exercise.equipment);
      const nextLoad = roundToIncrement(m.topLoad + increment, increment);
      return decide({
        action: 'increase_load',
        reasonCode: 'TOP_OF_RANGE_ALL_SETS',
        nextLoad: Math.max(nextLoad, m.topLoad + (increment > 0 ? increment : 0.5)),
      });
    }
    // Bodyweight/time: extend the target range instead of loading.
    return decide({
      action: 'increase_reps',
      reasonCode: 'BODYWEIGHT_TOP_OF_RANGE',
      nextMinReps: Math.min(p.minReps + 1, C.maxRepTarget),
      nextMaxReps: Math.min(p.maxReps + (isTime ? 10 : 2), C.maxRepTarget * (isTime ? 10 : 1)),
    });
  }

  // 10. Add a set: only for priority muscles after a proven streak with
  //    recovery and weekly-volume headroom.
  const successStreak =
    comparableHistoryMetrics
      .slice(-C.sessionsBeforeAddSet + 1)
      .every(({ metrics, expectedSets }) => sessionSuccessful(metrics, expectedSets)) &&
    comparableHistoryMetrics.length >= C.sessionsBeforeAddSet - 1 &&
    sessionSuccessful(m, p.workingSets);
  const weeklyCap = MAX_WEEKLY_SETS_BY_EXPERIENCE[input.userExperience];
  if (
    input.isPriorityMuscle &&
    successStreak &&
    input.nutritionContext !== 'deficit' &&
    !readinessPoor(input) &&
    !m.hitFailure &&
    (input.weeklySetsForPrimaryMuscle ?? weeklyCap) < weeklyCap &&
    p.workingSets < C.maxWorkingSets
  ) {
    return decide({
      action: 'add_set',
      reasonCode: 'PRIORITY_VOLUME_HEADROOM',
      nextWorkingSets: p.workingSets + 1,
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 11. Inside the range with sane effort → chase one more rep.
  if (m.allAtOrAboveFloor && rirOk) {
    return decide({
      action: 'increase_reps',
      reasonCode: 'IN_RANGE_PROGRESS_REPS',
      nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
    });
  }

  // 12. In range but harder than intended → consolidate.
  return decide({
    action: 'maintain',
    reasonCode: 'HOLD_STEADY',
    nextLoad: isLoadable && m.topLoad > 0 ? m.topLoad : undefined,
  });
}
