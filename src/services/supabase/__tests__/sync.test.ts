import AsyncStorage from '@react-native-async-storage/async-storage';

import * as backupModule from '@/domain/portability/backup';

import { getSupabaseClient } from '../client';
import {
  clearLocalSyncMarker,
  inspectCloudSync,
  pushLocalBackup,
  restoreInspectedCloudBackup,
} from '../sync';

jest.mock('../client', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/domain/portability/backup', () => ({
  createBackupSnapshot: jest.fn(),
  previewBackupRestore: jest.fn(),
  restoreBackup: jest.fn(),
  parseBackup: jest.fn(),
  serializeBackup: jest.fn(),
}));

const mockedGetClient = getSupabaseClient as jest.Mock;
const markerKey = (userId: string) => `@GymBroFitness/sync/last-synced-at/${userId}`;

function fakeBackup(exportedAt = '2026-09-01T00:00:00.000Z') {
  return {
    source: 'GymBroFitness' as const,
    schemaVersion: 1 as const,
    exportedAt,
    profile: {} as never,
    activeProgram: {} as never,
    sessions: [],
    activeDraft: null,
    templates: [],
  };
}

function fakePreview(exportedAt = '2026-09-01T00:00:00.000Z') {
  return {
    exportedAt,
    sessionCount: 2,
    newSessionCount: 1,
    duplicateSessionCount: 1,
    templateCount: 1,
    newTemplateCount: 1,
    duplicateTemplateCount: 0,
    replacesProfile: true as const,
    replacesActiveProgram: true as const,
    draftAction: 'none' as const,
  };
}

function fakeSelectChain(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ maybeSingle: jest.fn().mockResolvedValue(result) }),
    }),
  };
}

function fakeUpsertChain(result: { data: unknown; error: unknown }) {
  return {
    upsert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue(result) }),
    }),
  };
}

beforeEach(async () => {
  mockedGetClient.mockReset();
  for (const fn of [
    backupModule.createBackupSnapshot,
    backupModule.previewBackupRestore,
    backupModule.restoreBackup,
    backupModule.parseBackup,
    backupModule.serializeBackup,
  ]) {
    (fn as jest.Mock).mockReset();
  }
  (backupModule.serializeBackup as jest.Mock).mockImplementation((backup) =>
    JSON.stringify(backup),
  );
  await AsyncStorage.clear();
});

describe('inspectCloudSync', () => {
  it('throws when sync is not configured', async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(inspectCloudSync('user-1')).rejects.toThrow('Sync is not configured');
  });

  it('plans a push when no remote backup exists', async () => {
    mockedGetClient.mockReturnValue({ from: () => fakeSelectChain({ data: null, error: null }) });
    await expect(inspectCloudSync('user-1')).resolves.toEqual({
      action: 'push',
      reason: 'no_remote',
    });
  });

  it('requires confirmation instead of automatically restoring unseen cloud data', async () => {
    const remote = fakeBackup('2026-09-05T00:00:00.000Z');
    const preview = fakePreview(remote.exportedAt);
    (backupModule.parseBackup as jest.Mock).mockReturnValue(remote);
    (backupModule.previewBackupRestore as jest.Mock).mockResolvedValue(preview);
    mockedGetClient.mockReturnValue({
      from: () =>
        fakeSelectChain({
          data: { payload: remote, updated_at: '2026-09-05T00:00:00.000Z' },
          error: null,
        }),
    });

    const inspection = await inspectCloudSync('user-1');

    expect(inspection).toEqual({
      action: 'confirm_remote',
      remote,
      remoteUpdatedAt: '2026-09-05T00:00:00.000Z',
      preview,
    });
    expect(backupModule.restoreBackup).not.toHaveBeenCalled();
  });

  it('plans a push when this user already saw the latest remote backup', async () => {
    await AsyncStorage.setItem(markerKey('user-1'), '2026-09-05T00:00:00.000Z');
    mockedGetClient.mockReturnValue({
      from: () =>
        fakeSelectChain({
          data: { payload: fakeBackup(), updated_at: '2026-09-05T00:00:00.000Z' },
          error: null,
        }),
    });

    await expect(inspectCloudSync('user-1')).resolves.toEqual({
      action: 'push',
      reason: 'remote_already_seen',
    });
  });

  it('does not share sync markers between accounts', async () => {
    await AsyncStorage.setItem(markerKey('user-1'), '2026-09-05T00:00:00.000Z');
    const remote = fakeBackup('2026-09-05T00:00:00.000Z');
    (backupModule.parseBackup as jest.Mock).mockReturnValue(remote);
    (backupModule.previewBackupRestore as jest.Mock).mockResolvedValue(fakePreview());
    mockedGetClient.mockReturnValue({
      from: () =>
        fakeSelectChain({
          data: { payload: remote, updated_at: '2026-09-05T00:00:00.000Z' },
          error: null,
        }),
    });

    await expect(inspectCloudSync('user-2')).resolves.toMatchObject({
      action: 'confirm_remote',
    });
  });

  it('rejects an invalid server date instead of overwriting either side', async () => {
    mockedGetClient.mockReturnValue({
      from: () =>
        fakeSelectChain({ data: { payload: fakeBackup(), updated_at: 'invalid' }, error: null }),
    });
    await expect(inspectCloudSync('user-1')).rejects.toThrow('invalid update date');
  });
});

describe('explicit sync actions', () => {
  it('pushes the local backup and stores a per-user marker', async () => {
    const local = fakeBackup();
    (backupModule.createBackupSnapshot as jest.Mock).mockResolvedValue(local);
    mockedGetClient.mockReturnValue({
      from: (table: string) => {
        expect(table).toBe('backups');
        return fakeUpsertChain({
          data: { updated_at: '2026-09-06T00:00:00.000Z' },
          error: null,
        });
      },
    });

    await expect(pushLocalBackup('user-1')).resolves.toEqual({
      action: 'pushed',
      updatedAt: '2026-09-06T00:00:00.000Z',
    });
    expect(await AsyncStorage.getItem(markerKey('user-1'))).toBe('2026-09-06T00:00:00.000Z');
  });

  it('restores only after the inspected backup is explicitly supplied', async () => {
    const remote = fakeBackup('2026-09-05T00:00:00.000Z');
    const inspection = {
      action: 'confirm_remote' as const,
      remote,
      remoteUpdatedAt: '2026-09-05T00:00:00.000Z',
      preview: fakePreview(),
    };

    await expect(restoreInspectedCloudBackup('user-1', inspection)).resolves.toEqual({
      action: 'pulled',
      updatedAt: inspection.remoteUpdatedAt,
    });
    expect(backupModule.restoreBackup).toHaveBeenCalledWith(remote);
    expect(await AsyncStorage.getItem(markerKey('user-1'))).toBe(inspection.remoteUpdatedAt);
  });

  it('propagates a Supabase write error without advancing the marker', async () => {
    (backupModule.createBackupSnapshot as jest.Mock).mockResolvedValue(fakeBackup());
    mockedGetClient.mockReturnValue({
      from: () => fakeUpsertChain({ data: null, error: new Error('write failed') }),
    });

    await expect(pushLocalBackup('user-1')).rejects.toThrow('write failed');
    expect(await AsyncStorage.getItem(markerKey('user-1'))).toBeNull();
  });

  it('clears only the selected account marker', async () => {
    await AsyncStorage.setItem(markerKey('user-1'), 'one');
    await AsyncStorage.setItem(markerKey('user-2'), 'two');
    await clearLocalSyncMarker('user-1');
    expect(await AsyncStorage.getItem(markerKey('user-1'))).toBeNull();
    expect(await AsyncStorage.getItem(markerKey('user-2'))).toBe('two');
  });
});
