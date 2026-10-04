import { desc, eq } from 'drizzle-orm';

import { decodePayload, encodePayload, progressPhotoPayloadSchema } from '@/db/payload';
import { dataRecoveryTable, progressPhotosTable } from '@/db/schema';
import type { GymBroDb } from '@/db/types';

import type { ProgressPhoto } from './progressPhotos';

/** Driver-agnostic SQL operations for progress photos — see `db/types.ts` for why. */

export function listProgressPhotosSql(db: GymBroDb): ProgressPhoto[] {
  const rows = db
    .select()
    .from(progressPhotosTable)
    .orderBy(desc(progressPhotosTable.takenAt), desc(progressPhotosTable.id))
    .all();

  return rows.flatMap((row) => {
    const photo = decodePhotoRow(db, row.id, row.payload);
    return photo ? [photo] : [];
  });
}

export function saveProgressPhotoSql(db: GymBroDb, photo: ProgressPhoto): ProgressPhoto {
  db.insert(progressPhotosTable)
    .values({ id: photo.id, takenAt: photo.takenAt, payload: encodePayload(photo) })
    .onConflictDoUpdate({
      target: progressPhotosTable.id,
      set: { takenAt: photo.takenAt, payload: encodePayload(photo) },
    })
    .run();
  return photo;
}

export function deleteProgressPhotoSql(db: GymBroDb, id: string): void {
  db.delete(progressPhotosTable).where(eq(progressPhotosTable.id, id)).run();
}

function decodePhotoRow(db: GymBroDb, id: string, payload: unknown): ProgressPhoto | null {
  const decoded = decodePayload(payload, progressPhotoPayloadSchema);
  if (!decoded.ok) {
    db.insert(dataRecoveryTable)
      .values({
        id: `progress-photo-read-${id}`,
        entityType: 'progress_photo',
        entityId: id,
        reason: decoded.reason,
        payload: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        migrationVersion: 1,
      })
      .onConflictDoNothing({ target: dataRecoveryTable.id })
      .run();
    return null;
  }

  if (decoded.legacy) {
    db.update(progressPhotosTable)
      .set({ payload: encodePayload(decoded.data) })
      .where(eq(progressPhotosTable.id, id))
      .run();
  }
  return decoded.data;
}
