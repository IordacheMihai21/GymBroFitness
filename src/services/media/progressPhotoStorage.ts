import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const PROGRESS_PHOTOS_DIR_NAME = 'progress-photos';

export type PickPhotoResult =
  { ok: true; localUri: string } | { ok: false; reason: 'permission_denied' | 'canceled' };

function progressPhotosDirectory(): Directory {
  const dir = new Directory(Paths.document, PROGRESS_PHOTOS_DIR_NAME);
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/**
 * Copies the picker/camera's own (often temporary or cache-scoped) asset into
 * this app's own document directory, so the photo survives independently of
 * the OS gallery or picker cache — the same reason `services/supabase`
 * doesn't touch it: this file never leaves the device.
 */
function importPickedAsset(sourceUri: string): string {
  const extensionMatch = /\.(\w+)$/.exec(sourceUri);
  const extension = extensionMatch ? extensionMatch[1] : 'jpg';
  const destination = new File(
    progressPhotosDirectory(),
    `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
  );
  new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function pickProgressPhotoFromLibrary(): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: 'permission_denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return { ok: false, reason: 'canceled' };

  return { ok: true, localUri: importPickedAsset(result.assets[0].uri) };
}

export async function captureProgressPhoto(): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: 'permission_denied' };

  const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  if (result.canceled || !result.assets[0]) return { ok: false, reason: 'canceled' };

  return { ok: true, localUri: importPickedAsset(result.assets[0].uri) };
}

/** Best-effort: a photo row should never fail to delete because its file is already gone. */
export function deleteStoredProgressPhoto(localUri: string): void {
  try {
    const file = new File(localUri);
    if (file.exists) file.delete();
  } catch {
    // Ignored — see above.
  }
}
