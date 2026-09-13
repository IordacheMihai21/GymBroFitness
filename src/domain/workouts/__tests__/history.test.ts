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
  });
});
