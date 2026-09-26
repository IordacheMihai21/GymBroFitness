import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createBackupSnapshot,
  parseBackup,
  previewBackupRestore,
  restoreBackup,
  serializeBackup,
  type BackupPreview,
  type GymBroBackup,
} from '@/domain/portability/backup';

import { getSupabaseClient } from './client';

const TABLE = 'backups';
const LAST_SYNCED_AT_KEY_PREFIX = '@GymBroFitness/sync/last-synced-at';

export type SyncResult =
  { action: 'pushed'; updatedAt: string } | { action: 'pulled'; updatedAt: string };

export type CloudSyncInspection =
  | { action: 'push'; reason: 'no_remote' | 'remote_already_seen' }
  | {
      action: 'confirm_remote';
      remote: GymBroBackup;
      remoteUpdatedAt: string;
      preview: BackupPreview;
    };

type RemoteBackupRow = { payload: unknown; updated_at: string };

function markerKey(userId: string): string {
  return `${LAST_SYNCED_AT_KEY_PREFIX}/${userId}`;
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Sync is not configured for this build.');
  return client;
}

async function fetchRemoteBackup(userId: string): Promise<RemoteBackupRow | null> {
  const { data, error } = await requireClient()
    .from(TABLE)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle<RemoteBackupRow>();
  if (error) throw error;
  if (data && Number.isNaN(Date.parse(data.updated_at))) {
    throw new Error('The cloud backup has an invalid update date. Nothing was changed.');
  }
  return data;
}

/**
 * Reads cloud state without changing local or remote data. A cloud restore is
 * deliberately returned as a confirmation step because it replaces the local
 * profile and active program (history/templates are merged by ID).
 */
export async function inspectCloudSync(userId: string): Promise<CloudSyncInspection> {
  const data = await fetchRemoteBackup(userId);
  if (!data) return { action: 'push', reason: 'no_remote' };

  const lastSyncedAt = await AsyncStorage.getItem(markerKey(userId));
  const remoteIsNewer =
    lastSyncedAt == null || Date.parse(data.updated_at) > Date.parse(lastSyncedAt);
  if (!remoteIsNewer) return { action: 'push', reason: 'remote_already_seen' };

  const remote = parseBackup(JSON.stringify(data.payload));
  const preview = await previewBackupRestore(remote);
  return {
    action: 'confirm_remote',
    remote,
    remoteUpdatedAt: data.updated_at,
    preview,
  };
}

/** Pushes a complete local snapshot. Call only after inspection, or after the
 * user explicitly chooses to keep this device when a newer cloud copy exists.
 */
export async function pushLocalBackup(userId: string): Promise<SyncResult> {
  const localBackup = await createBackupSnapshot();
  const updatedAt = await pushBackup(userId, localBackup);
  await AsyncStorage.setItem(markerKey(userId), updatedAt);
  return { action: 'pushed', updatedAt };
}

/** Applies exactly the cloud snapshot the user reviewed in the confirmation
 * dialog. A recovery snapshot is created by restoreBackup before any writes.
 */
export async function restoreInspectedCloudBackup(
  userId: string,
  inspection: Extract<CloudSyncInspection, { action: 'confirm_remote' }>,
): Promise<SyncResult> {
  await restoreBackup(inspection.remote);
  await AsyncStorage.setItem(markerKey(userId), inspection.remoteUpdatedAt);
  return { action: 'pulled', updatedAt: inspection.remoteUpdatedAt };
}

async function pushBackup(userId: string, backup: GymBroBackup): Promise<string> {
  const payload = JSON.parse(serializeBackup(backup));
  const { data, error } = await requireClient()
    .from(TABLE)
    .upsert({ user_id: userId, payload }, { onConflict: 'user_id' })
    .select('updated_at')
    .single<{ updated_at: string }>();
  if (error) throw error;
  if (!data || Number.isNaN(Date.parse(data.updated_at))) {
    throw new Error('The cloud did not return a valid backup date.');
  }
  return data.updated_at;
}

export async function clearLocalSyncMarker(userId: string): Promise<void> {
  await AsyncStorage.removeItem(markerKey(userId));
}
