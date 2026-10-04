import { getDb } from '@/db/client';

import type { BodyMeasurementEntry } from './measurements';
import {
  deleteBodyMeasurementSql,
  listBodyMeasurementsSql,
  saveBodyMeasurementSql,
} from './measurementsRepository';
import type { ProgressPhoto } from './progressPhotos';
import {
  deleteProgressPhotoSql,
  listProgressPhotosSql,
  saveProgressPhotoSql,
} from './progressPhotosRepository';

export async function listBodyMeasurements(): Promise<BodyMeasurementEntry[]> {
  return listBodyMeasurementsSql(getDb());
}

export async function saveBodyMeasurement(
  entry: BodyMeasurementEntry,
): Promise<BodyMeasurementEntry> {
  return saveBodyMeasurementSql(getDb(), entry);
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  deleteBodyMeasurementSql(getDb(), id);
}

export async function listProgressPhotos(): Promise<ProgressPhoto[]> {
  return listProgressPhotosSql(getDb());
}

export async function saveProgressPhoto(photo: ProgressPhoto): Promise<ProgressPhoto> {
  return saveProgressPhotoSql(getDb(), photo);
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  deleteProgressPhotoSql(getDb(), id);
}
