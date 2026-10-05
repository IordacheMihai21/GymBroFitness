import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { listBodyMeasurements, saveBodyMeasurement } from '@/domain/body/bodyTrackingStore';
import { requireExercise } from '@/domain/exercises/catalog';
import {
  mergeHealthWeights,
  summarizeHeartRate,
  workoutToExerciseSession,
  type HeartRateSummary,
} from '@/domain/health/healthSync';
import type { WorkoutSession } from '@/types';

/**
 * Android Health Connect: body weight in (smart scales, Samsung Health),
 * heart rate during workouts in (watches), finished workouts out. Nothing runs
 * until the lifter connects it in Profile, and every failure is swallowed:
 * Health Connect is a bonus, never a reason a workout fails to save.
 */

const SETTINGS_KEY = '@GymBroFitness/health-connect/v1';
const WEIGHT_LOOKBACK_DAYS = 180;
const WEIGHT_SYNC_EVERY_MS = 6 * 60 * 60 * 1000;

export type HealthConnectStatus = 'unsupported' | 'needs_install' | 'available';

export type HealthConnectSettings = {
  connected: boolean;
  lastWeightSyncAt: string | null;
};

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'ExerciseSession' },
] as const;

export type HealthPermissionKey = 'weight' | 'heartRate' | 'workouts';

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'needs_install';
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export async function loadHealthSettings(): Promise<HealthConnectSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { connected: false, lastWeightSyncAt: null, ...JSON.parse(raw) };
  } catch {
    // Fall through to defaults.
  }
  return { connected: false, lastWeightSyncAt: null };
}

async function saveHealthSettings(settings: HealthConnectSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings are best-effort.
  }
}

let initialized: Promise<boolean> | null = null;
function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    initialized = initialize().catch(() => {
      initialized = null;
      return false;
    });
  }
  return initialized;
}

/** Which of weight / heart rate / workouts the lifter has allowed. */
export async function grantedHealthPermissions(): Promise<Set<HealthPermissionKey>> {
  const granted = new Set<HealthPermissionKey>();
  if (Platform.OS !== 'android' || !(await ensureInitialized())) return granted;
  try {
    for (const permission of await getGrantedPermissions()) {
      if (!('recordType' in permission)) continue;
      if (permission.recordType === 'Weight' && permission.accessType === 'read') {
        granted.add('weight');
      }
      if (permission.recordType === 'HeartRate' && permission.accessType === 'read') {
        granted.add('heartRate');
      }
      if (permission.recordType === 'ExerciseSession' && permission.accessType === 'write') {
        granted.add('workouts');
      }
    }
  } catch {
    // Treat as nothing granted.
  }
  return granted;
}

/** Shows the Health Connect permission screen; the lifter picks what to share. */
export async function connectHealthConnect(): Promise<Set<HealthPermissionKey>> {
  if (!(await ensureInitialized())) return new Set();
  try {
    await requestPermission([...PERMISSIONS]);
  } catch {
    return new Set();
  }
  const granted = await grantedHealthPermissions();
  const settings = await loadHealthSettings();
  await saveHealthSettings({ ...settings, connected: granted.size > 0 });
  return granted;
}

export async function disconnectHealthConnect(): Promise<void> {
  const settings = await loadHealthSettings();
  await saveHealthSettings({ ...settings, connected: false });
}

export function openHealthConnectPermissions(): void {
  try {
    openHealthConnectSettings();
  } catch {
    // Nothing to open on this device.
  }
}

/**
 * Imports body weight from the last six months into the Body tab. Returns how
 * many days were added. Throttled unless `force`.
 */
export async function syncWeightFromHealthConnect(
  userId: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const settings = await loadHealthSettings();
  if (!settings.connected) return 0;
  if (
    !options.force &&
    settings.lastWeightSyncAt &&
    now.getTime() - new Date(settings.lastWeightSyncAt).getTime() < WEIGHT_SYNC_EVERY_MS
  ) {
    return 0;
  }
  if (!(await grantedHealthPermissions()).has('weight')) return 0;

  try {
    const start = new Date(now.getTime() - WEIGHT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const { records } = await readRecords('Weight', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: now.toISOString(),
      },
      pageSize: 1000,
    });
    const samples = records.map((record) => ({
      time: record.time,
      kg: record.weight.inKilograms,
    }));
    const toSave = mergeHealthWeights(await listBodyMeasurements(), samples, userId);
    for (const entry of toSave) await saveBodyMeasurement(entry);
    await saveHealthSettings({ ...settings, lastWeightSyncAt: now.toISOString() });
    return toSave.length;
  } catch {
    return 0;
  }
}

/** Heart rate recorded by a watch or band during the workout, if any. */
export async function readWorkoutHeartRate(
  startIso: string,
  endIso: string,
): Promise<HeartRateSummary | null> {
  const settings = await loadHealthSettings();
  if (!settings.connected || !(await grantedHealthPermissions()).has('heartRate')) return null;
  try {
    const { records } = await readRecords('HeartRate', {
      timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
      pageSize: 500,
    });
    const points = records.flatMap((record) =>
      record.samples.map((sample) => ({ time: sample.time, bpm: sample.beatsPerMinute })),
    );
    return summarizeHeartRate(points, startIso, endIso);
  } catch {
    return null;
  }
}

/** Writes the finished workout to Health Connect as a strength-training session. */
export async function exportWorkoutToHealthConnect(session: WorkoutSession): Promise<boolean> {
  const settings = await loadHealthSettings();
  if (!settings.connected || !(await grantedHealthPermissions()).has('workouts')) return false;
  const exported = workoutToExerciseSession(session, (id) => requireExercise(id).name);
  if (!exported) return false;
  try {
    await insertRecords([
      {
        recordType: 'ExerciseSession',
        exerciseType: ExerciseType.STRENGTH_TRAINING,
        startTime: exported.startTime,
        endTime: exported.endTime,
        title: exported.title,
        notes: exported.notes,
        // A newer version replaces the earlier export of the same workout.
        metadata: {
          clientRecordId: exported.clientRecordId,
          clientRecordVersion: Math.floor(Date.now() / 1000),
        },
      },
    ]);
    return true;
  } catch {
    return false;
  }
}
