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
export function explain(decision: ProgressionDecision, exercise: Exercise, m?: Metrics): string {
  const range = `${decision.nextMinReps}–${decision.nextMaxReps}`;
  const load = decision.nextLoad != null ? 'the proposed load' : 'the same load';

  switch (decision.reasonCode) {
    case 'NO_COMPLETED_SETS':
      return `No completed working sets were logged for ${exercise.name}, so the plan stays unchanged until there is data to act on.`;
    case 'CALIBRATING_LOAD':
      return `First session for ${exercise.name}: pick a load you could do for about ${decision.nextMaxReps} reps with ${decision.nextMaxReps > 12 ? 'a couple' : '2–3'} reps left in the tank. Once logged, progression starts from there.`;
    case 'PAIN_HOLD':
      return `You flagged discomfort, so the load on ${exercise.name} stays put. Progressing through pain is how small issues become big ones — if it persists, swap the exercise and consider seeing a qualified professional.`;
    case 'INCOMPLETE_PRESCRIPTION':
      return `Only part of the prescribed work for ${exercise.name} was completed. That session stays in history, but it is not treated as proof that the full prescription was achieved, so the target holds.`;
    case 'MISSING_RIR_HOLD':
      return `At least one working set for ${exercise.name} has no RIR. The workout still counts, but effort is unknown, so the app holds the target instead of assuming the load was ready to progress.`;
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
      return `Your reps on ${exercise.name} fell off sharply across sets, so the later sets are less comparable with the opening work. One set comes off (${decision.nextWorkingSets} sets next time) to keep execution consistent.`;
    case 'PRIORITY_VOLUME_HEADROOM':
      return `${exercise.name} targets a priority muscle, several complete sessions met the prescription, and the programmed weekly-set cap has room — so one set is proposed (${decision.nextWorkingSets} total). You can keep the current dose instead.`;
    case 'DELOAD_SIGNALS':
      return `Several logged signals line up on ${exercise.name}: repeated complete sessions missed the target and effort or check-in data was unusually hard. A lighter pass is suggested, not forced; this is not a recovery measurement.`;
    default:
      return `Prescription for ${exercise.name}: ${range} reps at ${load}.`;
  }
}
