import * as PermissionApi from 'expo-notifications/build/NotificationPermissions';
import * as CancelApi from 'expo-notifications/build/cancelScheduledNotificationAsync';
import * as ScheduledApi from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import * as ScheduleApi from 'expo-notifications/build/scheduleNotificationAsync';
import * as ChannelApi from 'expo-notifications/build/setNotificationChannelAsync';

import {
  clearRestTimerNotification,
  scheduleRestTimerNotification,
} from '../restTimerNotifications';

jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('expo-notifications/build/NotificationPermissions.types', () => ({
  IosAuthorizationStatus: { DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
jest.mock('expo-notifications/build/Notifications.types', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/getAllScheduledNotificationsAsync', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: jest.fn(),
}));

const mockGetPermissions = jest.mocked(PermissionApi.getPermissionsAsync);
const mockRequestPermissions = jest.mocked(PermissionApi.requestPermissionsAsync);
const mockCancel = jest.mocked(CancelApi.cancelScheduledNotificationAsync);
const mockGetScheduled = jest.mocked(ScheduledApi.getAllScheduledNotificationsAsync);
const mockSchedule = jest.mocked(ScheduleApi.scheduleNotificationAsync);
const mockSetChannel = jest.mocked(ChannelApi.setNotificationChannelAsync);

describe('rest timer notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetScheduled.mockResolvedValue([]);
    mockCancel.mockResolvedValue(undefined);
    mockSchedule.mockResolvedValue('rest-notification');
    mockSetChannel.mockResolvedValue(null);
  });

  it('replaces only prior rest alerts and schedules the current deadline', async () => {
    mockGetPermissions.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    } as never);
    mockGetScheduled.mockResolvedValue([
      { identifier: 'old-rest', content: { data: { type: 'workout_rest_timer' } } },
      { identifier: 'unrelated', content: { data: { type: 'something_else' } } },
    ] as never);

    const status = await scheduleRestTimerNotification(
      { durationSeconds: 90, endsAt: '2026-09-22T10:01:30.000Z' },
      Date.parse('2026-09-22T10:00:00.000Z'),
    );

    expect(status).toBe('scheduled');
    expect(mockCancel).toHaveBeenCalledWith('old-rest');
    expect(mockCancel).not.toHaveBeenCalledWith('unrelated');
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Rest complete',
          data: { type: 'workout_rest_timer' },
        }),
        trigger: expect.objectContaining({
          type: 'date',
          date: new Date('2026-09-22T10:01:30.000Z'),
        }),
      }),
    );
  });

  it('does not keep prompting after notification permission was denied', async () => {
    mockGetPermissions.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: 'denied',
      ios: { status: 1 },
    } as never);

    const status = await scheduleRestTimerNotification(
      { durationSeconds: 90, endsAt: '2026-09-22T10:01:30.000Z' },
      Date.parse('2026-09-22T10:00:00.000Z'),
    );

    expect(status).toBe('permission_denied');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not ask for permission when the restored timer already expired', async () => {
    const status = await scheduleRestTimerNotification(
      { durationSeconds: 30, endsAt: '2026-09-22T10:00:30.000Z' },
      Date.parse('2026-09-22T10:01:00.000Z'),
    );

    expect(status).toBe('expired');
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('clears pending rest alerts without touching other notifications', async () => {
    mockGetScheduled.mockResolvedValue([
      { identifier: 'rest', content: { data: { type: 'workout_rest_timer' } } },
      { identifier: 'other', content: { data: {} } },
    ] as never);

    await clearRestTimerNotification();

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('rest');
  });
});
