import type { FormViolation } from '../feedbackPriority';
import type { RepAnalysis } from '../formScoring';
import { VoiceCoach } from '../voiceCoaching';

function makeRep(overrides: Partial<RepAnalysis> = {}): RepAnalysis {
  return {
    repNumber: 1,
    romScore: 100,
    stabilityScore: 100,
    alignmentScore: 100,
    tempoScore: 100,
    symmetryScore: 100,
    violations: [],
    overallScore: 100,
    ...overrides,
  };
}

function makeViolation(overrides: Partial<FormViolation> = {}): FormViolation {
  return { id: 'knee-cave', message: 'Keep your knees tracking over your toes.', severity: 'warning', priority: 100, ...overrides };
}

describe('VoiceCoach', () => {
  it('announces a clean rep as "Nice rep."', () => {
    const coach = new VoiceCoach();
    const cue = coach.decide({ repCompleted: makeRep({ repNumber: 1 }), topViolation: null }, 0);
    expect(cue).toEqual({ id: 'rep-good-1', text: 'Nice rep.' });
  });

  it('announces a flawed rep using its top violation message instead of a generic "nice rep"', () => {
    const coach = new VoiceCoach();
    const violation = makeViolation({ id: 'chest-drop', message: 'Keep your chest up.', priority: 0 });
    const cue = coach.decide(
      { repCompleted: makeRep({ repNumber: 2, overallScore: 60, violations: [violation] }), topViolation: null },
      0,
    );
    expect(cue).toEqual({ id: 'rep-issue-2', text: 'Keep your chest up.' });
  });

  it('speaks a new active violation immediately', () => {
    const coach = new VoiceCoach();
    const violation = makeViolation();
    const cue = coach.decide({ repCompleted: null, topViolation: violation }, 0);
    expect(cue).toEqual({ id: 'knee-cave', text: violation.message });
  });

  it('does not repeat the same violation before its cooldown elapses', () => {
    const coach = new VoiceCoach();
    const violation = makeViolation();
    coach.decide({ repCompleted: null, topViolation: violation }, 0);
    expect(coach.decide({ repCompleted: null, topViolation: violation }, 2000)).toBeNull();
    expect(coach.decide({ repCompleted: null, topViolation: violation }, 3999)).toBeNull();
  });

  it('repeats the same violation once its cooldown has elapsed', () => {
    const coach = new VoiceCoach();
    const violation = makeViolation();
    coach.decide({ repCompleted: null, topViolation: violation }, 0);
    expect(coach.decide({ repCompleted: null, topViolation: violation }, 4000)).toEqual({
      id: violation.id,
      text: violation.message,
    });
  });

  it('interrupts an on-cooldown violation with a different, newly active one', () => {
    const coach = new VoiceCoach();
    coach.decide({ repCompleted: null, topViolation: makeViolation({ id: 'knee-cave' }) }, 0);
    const other = makeViolation({ id: 'chest-drop', message: 'Keep your chest up.' });
    expect(coach.decide({ repCompleted: null, topViolation: other }, 1600)).toEqual({
      id: 'chest-drop',
      text: 'Keep your chest up.',
    });
  });

  it('never speaks two cues closer together than the minimum gap, even for distinct events', () => {
    const coach = new VoiceCoach();
    coach.decide({ repCompleted: makeRep({ repNumber: 1 }), topViolation: null }, 0);
    expect(coach.decide({ repCompleted: null, topViolation: makeViolation() }, 500)).toBeNull();
  });

  it('prioritizes a rep completion over a simultaneously active violation', () => {
    const coach = new VoiceCoach();
    const cue = coach.decide(
      { repCompleted: makeRep({ repNumber: 5 }), topViolation: makeViolation() },
      0,
    );
    expect(cue?.id).toBe('rep-good-5');
  });

  it('always announces each rep, even consecutive clean ones, once the gap has elapsed', () => {
    const coach = new VoiceCoach();
    coach.decide({ repCompleted: makeRep({ repNumber: 1 }), topViolation: null }, 0);
    const cue = coach.decide({ repCompleted: makeRep({ repNumber: 2 }), topViolation: null }, 2000);
    expect(cue).toEqual({ id: 'rep-good-2', text: 'Nice rep.' });
  });

  it('resets so a previously spoken cue can be spoken again immediately', () => {
    const coach = new VoiceCoach();
    const violation = makeViolation();
    coach.decide({ repCompleted: null, topViolation: violation }, 0);
    coach.reset();
    expect(coach.decide({ repCompleted: null, topViolation: violation }, 100)).toEqual({
      id: violation.id,
      text: violation.message,
    });
  });
});
