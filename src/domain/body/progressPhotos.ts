import { uuid } from '@/utils/ids';

export type PhotoPose = 'front' | 'side' | 'back';

export const PHOTO_POSES: readonly PhotoPose[] = ['front', 'side', 'back'];

export const PHOTO_POSE_LABELS: Record<PhotoPose, string> = {
  front: 'Front',
  side: 'Side',
  back: 'Back',
};

export type ProgressPhoto = {
  id: string;
  userId: string;
  /** Calendar date the photo represents, `YYYY-MM-DD`. */
  takenAt: string;
  pose: PhotoPose | null;
  /** A stable file:// URI under this app's own document directory — never the
   * original picker/camera asset, which the OS can revoke or the user can
   * delete from their gallery independently of this app. */
  localUri: string;
  note?: string;
  createdAt: string;
};

export function createProgressPhoto(input: {
  userId: string;
  takenAt: string;
  localUri: string;
  pose?: PhotoPose | null;
  note?: string;
  now?: () => string;
}): ProgressPhoto {
  const now = input.now ?? (() => new Date().toISOString());
  return {
    id: uuid(),
    userId: input.userId,
    takenAt: input.takenAt,
    pose: input.pose ?? null,
    localUri: input.localUri,
    note: input.note,
    createdAt: now(),
  };
}

export function sortPhotosByDateDesc(photos: ProgressPhoto[]): ProgressPhoto[] {
  return [...photos].sort(
    (a, b) => b.takenAt.localeCompare(a.takenAt) || b.createdAt.localeCompare(a.createdAt),
  );
}
