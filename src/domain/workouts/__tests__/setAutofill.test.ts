import { buildSetAutofillSuggestion, setAutofillPatch } from '../setAutofill';
import type { PerformedExercise, PerformedSet } from '@/types';

function makeSet(index: number, patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: `set-${index}`,
    setNumber: index + 1,
    kind: 'working',
    loadKg: null,
    reps: null,
    durationSeconds: null,
    rir: null,
    completed: false,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function makeExercise(sets: PerformedSet[]): PerformedExercise {
  return {
    id: 'performed-bench',
    exerciseId: 'bench',
    order: 0,
    markedDiscomfort: false,
    markedUnavailable: false,
    prescription: {
      exerciseId: 'bench',
      order: 0,
      workingSets: sets.length,
      minReps: 6,
      maxReps: 10,
      targetRir: 2,
      restSeconds: 150,
      selectionReason: 'test',
    },
    sets,
  };
}

describe('buildSetAutofillSuggestion', () => {
  it('prefers the matching set from the previous session', () => {
    const current = makeExercise([makeSet(0), makeSet(1)]);
    const previous = makeExercise([
      makeSet(0, { loadKg: 100, reps: 8, rir: 2, completed: true }),
      makeSet(1, { loadKg: 95, reps: 9, rir: 2, completed: true }),
    ]);

    const suggestion = buildSetAutofillSuggestion(current, previous, 1);

    expect(suggestion.source).toBe('previous_session_set');
    expect(setAutofillPatch(suggestion)).toMatchObject({ loadKg: 95, reps: 9, rir: 2 });
  });

  it('falls back to the previous session top set when the matching set is missing', () => {
    const current = makeExercise([makeSet(0), makeSet(1), makeSet(2)]);
    const previous = makeExercise([
      makeSet(0, { loadKg: 100, reps: 8, rir: 1, completed: true }),
      makeSet(1, { loadKg: 95, reps: 9, rir: 2, completed: false }),
    ]);

    const suggestion = buildSetAutofillSuggestion(current, previous, 2);

    expect(suggestion.source).toBe('previous_session_top_set');
    expect(suggestion.detail).toBe('100 kg × 8 @ RIR 1');
  });

  it('uses the previous set from the current session when no history exists', () => {
    const current = makeExercise([
      makeSet(0, { loadKg: 80, reps: 10, rir: 2, completed: true }),
      makeSet(1),
    ]);

    const suggestion = buildSetAutofillSuggestion(current, null, 1);

    expect(suggestion.source).toBe('current_previous_set');
    expect(setAutofillPatch(suggestion)).toMatchObject({ loadKg: 80, reps: 10, rir: 2 });
  });

  it('returns the prescription floor for a brand-new exercise', () => {
    const current = makeExercise([makeSet(0)]);

    const suggestion = buildSetAutofillSuggestion(current, null, 0);

    expect(suggestion.source).toBe('prescription');
    expect(setAutofillPatch(suggestion)).toMatchObject({ loadKg: null, reps: 6, rir: 2 });
  });

  it('uses seconds rather than reps for a time-based prescription', () => {
    const current = makeExercise([makeSet(0)]);
    const suggestion = buildSetAutofillSuggestion(current, null, 0, 'kg', 'time');

    expect(setAutofillPatch(suggestion)).toMatchObject({
      loadKg: null,
      reps: null,
      durationSeconds: 6,
    });
  });
});
