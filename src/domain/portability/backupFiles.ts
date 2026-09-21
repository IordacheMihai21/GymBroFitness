import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export async function shareTextFile({
  contents,
  filename,
  mimeType,
}: {
  contents: string;
  filename: string;
  mimeType: string;
}): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Export ${filename}` });
}

export async function pickBackupText(): Promise<string | null> {
  return pickTextFile(['application/json', 'text/json', 'text/plain']);
}

export async function pickWorkoutCsvText(): Promise<string | null> {
  return pickTextFile(['text/csv', 'text/comma-separated-values', 'text/plain']);
}

async function pickTextFile(type: string[]): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.size != null && asset.size > MAX_BACKUP_BYTES) {
    throw new Error('Backup is larger than the 25 MB safety limit.');
  }
  return new File(asset.uri).text();
}
