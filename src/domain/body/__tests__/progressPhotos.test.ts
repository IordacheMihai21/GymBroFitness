import { createProgressPhoto, sortPhotosByDateDesc, type ProgressPhoto } from '../progressPhotos';

function makePhoto(patch: Partial<ProgressPhoto> = {}): ProgressPhoto {
  return {
    id: 'photo-1',
    userId: 'user-1',
    takenAt: '2026-09-01',
    pose: 'front',
    localUri: 'file:///doc/progress-photos/1.jpg',
    createdAt: '2026-09-01T08:00:00.000Z',
    ...patch,
  };
}

describe('createProgressPhoto', () => {
  it('defaults pose to null when not provided', () => {
    const photo = createProgressPhoto({
      userId: 'user-1',
      takenAt: '2026-09-01',
      localUri: 'file:///doc/progress-photos/1.jpg',
      now: () => '2026-09-01T08:00:00.000Z',
    });
    expect(photo.pose).toBeNull();
    expect(photo.id.length).toBeGreaterThan(0);
  });
});

describe('sortPhotosByDateDesc', () => {
  it('orders newest takenAt first', () => {
    const older = makePhoto({ id: 'a', takenAt: '2026-09-01' });
    const newer = makePhoto({ id: 'b', takenAt: '2026-09-15' });
    expect(sortPhotosByDateDesc([older, newer]).map((p) => p.id)).toEqual(['b', 'a']);
  });
});
