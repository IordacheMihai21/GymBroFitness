import type { WorkoutSession } from '@/types';

import {
  beginWorkoutReview,
  continueWorkoutFromReview,
  pauseWorkoutSession,
  resumeWorkoutSession,
} from '../session';

function session(): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    programId: null,
    programDayId: null,
    dayName: 'Push',
    status: 'in_progress',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: null,
    exercises: [],
    totalPausedSeconds: 15,
    pausedAt: null,
    restTimer: {
      durationSeconds: 120,
      endsAt: '2026-09-20T10:02:00.000Z',
    },
  };
}

describe('workout session pause accounting', () => {
  it('persists the pause start and clears an active rest timer', () => {
    const paused = pauseWorkoutSession(session(), new Date('2026-09-20T10:01:00.000Z'));

    expect(paused.status).toBe('paused');
    expect(paused.pausedAt).toBe('2026-09-20T10:01:00.000Z');
    expect(paused.restTimer).toBeNull();
  });

  it('adds only the elapsed pause duration when resumed', () => {
    const paused = pauseWorkoutSession(session(), new Date('2026-09-20T10:01:00.000Z'));
    const resumed = resumeWorkoutSession(paused, new Date('2026-09-20T10:02:30.000Z'));

    expect(resumed.status).toBe('in_progress');
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.totalPausedSeconds).toBe(105);
  });

  it('keeps review as a resumable draft until the user saves it', () => {
    const review = beginWorkoutReview(session(), new Date('2026-09-20T10:30:00.000Z'));

    expect(review.status).toBe('in_progress');
    expect(review.reviewStartedAt).toBe('2026-09-20T10:30:00.000Z');
    expect(review.restTimer).toBeNull();
    expect(continueWorkoutFromReview(review).reviewStartedAt).toBeNull();
  });
});
