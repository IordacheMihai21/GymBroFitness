import { Platform } from 'react-native';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';

import { remainingRestSeconds } from '@/domain/workouts/restTimer';
import type { RestTimerSnapshot } from '@/types';

const REST_TIMER_CHANNEL_ID = 'rest-timer-alerts';
const REST_TIMER_NOTIFICATION_TYPE = 'workout_rest_timer';

export type RestTimerNotificationStatus =
  'scheduled' | 'permission_denied' | 'expired' | 'unsupported' | 'error';

type NotificationPermission = Awaited<ReturnType<typeof getPermissionsAsync>>;

export function notificationPermissionGranted(permission: NotificationPermission): boolean {
  if (permission.granted) return true;
  if (Platform.OS !== 'ios') return false;
  return (
    permission.ios?.status === IosAuthorizationStatus.AUTHORIZED ||
    permission.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === IosAuthorizationStatus.EPHEMERAL
  );
}

async function cancelScheduledRestTimerNotifications(): Promise<void> {
  const scheduled = await getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.type === REST_TIMER_NOTIFICATION_TYPE)
      .map((request) => cancelScheduledNotificationAsync(request.identifier)),
  );
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: 'Rest timer',
      description: 'Alerts when a workout rest period ends.',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#4D96FF',
    });
  }

  const current = await getPermissionsAsync();
  if (notificationPermissionGranted(current)) return true;
  if (!current.canAskAgain || current.status !== 'undetermined') {
    return false;
  }

  const requested = await requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return notificationPermissionGranted(requested);
}

export async function scheduleRestTimerNotification(
  timer: RestTimerSnapshot,
  nowMs = Date.now(),
): Promise<RestTimerNotificationStatus> {
  if (Platform.OS === 'web') return 'unsupported';

  try {
    const secondsRemaining = remainingRestSeconds(timer, nowMs);
    await cancelScheduledRestTimerNotifications();
    if (secondsRemaining <= 0) return 'expired';
    if (!(await ensureNotificationPermission())) return 'permission_denied';

    await scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: 'You are ready for the next set.',
        sound: Platform.OS === 'ios' ? 'default' : undefined,
        data: { type: REST_TIMER_NOTIFICATION_TYPE },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(timer.endsAt),
        channelId: Platform.OS === 'android' ? REST_TIMER_CHANNEL_ID : undefined,
      },
    });
    return 'scheduled';
  } catch {
    return 'error';
  }
}

export async function clearRestTimerNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelScheduledRestTimerNotifications();
  } catch {
    // The in-app timer remains authoritative if native notification cleanup fails.
  }
}
