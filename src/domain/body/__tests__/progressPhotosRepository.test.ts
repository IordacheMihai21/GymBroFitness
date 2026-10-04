import { createTestDb } from '@/db/createTestDb';

import { createProgressPhoto, type ProgressPhoto } from '../progressPhotos';
import {
  deleteProgressPhotoSql,
  listProgressPhotosSql,
  saveProgressPhotoSql,
} from '../progressPhotosRepository';

function makePhoto(patch: Partial<ProgressPhoto> = {}): ProgressPhoto {
  return createProgressPhoto({
    userId: 'user-1',
    takenAt: '2026-09-01',
    localUri: 'file:///doc/progress-photos/1.jpg',
    now: () => '2026-09-01T08:00:00.000Z',
    ...patch,
  });
}

describe('progress photos repository', () => {
  it('round-trips a saved photo', () => {
    const db = createTestDb();
    const photo = makePhoto();
    saveProgressPhotoSql(db, photo);
    expect(listProgressPhotosSql(db)).toEqual([photo]);
  });

  it('lists photos newest takenAt first', () => {
    const db = createTestDb();
    const older = makePhoto({ takenAt: '2026-09-01' });
    const newer = makePhoto({ takenAt: '2026-09-15' });
    saveProgressPhotoSql(db, older);
    saveProgressPhotoSql(db, newer);
    expect(listProgressPhotosSql(db).map((p) => p.id)).toEqual([newer.id, older.id]);
  });

  it('deletes a photo by id', () => {
    const db = createTestDb();
    const photo = makePhoto();
    saveProgressPhotoSql(db, photo);
    deleteProgressPhotoSql(db, photo.id);
    expect(listProgressPhotosSql(db)).toEqual([]);
  });
});
