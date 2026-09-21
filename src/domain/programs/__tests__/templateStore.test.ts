import { createTestDb } from '@/db/createTestDb';

import { countTemplatesSql, listTemplatesSql } from '../templateRepository';
import { migrateLegacyTemplates } from '../templateStore';
import type { WorkoutTemplate } from '../templates';

function makeTemplate(patch: Partial<WorkoutTemplate> = {}): WorkoutTemplate {
  return {
    id: 'template-1',
    name: 'Upper A template',
    createdAt: '2026-09-14T10:00:00.000Z',
    sourceSessionId: 'session-1',
    day: {
      id: 'day-1',
      name: 'Upper A',
      order: 0,
      focus: ['chest'],
      prescriptions: [],
      estimatedMinutes: 45,
    },
    ...patch,
  };
}

function makeStorage(raw: string | null, removeItem = jest.fn().mockResolvedValue(undefined)) {
  return {
    getItem: jest.fn().mockResolvedValue(raw),
    removeItem,
  };
}

describe('migrateLegacyTemplates', () => {
  it('imports a valid batch and removes its legacy source after commit', async () => {
    const db = createTestDb();
    const storage = makeStorage(JSON.stringify([makeTemplate()]));

    await migrateLegacyTemplates(storage, db);

    expect(listTemplatesSql(db)).toEqual([makeTemplate()]);
    expect(storage.removeItem).toHaveBeenCalledWith('@GymBroFitness/workout-templates/v1');
  });

  it('keeps the original batch when any template is invalid', async () => {
    const db = createTestDb();
    const storage = makeStorage(JSON.stringify([makeTemplate(), { id: 'incomplete' }]));

    await migrateLegacyTemplates(storage, db);

    expect(countTemplatesSql(db)).toBe(0);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('can retry safely if removing the legacy key fails', async () => {
    const db = createTestDb();
    const raw = JSON.stringify([makeTemplate()]);
    const failedStorage = makeStorage(
      raw,
      jest.fn().mockRejectedValue(new Error('storage unavailable')),
    );

    await expect(migrateLegacyTemplates(failedStorage, db)).rejects.toThrow('storage unavailable');
    expect(countTemplatesSql(db)).toBe(1);

    const retryStorage = makeStorage(raw);
    await migrateLegacyTemplates(retryStorage, db);
    expect(countTemplatesSql(db)).toBe(1);
    expect(retryStorage.removeItem).toHaveBeenCalledTimes(1);
  });
});
