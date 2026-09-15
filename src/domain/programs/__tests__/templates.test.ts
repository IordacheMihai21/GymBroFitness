import {
  buildTemplateFromProgramDay,
  buildTemplateFromSession,
  defaultProgramDayTemplateName,
  defaultTemplateName,
} from '../templates';
import type { PerformedExercise, PerformedSet, WorkoutSession } from '@/types';

function makeSet(patch: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: 'set-1',
    setNumber: 1,
    kind: 'working',
    loadKg: 100,
    reps: 8,
    durationSeconds: null,
    rir: 2,
    completed: true,
    skipped: false,
    completedAt: null,
    ...patch,
  };
}

function makeExercise(
  exerciseId: string,
  order: number,
  sets: PerformedSet[],
  prescriptionPatch: Partial<PerformedExercise['prescription']> = {},
): PerformedExercise {
  return {
    id: `performed-${exerciseId}`,
    exerciseId,
    order,
    markedDiscomfort: false,
    markedUnavailable: false,
    prescription: {
      exerciseId,
      order,
      workingSets: sets.length,
      minReps: 6,
      maxReps: 10,
      targetRir: 2,
      restSeconds: 120,
      selectionReason: 'test',
      ...prescriptionPatch,
    },
    sets,
  };
}

function makeSession(exercises: PerformedExercise[]): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: 'upper-a',
    dayName: 'Upper A',
    status: 'completed',
    startedAt: '2026-09-14T10:00:00.000Z',
    finishedAt: '2026-09-14T10:45:00.000Z',
    exercises,
    totalPausedSeconds: 0,
  };
}

describe('buildTemplateFromSession', () => {
  it('carries over the exact prescriptions in exercise order', () => {
    const session = makeSession([
      makeExercise('barbell-row', 1, [makeSet()]),
      makeExercise('barbell-bench-press', 0, [makeSet()]),
    ]);

    const template = buildTemplateFromSession(session, 'My Upper Day');

    expect(template.name).toBe('My Upper Day');
    expect(template.sourceSessionId).toBe('session-1');
    expect(template.day.prescriptions.map((p) => p.exerciseId)).toEqual([
      'barbell-bench-press',
      'barbell-row',
    ]);
  });

  it('derives focus from the primary muscles of the trained exercises', () => {
    const session = makeSession([makeExercise('barbell-bench-press', 0, [makeSet()])]);
    const template = buildTemplateFromSession(session, 'Push Day');
    expect(template.day.focus).toContain('chest');
  });

  it('excludes exercises with no completed sets when others were trained', () => {
    const session = makeSession([
      makeExercise('barbell-bench-press', 0, [makeSet()]),
      makeExercise('barbell-row', 1, [makeSet({ completed: false })]),
    ]);
    const template = buildTemplateFromSession(session, 'Partial session');
    expect(template.day.prescriptions.map((p) => p.exerciseId)).toEqual(['barbell-bench-press']);
  });

  it('falls back to every exercise when nothing was completed', () => {
    const session = makeSession([
      makeExercise('barbell-bench-press', 0, [makeSet({ completed: false })]),
    ]);
    const template = buildTemplateFromSession(session, 'Untouched session');
    expect(template.day.prescriptions).toHaveLength(1);
  });

  it('uses the real session duration when one is available', () => {
    const session = makeSession([makeExercise('barbell-bench-press', 0, [makeSet()])]);
    const template = buildTemplateFromSession(session, 'Timed');
    expect(template.day.estimatedMinutes).toBe(45);
  });
});

describe('defaultTemplateName', () => {
  it('includes the day name and a short date', () => {
    const name = defaultTemplateName('Upper A', new Date('2026-09-14T10:00:00.000Z'));
    expect(name).toMatch(/^Upper A template · /);
  });
});

describe('buildTemplateFromProgramDay', () => {
  it('turns an edited program day into a replayable template', () => {
    const day = {
      id: 'push-a',
      name: 'Push A',
      order: 2,
      focus: ['chest' as const],
      estimatedMinutes: 64,
      prescriptions: [
        {
          exerciseId: 'barbell-row',
          order: 1,
          workingSets: 3,
          minReps: 8,
          maxReps: 12,
          targetRir: 2,
          restSeconds: 120,
          selectionReason: 'second',
        },
        {
          exerciseId: 'barbell-bench-press',
          order: 0,
          workingSets: 4,
          minReps: 6,
          maxReps: 10,
          targetRir: 1,
          restSeconds: 180,
          selectionReason: 'first',
        },
      ],
    };

    const template = buildTemplateFromProgramDay(day, 'Push A saved');

    expect(template.sourceSessionId).toBe('program-day:push-a');
    expect(template.day.name).toBe('Push A saved');
    expect(template.day.order).toBe(0);
    expect(template.day.estimatedMinutes).toBe(64);
    expect(template.day.prescriptions.map((prescription) => prescription.exerciseId)).toEqual([
      'barbell-bench-press',
      'barbell-row',
    ]);
    expect(template.day.prescriptions.map((prescription) => prescription.order)).toEqual([0, 1]);
    expect(template.day.focus).toEqual(expect.arrayContaining(['chest', 'back']));
  });
});

describe('defaultProgramDayTemplateName', () => {
  it('marks the template as coming from a plan', () => {
    const name = defaultProgramDayTemplateName('Push A', new Date('2026-09-14T10:00:00.000Z'));
    expect(name).toMatch(/^Push A plan · /);
  });
});
