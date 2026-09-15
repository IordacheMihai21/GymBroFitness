import { createTestDb } from '@/db/createTestDb';

import {
  countTemplatesSql,
  deleteTemplateSql,
  importTemplatesSql,
  listTemplatesSql,
  saveTemplateSql,
} from '../templateRepository';
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

describe('saveTemplateSql', () => {
  it('upserts by id instead of duplicating on a second save', () => {
    const db = createTestDb();
    saveTemplateSql(db, makeTemplate({ name: 'First' }));
    saveTemplateSql(db, makeTemplate({ name: 'Renamed' }));

    const templates = listTemplatesSql(db);
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Renamed');
  });

  it('prunes beyond the max stored template count, keeping the newest', () => {
    const db = createTestDb();
    for (let i = 0; i < 55; i++) {
      saveTemplateSql(
        db,
        makeTemplate({ id: `template-${i}`, createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z` }),
      );
    }
    expect(countTemplatesSql(db)).toBe(50);
  });
});

describe('listTemplatesSql', () => {
  it('returns templates newest-first', () => {
    const db = createTestDb();
    saveTemplateSql(db, makeTemplate({ id: 'older', createdAt: '2026-09-01T00:00:00.000Z' }));
    saveTemplateSql(db, makeTemplate({ id: 'newer', createdAt: '2026-09-10T00:00:00.000Z' }));

    expect(listTemplatesSql(db).map((t) => t.id)).toEqual(['newer', 'older']);
  });
});

describe('deleteTemplateSql', () => {
  it('removes only the targeted template', () => {
    const db = createTestDb();
    saveTemplateSql(db, makeTemplate({ id: 'keep' }));
    saveTemplateSql(db, makeTemplate({ id: 'remove' }));

    deleteTemplateSql(db, 'remove');

    expect(listTemplatesSql(db).map((t) => t.id)).toEqual(['keep']);
  });
});

describe('importTemplatesSql', () => {
  it('is idempotent — importing the same template twice does not duplicate it', () => {
    const db = createTestDb();
    const template = makeTemplate();
    importTemplatesSql(db, [template]);
    importTemplatesSql(db, [template]);
    expect(countTemplatesSql(db)).toBe(1);
  });
});
