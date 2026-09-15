import { summarizeWorkoutSession } from '../history';
import type { WorkoutSession } from '@/types';

describe('workout history summaries', () => {
  it('summarizes completed sets, volume, duration, and exercise rows', () => {
    const session: WorkoutSession = {
      id: 'session-1',
      userId: 'user-1',
      programId: null,
      programDayId: 'upper-a',
      dayName: 'Upper A',
      status: 'completed',
      startedAt: '2026-09-13T10:00:00.000Z',
      finishedAt: '2026-09-13T11:05:00.000Z',
      totalPausedSeconds: 300,
      exercises: [
        {
          id: 'performed-1',
          exerciseId: 'barbell-bench-press',
          order: 0,
          markedDiscomfort: false,
          markedUnavailable: false,
          prescription: {
            exerciseId: 'barbell-bench-press',
            order: 0,
            workingSets: 3,
            minReps: 6,
            maxReps: 10,
            targetRir: 1,
            restSeconds: 180,
            selectionReason: 'test',
          },
          sets: [
            {
              id: 'set-1',
              setNumber: 1,
              kind: 'working',
              loadKg: 100,
              reps: 8,
              durationSeconds: null,
              rir: 1,
              completed: true,
              skipped: false,
              completedAt: '2026-09-13T10:12:00.000Z',
            },
            {
              id: 'set-2',
              setNumber: 2,
              kind: 'working',
              loadKg: 100,
              reps: 7,
              durationSeconds: null,
              rir: 1,
              completed: true,
              skipped: false,
              completedAt: '2026-09-13T10:16:00.000Z',
            },
            {
              id: 'set-3',
              setNumber: 3,
              kind: 'working',
              loadKg: 100,
              reps: null,
              durationSeconds: null,
              rir: null,
              completed: false,
              skipped: false,
              completedAt: null,
            },
          ],
        },
      ],
    };

    const summary = summarizeWorkoutSession(session);

    expect(summary.durationMinutes).toBe(60);
    expect(summary.completedSets).toBe(2);
    expect(summary.exerciseCount).toBe(1);
    expect(summary.volumeKg).toBe(1500);
    expect(summary.exerciseSummaries[0]).toMatchObject({
      name: 'Barbell Bench Press',
      completedSets: 2,
      volumeKg: 1500,
      bestSetLabel: '100 kg x 8',
    });
    // Epley e1RM at 100kg x 8 reps: 100 * (1 + 8/30) rounded to 1 decimal.
    expect(summary.exerciseSummaries[0].bestE1rmKg).toBeCloseTo(126.7, 1);
  });

  it('counts drop-set sub-efforts toward volume and picks the heaviest effort as the best set', () => {
    const session: WorkoutSession = {
      id: 'session-2',
      userId: 'user-1',
      programId: null,
      programDayId: 'upper-a',
      dayName: 'Upper A',
      status: 'completed',
      startedAt: '2026-09-14T10:00:00.000Z',
      finishedAt: '2026-09-14T10:20:00.000Z',
      totalPausedSeconds: 0,
      exercises: [
        {
          id: 'performed-2',
          exerciseId: 'barbell-bench-press',
          order: 0,
          markedDiscomfort: false,
          markedUnavailable: false,
          prescription: {
            exerciseId: 'barbell-bench-press',
            order: 0,
            workingSets: 1,
            minReps: 6,
            maxReps: 10,
            targetRir: 1,
            restSeconds: 180,
            selectionReason: 'test',
          },
          sets: [
            {
              id: 'set-1',
              setNumber: 1,
              kind: 'working',
              loadKg: 100,
              reps: 8,
              durationSeconds: null,
              rir: 0,
              completed: true,
              skipped: false,
              completedAt: '2026-09-14T10:05:00.000Z',
              technique: 'drop_set',
              subEfforts: [
                { loadKg: 80, reps: 6, restSeconds: 0 },
                { loadKg: 60, reps: 6, restSeconds: 0 },
              ],
            },
          ],
        },
      ],
    };

    const summary = summarizeWorkoutSession(session);

    // 100*8 + 80*6 + 60*6 = 800 + 480 + 360 = 1640
    expect(summary.volumeKg).toBe(1640);
    // The primary set (100kg x 8) still outscores either drop.
    expect(summary.exerciseSummaries[0].bestSetLabel).toBe('100 kg x 8');
  });
});
