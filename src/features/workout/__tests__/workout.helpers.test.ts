import type { PendingFormAnalysisResult } from '@/domain/vision/formAnalysisResultStore';
import type { SetAutofillSuggestion } from '@/domain/workouts/setAutofill';
import type {
  PerformedExercise,
  PerformedSet,
  SetFormAnalysis,
  TrainingPreferences,
  WorkoutSession,
} from '@/types';

import {
  attachFormAnalysisResult,
  autosaveIcon,
  autosaveLabel,
  buildCustomWorkoutDay,
  cameraAngleLabel,
  compactSuggestionValue,
  countCompletedSets,
  countHandledSets,
  firstOpenSetIndex,
  formatRest,
  isExerciseDone,
  isResumableSession,
  shortExerciseName,
  sourceLabel,
  techniqueLabel,
} from '../workout.helpers';

function set(id: string, overrides: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id,
    setNumber: 1,
    kind: 'working',
    loadKg: 80,
    reps: 8,
    durationSeconds: null,
    rir: null,
    completed: false,
    skipped: false,
    completedAt: null,
    ...overrides,
  };
}

function exercise(id: string, sets: PerformedSet[]): PerformedExercise {
  return {
    id: `performed-${id}`,
    exerciseId: id,
    order: 0,
    prescription: {
      exerciseId: id,
      order: 0,
      workingSets: sets.length,
      minReps: 6,
      maxReps: 10,
      targetRir: 2,
      restSeconds: 90,
      selectionReason: 'test',
    },
    sets,
    markedDiscomfort: false,
    markedUnavailable: false,
  };
}

const preferences: TrainingPreferences = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  environment: 'commercial_gym',
  equipment: ['barbell', 'dumbbell', 'bench', 'bodyweight'],
  daysPerWeek: 4,
  preferredDays: [0, 1, 3, 4],
  sessionMinutes: 60,
  musclePriorities: ['chest'],
  preferredExerciseSlugs: [],
  dislikedExerciseSlugs: [],
  excludedExerciseSlugs: [],
  discomfortExerciseSlugs: [],
  units: 'kg',
  coachingTone: 'direct',
};

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Test',
    status: 'in_progress',
    startedAt: '2026-09-20T08:00:00.000Z',
    finishedAt: null,
    exercises: [exercise('barbell-bench-press', [set('set-1')])],
    totalPausedSeconds: 0,
    ...overrides,
  };
}

describe('countCompletedSets', () => {
  it('counts only sets that are completed and not skipped, across exercises', () => {
    const exercises = [
      exercise('a', [set('a1', { completed: true }), set('a2', { skipped: true })]),
      exercise('b', [set('b1', { completed: true }), set('b2')]),
    ];
    expect(countCompletedSets(exercises)).toBe(2);
  });
});

describe('countHandledSets', () => {
  it('counts completed OR skipped sets', () => {
    const exercises = [
      exercise('a', [set('a1', { completed: true }), set('a2', { skipped: true })]),
      exercise('b', [set('b1')]),
    ];
    expect(countHandledSets(exercises)).toBe(2);
  });
});

describe('isExerciseDone', () => {
  it('is true only when every set is completed or skipped', () => {
    expect(isExerciseDone(exercise('a', [set('a1', { completed: true })]))).toBe(true);
    expect(isExerciseDone(exercise('a', [set('a1', { skipped: true })]))).toBe(true);
    expect(
      isExerciseDone(exercise('a', [set('a1', { completed: true }), set('a2')])),
    ).toBe(false);
  });
});

describe('isResumableSession', () => {
  it('is true for in_progress and paused, false otherwise', () => {
    expect(isResumableSession(session({ status: 'in_progress' }))).toBe(true);
    expect(isResumableSession(session({ status: 'paused' }))).toBe(true);
    expect(isResumableSession(session({ status: 'completed' }))).toBe(false);
  });
});

describe('firstOpenSetIndex', () => {
  it('returns the index of the first not-completed, not-skipped set', () => {
    const sets = [set('a', { completed: true }), set('b', { skipped: true }), set('c')];
    expect(firstOpenSetIndex(sets)).toBe(2);
  });

  it('returns null when every set is handled', () => {
    const sets = [set('a', { completed: true }), set('b', { skipped: true })];
    expect(firstOpenSetIndex(sets)).toBeNull();
  });
});

describe('shortExerciseName', () => {
  it('drops the equipment prefix and abbreviates known long names', () => {
    expect(shortExerciseName('Barbell Bench Press')).toBe('Bench Press');
    expect(shortExerciseName('Dumbbell Row')).toBe('DB Row');
    expect(shortExerciseName('Romanian Deadlift')).toBe('RDL');
  });
});

describe('formatRest', () => {
  it('formats whole minutes without seconds', () => {
    expect(formatRest(120)).toBe('2m');
  });

  it('formats a partial minute with padded seconds', () => {
    expect(formatRest(95)).toBe('1:35');
  });

  it('reads "done" at or below zero', () => {
    expect(formatRest(0)).toBe('done');
    expect(formatRest(-5)).toBe('done');
  });
});

describe('autosaveIcon / autosaveLabel', () => {
  it('maps every autosave state to a distinct icon', () => {
    const icons = new Set(
      (['idle', 'restored', 'saving', 'saved', 'error'] as const).map(autosaveIcon),
    );
    expect(icons.size).toBe(5);
  });

  it('labels a saved state with the formatted time when available', () => {
    expect(autosaveLabel('saved', '2026-09-20T10:30:00.000Z')).toMatch(/^Autosaved /);
    expect(autosaveLabel('saved', null)).toBe('Autosaved');
  });

  it('labels the other states plainly', () => {
    expect(autosaveLabel('restored', null)).toBe('Draft restored');
    expect(autosaveLabel('saving', null)).toBe('Saving draft');
    expect(autosaveLabel('error', null)).toBe('Autosave issue');
    expect(autosaveLabel('idle', null)).toBe('Draft ready');
  });
});

function suggestion(overrides: Partial<SetAutofillSuggestion> = {}): SetAutofillSuggestion {
  return {
    source: 'prescription',
    loadKg: null,
    reps: null,
    durationSeconds: null,
    rir: null,
    label: 'target',
    detail: 'test',
    ...overrides,
  };
}

describe('compactSuggestionValue', () => {
  it('prefers duration for time-tracked suggestions', () => {
    expect(compactSuggestionValue(suggestion({ durationSeconds: 45 }), 'kg')).toBe('45s');
  });

  it('formats load and reps for weight-tracked suggestions', () => {
    expect(compactSuggestionValue(suggestion({ loadKg: 60, reps: 8 }), 'kg')).toBe('60 kg × 8');
  });

  it('falls back to reps-only, then a generic label', () => {
    expect(compactSuggestionValue(suggestion({ reps: 12 }), 'kg')).toBe('12 reps');
    expect(compactSuggestionValue(suggestion(), 'kg')).toBe('target');
  });
});

describe('sourceLabel', () => {
  it('gives a short label for every autofill source', () => {
    expect(sourceLabel('previous_session_set')).toBe('last set');
    expect(sourceLabel('previous_session_top_set')).toBe('top set');
    expect(sourceLabel('current_previous_set')).toBe('this lift');
    expect(sourceLabel('prescription')).toBe('plan');
  });
});

describe('techniqueLabel', () => {
  it('labels every set technique', () => {
    expect(techniqueLabel('drop_set')).toBe('Drop set');
    expect(techniqueLabel('rest_pause')).toBe('Rest-pause');
    expect(techniqueLabel('standard')).toBe('Standard');
  });
});

describe('cameraAngleLabel', () => {
  it('labels every recommended camera angle', () => {
    expect(cameraAngleLabel('front')).toBe('front');
    expect(cameraAngleLabel('side')).toBe('side');
    expect(cameraAngleLabel('front-45')).toBe('45°');
  });
});

describe('buildCustomWorkoutDay', () => {
  it('returns null when disabled or missing exercise ids', () => {
    expect(
      buildCustomWorkoutDay({ enabled: false, idsParam: 'barbell-bench-press', preferences }),
    ).toBeNull();
    expect(buildCustomWorkoutDay({ enabled: true, preferences })).toBeNull();
  });

  it('returns null when none of the ids resolve to a real exercise', () => {
    expect(
      buildCustomWorkoutDay({
        enabled: true,
        idsParam: 'not-a-real-exercise-id',
        preferences,
      }),
    ).toBeNull();
  });

  it('builds a day from valid exercise ids, defaulting the name', () => {
    const day = buildCustomWorkoutDay({
      enabled: true,
      idsParam: 'barbell-bench-press',
      preferences,
    });
    expect(day).not.toBeNull();
    expect(day?.name).toBe('Custom Workout');
    expect(day?.prescriptions).toHaveLength(1);
  });

  it('uses the provided name when given', () => {
    const day = buildCustomWorkoutDay({
      enabled: true,
      idsParam: 'barbell-bench-press',
      nameParam: 'Push Day',
      preferences,
    });
    expect(day?.name).toBe('Push Day');
  });
});

describe('attachFormAnalysisResult', () => {
  const analysis: SetFormAnalysis = {
    id: 'analysis-1',
    exerciseId: 'barbell-bench-press',
    capturedAt: '2026-09-20T10:00:00.000Z',
    repCount: 8,
    averageScore: 91,
    averageRomScore: 90,
    averageTempoScore: 88,
    bestRepScore: 95,
    worstRepScore: 85,
    mostCommonIssue: null,
    recommendations: [],
    velocityLossPct: null,
  };

  function result(overrides: Partial<PendingFormAnalysisResult> = {}): PendingFormAnalysisResult {
    return { sessionId: 'session-1', exerciseIndex: 0, setIndex: 0, analysis, ...overrides };
  }

  it('attaches the analysis to the targeted set, filling in reps when missing', () => {
    const withUnloggedReps = session({
      exercises: [exercise('barbell-bench-press', [set('set-1', { reps: null })])],
    });
    const next = attachFormAnalysisResult(withUnloggedReps, result());
    expect(next.exercises[0].sets[0].formAnalysis).toEqual(analysis);
    expect(next.exercises[0].sets[0].reps).toBe(8);
  });

  it('does not overwrite reps the lifter already logged', () => {
    const next = attachFormAnalysisResult(session(), result());
    expect(next.exercises[0].sets[0].reps).toBe(8);
  });

  it('is a no-op when the session id does not match', () => {
    const original = session();
    const next = attachFormAnalysisResult(original, result({ sessionId: 'other-session' }));
    expect(next).toBe(original);
  });

  it('is a no-op when the target exercise/set does not exist', () => {
    const original = session();
    const next = attachFormAnalysisResult(original, result({ exerciseIndex: 5 }));
    expect(next).toBe(original);
  });

  it('is a no-op when the analysis exercise does not match the set’s exercise', () => {
    const original = session();
    const next = attachFormAnalysisResult(
      original,
      result({ analysis: { ...analysis, exerciseId: 'squat' } }),
    );
    expect(next).toBe(original);
  });
});
