import { generateProgram } from '@/domain/programs/generator';
import { DEFAULT_USER_PROFILE } from '@/domain/programs/profileStore';
import { DEMO_PREFERENCES } from '@/domain/programs/demoPreferences';
import type { WorkoutSession } from '@/types';

import {
  BACKUP_SCHEMA_VERSION,
  parseBackup,
  serializeBackup,
  workoutHistoryToCsv,
  type GymBroBackup,
} from '../backup';

function completedSession(id = 'session-1'): WorkoutSession {
  return {
    id,
    userId: DEFAULT_USER_PROFILE.id,
    programId: null,
    programDayId: null,
    dayName: 'Upper, heavy',
    status: 'completed',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: '2026-09-20T11:00:00.000Z',
    totalPausedSeconds: 0,
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
          workingSets: 1,
          minReps: 6,
          maxReps: 10,
          targetRir: 2,
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
            rir: 2,
            completed: true,
            skipped: false,
            completedAt: '2026-09-20T10:10:00.000Z',
          },
        ],
      },
    ],
  };
}

function backup(): GymBroBackup {
  return {
    source: 'GymBroFitness',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-09-21T12:00:00.000Z',
    profile: { user: DEFAULT_USER_PROFILE, preferences: DEMO_PREFERENCES },
    activeProgram: generateProgram(DEMO_PREFERENCES, DEFAULT_USER_PROFILE.id),
    sessions: [completedSession()],
    activeDraft: null,
    templates: [],
  };
}

describe('portable backup', () => {
  it('round-trips a complete versioned backup', () => {
    const source = backup();
    expect(parseBackup(serializeBackup(source))).toEqual(source);
  });

  it('rejects unknown versions and duplicate session IDs before restore', () => {
    expect(() => parseBackup(JSON.stringify({ ...backup(), schemaVersion: 99 }))).toThrow(
      'Unsupported backup version',
    );

    const duplicate = completedSession();
    expect(() =>
      parseBackup(JSON.stringify({ ...backup(), sessions: [duplicate, duplicate] })),
    ).toThrow('duplicate IDs');
  });

  it('exports completed sets as canonical-kg CSV with escaped text', () => {
    const csv = workoutHistoryToCsv([completedSession()]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('load_kg');
    expect(lines[1]).toContain('"Upper, heavy"');
    expect(lines[1]).toContain('Barbell Bench Press');
    expect(lines[1]).toContain(',100,8,,2');
  });
});
