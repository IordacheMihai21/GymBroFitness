import type { Exercise, ProgressionDecision } from '@/types';

type Metrics = {
  avgReps: number;
  minReps: number;
  topLoad: number;
  avgRir: number | null;
};

/**
 * Plain-language explanation templates for progression decisions.
 * The numbers come from the deterministic engine; this layer only phrases them.
 */
export function explain(
  decision: ProgressionDecision,
  exercise: Exercise,
  m?: Metrics,
): string {
  const range = `${decision.nextMinReps}–${decision.nextMaxReps}`;
  const load = decision.nextLoad != null ? `${decision.nextLoad} kg` : 'the same load';

  switch (decision.reasonCode) {
    case 'NO_COMPLETED_SETS':
      return `No completed working sets were logged for ${exercise.name}, so the plan stays unchanged until there is data to act on.`;
    case 'CALIBRATING_LOAD':
      return `First session for ${exercise.name}: pick a load you could do for about ${decision.nextMaxReps} reps with ${decision.nextMaxReps > 12 ? 'a couple' : '2–3'} reps left in the tank. Once logged, progression starts from there.`;
    case 'PAIN_HOLD':
      return `You flagged discomfort, so the load on ${exercise.name} stays put. Progressing through pain is how small issues become big ones — if it persists, swap the exercise and consider seeing a qualified professional.`;
    case 'TOP_OF_RANGE_ALL_SETS':
      return `You hit the top of the rep range on every working set of ${exercise.name} with reps to spare — that load is officially beaten. Next time: ${load}, aiming for ${range} reps.`;
    case 'BODYWEIGHT_TOP_OF_RANGE':
      return `Every set of ${exercise.name} topped the target range, so the target moves up to ${range}. When that gets comfortable, switch to a harder variation to keep tension high.`;
    case 'IN_RANGE_PROGRESS_REPS':
      return `Solid session on ${exercise.name}${m ? ` (average ${m.avgReps.toFixed(1)} reps)` : ''}. Keep ${load} and try to add a rep to each set — once every set reaches ${decision.nextMaxReps}, the load goes up.`;
    case 'HOLD_STEADY':
      return `${exercise.name} was harder than planned this time, so the prescription holds. Owning this load at the target effort is progress too — the jump will come.`;
    case 'ONE_OFF_MISS':
      return `Some sets of ${exercise.name} fell under the rep floor, but one rough session is noise, not a trend. Same plan next time; if it repeats, the load comes down.`;
    case 'REPEATED_BELOW_MIN':
      return `Two sessions in a row under the minimum reps on ${exercise.name}. Dropping to ${load} restores clean reps in the ${range} range — better stimulus, less grinding.`;
    case 'EXTREME_MISS':
      return `Reps on ${exercise.name} came in far below target at maximal effort, which means the load outran you. It drops to ${load} so every set lands back in the productive ${range} zone.`;
    case 'SHARP_INTRASET_DROP':
      return `Your reps on ${exercise.name} fell off sharply across sets — a sign the later sets were mostly fatigue, not stimulus. One set comes off (${decision.nextWorkingSets} sets next time) to keep quality high.`;
    case 'PRIORITY_VOLUME_HEADROOM':
      return `${exercise.name} targets a priority muscle, you've strung together several strong sessions, and weekly volume has headroom — so a set is added (${decision.nextWorkingSets} total). More good sets, more growth.`;
    case 'DELOAD_SIGNALS':
      return `Several signals line up on ${exercise.name}: repeated missed targets and high strain. A lighter week (~${decision.nextLoad != null ? `${decision.nextLoad} kg` : '40% less load'}) is suggested — not forced — to let recovery catch up. Fatigue masks fitness; a deload reveals it.`;
    default:
      return `Prescription for ${exercise.name}: ${range} reps at ${load}.`;
  }
}
