import type { FormViolation } from './feedbackPriority';
import { pickTopViolation } from './feedbackPriority';
import type { RepAnalysis } from './formScoring';

export interface VoiceCue {
  id: string;
  text: string;
}

/** Never speak more than one cue this close together, so utterances can't stack mid-sentence. */
const MIN_GAP_MS = 1500;

/** How long the same violation cue must keep being the top issue before it's repeated aloud. */
const VIOLATION_REPEAT_COOLDOWN_MS = 4000;

function repCompletionCue(rep: RepAnalysis): VoiceCue {
  const topIssue = pickTopViolation(rep.violations);
  if (!topIssue || rep.overallScore >= 90) {
    return { id: `rep-good-${rep.repNumber}`, text: 'Nice rep.' };
  }
  return { id: `rep-issue-${rep.repNumber}`, text: topIssue.message };
}

/**
 * Decides which single phrase, if any, should be spoken next. A lifter mid-set
 * can't watch the screen, so coaching has to be audible — but a real coach
 * doesn't repeat the same correction every quarter-second either. Rep
 * completions always get a fresh, distinct cue (announced once per rep);
 * an ongoing violation is re-announced only after it has stayed the top issue
 * for a while, and nothing is ever spoken close enough to overlap the last
 * utterance.
 */
export class VoiceCoach {
  private lastSpokenId: string | null = null;
  private lastSpokenAt = -Infinity;

  decide(
    input: { repCompleted: RepAnalysis | null; topViolation: FormViolation | null },
    timestampMs: number,
  ): VoiceCue | null {
    if (timestampMs - this.lastSpokenAt < MIN_GAP_MS) return null;

    if (input.repCompleted) {
      const cue = repCompletionCue(input.repCompleted);
      this.markSpoken(cue.id, timestampMs);
      return cue;
    }

    if (input.topViolation) {
      const cue: VoiceCue = { id: input.topViolation.id, text: input.topViolation.message };
      const isRepeat = cue.id === this.lastSpokenId;
      if (!isRepeat || timestampMs - this.lastSpokenAt >= VIOLATION_REPEAT_COOLDOWN_MS) {
        this.markSpoken(cue.id, timestampMs);
        return cue;
      }
    }

    return null;
  }

  reset(): void {
    this.lastSpokenId = null;
    this.lastSpokenAt = -Infinity;
  }

  private markSpoken(id: string, timestampMs: number): void {
    this.lastSpokenId = id;
    this.lastSpokenAt = timestampMs;
  }
}
