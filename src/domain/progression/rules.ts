import type { ProgressionReasonCode } from '@/types';

export const PROGRESSION_RULE_VERSION = 2 as const;

export type ProgressionRule = {
  id: ProgressionReasonCode;
  version: typeof PROGRESSION_RULE_VERSION;
  summary: string;
  requires: string[];
  limitation: string;
};

function rule(
  id: ProgressionReasonCode,
  summary: string,
  requires: string[],
  limitation: string,
): ProgressionRule {
  return { id, version: PROGRESSION_RULE_VERSION, summary, requires, limitation };
}

const COMMON_LIMIT = 'A deterministic training suggestion, not a physiological measurement.';

export const PROGRESSION_RULES: Record<ProgressionReasonCode, ProgressionRule> = {
  NO_COMPLETED_SETS: rule(
    'NO_COMPLETED_SETS',
    'Wait for a completed working set.',
    ['completed working sets'],
    COMMON_LIMIT,
  ),
  PAIN_HOLD: rule(
    'PAIN_HOLD',
    'Do not increase load after self-reported pain or discomfort.',
    ['pain check-in or discomfort flag'],
    'Uses self-report and does not diagnose injury.',
  ),
  INCOMPLETE_PRESCRIPTION: rule(
    'INCOMPLETE_PRESCRIPTION',
    'Hold when fewer sets were completed than prescribed.',
    ['completed-set count', 'prescribed-set count'],
    COMMON_LIMIT,
  ),
  CALIBRATING_LOAD: rule(
    'CALIBRATING_LOAD',
    'Establish the first meaningful loaded benchmark.',
    ['completed working sets', 'external load'],
    COMMON_LIMIT,
  ),
  MISSING_RIR_HOLD: rule(
    'MISSING_RIR_HOLD',
    'Hold instead of assuming unknown effort was acceptable.',
    ['RIR for every completed working set'],
    'RIR is subjective and optional; missing RIR blocks automatic progression only.',
  ),
  DELOAD_SIGNALS: rule(
    'DELOAD_SIGNALS',
    'Suggest a lighter pass after repeated complete misses plus hard-effort context.',
    ['three comparable sessions', 'RIR or self-reported check-in'],
    'Does not measure fatigue or recovery and never forces a deload.',
  ),
  SHARP_INTRASET_DROP: rule(
    'SHARP_INTRASET_DROP',
    'Trim one isolation set after a large within-session performance drop.',
    ['at least two completed sets', 'comparable rep or time values'],
    COMMON_LIMIT,
  ),
  EXTREME_MISS: rule(
    'EXTREME_MISS',
    'Reduce load after a large miss at reported maximal effort.',
    ['rep floor', 'RIR', 'current load'],
    COMMON_LIMIT,
  ),
  REPEATED_BELOW_MIN: rule(
    'REPEATED_BELOW_MIN',
    'Reduce load after two comparable sessions below the rep floor.',
    ['two complete comparable sessions', 'current load'],
    COMMON_LIMIT,
  ),
  ONE_OFF_MISS: rule(
    'ONE_OFF_MISS',
    'Repeat after one session below the rep floor.',
    ['one complete session'],
    COMMON_LIMIT,
  ),
  TOP_OF_RANGE_ALL_SETS: rule(
    'TOP_OF_RANGE_ALL_SETS',
    'Increase load after every prescribed set reaches the ceiling at target effort.',
    ['complete prescription', 'RIR coverage', 'equipment increment'],
    COMMON_LIMIT,
  ),
  BODYWEIGHT_TOP_OF_RANGE: rule(
    'BODYWEIGHT_TOP_OF_RANGE',
    'Extend the rep or time target for an unloaded movement.',
    ['complete prescription', 'RIR coverage'],
    COMMON_LIMIT,
  ),
  PRIORITY_VOLUME_HEADROOM: rule(
    'PRIORITY_VOLUME_HEADROOM',
    'Propose one set after a complete success streak under the configured cap.',
    [
      'priority flag',
      'three complete sessions',
      'weekly programmed sets',
      'self-reported nutrition context',
    ],
    'The cap is a configuration value, not an individualized growth threshold; a reported deficit blocks set increases.',
  ),
  IN_RANGE_PROGRESS_REPS: rule(
    'IN_RANGE_PROGRESS_REPS',
    'Chase repetitions inside the prescribed range and effort.',
    ['complete prescription', 'RIR coverage'],
    COMMON_LIMIT,
  ),
  HOLD_STEADY: rule(
    'HOLD_STEADY',
    'Repeat when the prescription was completed harder than intended.',
    ['complete prescription', 'RIR coverage'],
    COMMON_LIMIT,
  ),
};

export function progressionRule(reasonCode: ProgressionReasonCode): ProgressionRule {
  return PROGRESSION_RULES[reasonCode];
}
