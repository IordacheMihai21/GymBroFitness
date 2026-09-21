import type { WorkoutSession } from '@/types';

export type WorkoutPersistenceOperations = {
  saveDraft(session: WorkoutSession): Promise<WorkoutSession>;
  finish(session: WorkoutSession): Promise<WorkoutSession>;
  discard(sessionId: string): Promise<void>;
};

export type WorkoutPersistenceController = ReturnType<typeof createWorkoutPersistenceController>;

/**
 * Serializes writes for one workout screen and makes finish idempotent. A
 * queued autosave checks the finish/discard barrier when it actually runs, so
 * a stale debounce cannot turn a completed session back into a draft.
 */
export function createWorkoutPersistenceController(operations: WorkoutPersistenceOperations) {
  let queue: Promise<void> = Promise.resolve();
  const finishingIds = new Set<string>();
  const blockedIds = new Set<string>();
  const finishedSessions = new Map<string, WorkoutSession>();
  const finishPromises = new Map<string, Promise<WorkoutSession>>();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function saveDraft(session: WorkoutSession): Promise<WorkoutSession> {
    return enqueue(() => {
      if (
        finishingIds.has(session.id) ||
        blockedIds.has(session.id) ||
        finishedSessions.has(session.id)
      ) {
        return Promise.resolve(session);
      }
      return operations.saveDraft(session);
    });
  }

  function finish(session: WorkoutSession): Promise<WorkoutSession> {
    const completed = finishedSessions.get(session.id);
    if (completed) return Promise.resolve(completed);

    const existing = finishPromises.get(session.id);
    if (existing) return existing;

    finishingIds.add(session.id);
    const pending = enqueue(() => operations.finish(session))
      .then((saved) => {
        finishedSessions.set(session.id, saved);
        return saved;
      })
      .finally(() => {
        finishingIds.delete(session.id);
        finishPromises.delete(session.id);
      });
    finishPromises.set(session.id, pending);
    return pending;
  }

  function discard(sessionId: string): Promise<void> {
    blockedIds.add(sessionId);
    return enqueue(() => operations.discard(sessionId)).catch((error: unknown) => {
      blockedIds.delete(sessionId);
      throw error;
    });
  }

  return { saveDraft, finish, discard };
}
