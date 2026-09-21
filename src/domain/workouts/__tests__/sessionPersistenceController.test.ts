import type { WorkoutSession } from '@/types';

import { createWorkoutPersistenceController } from '../sessionPersistenceController';

function makeSession(patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: 'upper-a',
    dayName: 'Upper A',
    status: 'in_progress',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: null,
    exercises: [],
    totalPausedSeconds: 0,
    ...patch,
  };
}

function makeOperations() {
  return {
    saveDraft: jest.fn(async (session: WorkoutSession) => session),
    finish: jest.fn(async (session: WorkoutSession) => ({
      ...session,
      status: 'completed' as const,
    })),
    discard: jest.fn(async () => undefined),
  };
}

describe('createWorkoutPersistenceController', () => {
  it('serializes an earlier autosave before finish so completion is the last write', async () => {
    const calls: string[] = [];
    const operations = makeOperations();
    operations.saveDraft.mockImplementation(async (session) => {
      calls.push('draft');
      return session;
    });
    operations.finish.mockImplementation(async (session) => {
      calls.push('finish');
      return { ...session, status: 'completed' };
    });
    const controller = createWorkoutPersistenceController(operations);

    const draft = controller.saveDraft(makeSession());
    await Promise.resolve();
    const finish = controller.finish(makeSession({ status: 'completed' }));
    await Promise.all([draft, finish]);

    expect(calls).toEqual(['draft', 'finish']);
  });

  it('suppresses stale autosaves once finish has started', async () => {
    const operations = makeOperations();
    const controller = createWorkoutPersistenceController(operations);

    const finish = controller.finish(makeSession({ status: 'completed' }));
    await controller.saveDraft(makeSession());
    await finish;

    expect(operations.finish).toHaveBeenCalledTimes(1);
    expect(operations.saveDraft).not.toHaveBeenCalled();
  });

  it('coalesces repeated finish requests and returns the committed session', async () => {
    const operations = makeOperations();
    const controller = createWorkoutPersistenceController(operations);
    const session = makeSession({ status: 'completed' });

    const [first, second] = await Promise.all([
      controller.finish(session),
      controller.finish(session),
    ]);
    const third = await controller.finish(session);

    expect(operations.finish).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(third.status).toBe('completed');
  });

  it('allows finish to be retried after a failed write', async () => {
    const operations = makeOperations();
    operations.finish
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockImplementationOnce(async (session) => ({ ...session, status: 'completed' }));
    const controller = createWorkoutPersistenceController(operations);
    const session = makeSession({ status: 'completed' });

    await expect(controller.finish(session)).rejects.toThrow('database unavailable');
    await expect(controller.finish(session)).resolves.toMatchObject({ status: 'completed' });
    expect(operations.finish).toHaveBeenCalledTimes(2);
  });

  it('blocks autosaves after discard is requested', async () => {
    const operations = makeOperations();
    const controller = createWorkoutPersistenceController(operations);

    await Promise.all([controller.discard('session-1'), controller.saveDraft(makeSession())]);

    expect(operations.discard).toHaveBeenCalledWith('session-1');
    expect(operations.saveDraft).not.toHaveBeenCalled();
  });
});
