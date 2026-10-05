import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { ListRow } from '@/components/ui/ListRow';
import { Tile } from '@/components/ui/Tile';
import {
  connectHealthConnect,
  disconnectHealthConnect,
  getHealthConnectStatus,
  grantedHealthPermissions,
  loadHealthSettings,
  openHealthConnectPermissions,
  syncWeightFromHealthConnect,
  type HealthConnectStatus,
  type HealthPermissionKey,
} from '@/services/healthConnect';
import { useTheme } from '@/theme';

const HEALTH_CONNECT_STORE_URL = 'market://details?id=com.google.android.apps.healthdata';

/**
 * Connect, review and disconnect Android Health Connect. Hidden on devices
 * without it (iOS, very old Android).
 */
export function HealthConnectCard({ userId }: { userId: string }) {
  const { colors, spacing, typography } = useTheme();
  const [status, setStatus] = useState<HealthConnectStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [granted, setGranted] = useState<Set<HealthPermissionKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const nextStatus = await getHealthConnectStatus();
    setStatus(nextStatus);
    if (nextStatus !== 'available') return;
    const settings = await loadHealthSettings();
    setConnected(settings.connected);
    setGranted(settings.connected ? await grantedHealthPermissions() : new Set());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (status == null || status === 'unsupported') return null;

  async function connect() {
    setBusy(true);
    setMessage(null);
    const next = await connectHealthConnect();
    setGranted(next);
    setConnected(next.size > 0);
    if (next.has('weight')) {
      const added = await syncWeightFromHealthConnect(userId, { force: true });
      setMessage(
        added > 0 ? `Imported ${added} weigh-ins into Body.` : 'Connected. No new weigh-ins yet.',
      );
    } else if (next.size === 0) {
      setMessage('Nothing was shared. You can connect again any time.');
    }
    setBusy(false);
  }

  async function importWeight() {
    setBusy(true);
    const added = await syncWeightFromHealthConnect(userId, { force: true });
    setMessage(added > 0 ? `Imported ${added} weigh-ins into Body.` : 'No new weigh-ins.');
    setBusy(false);
  }

  async function disconnect() {
    await disconnectHealthConnect();
    setConnected(false);
    setGranted(new Set());
    setMessage('Disconnected. To remove access completely, use Manage access.');
  }

  const row = (key: HealthPermissionKey) => (granted.has(key) ? 'On' : 'Off');

  return (
    <Tile title="Health Connect">
      {status === 'needs_install' ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Install or update Health Connect to bring in your weight and heart rate.
          </Text>
          <Button
            mode="contained-tonal"
            onPress={() => void Linking.openURL(HEALTH_CONNECT_STORE_URL)}
            style={styles.button}
          >
            Get Health Connect
          </Button>
        </View>
      ) : connected ? (
        <View>
          <ListRow
            title="Body weight"
            subtitle="From your scale or health app, into Body"
            value={row('weight')}
          />
          <ListRow
            title="Heart rate"
            subtitle="From your watch, shown on each workout"
            value={row('heartRate')}
          />
          <ListRow
            title="Workouts"
            subtitle="Saved workouts appear in your health app"
            value={row('workouts')}
            last
          />
          <View style={[styles.actions, { marginTop: spacing.sm }]}>
            {granted.has('weight') ? (
              <Button compact mode="text" onPress={importWeight} loading={busy} disabled={busy}>
                Import weight
              </Button>
            ) : null}
            <Button compact mode="text" onPress={openHealthConnectPermissions}>
              Manage access
            </Button>
            <Button compact mode="text" textColor={colors.textMuted} onPress={disconnect}>
              Disconnect
            </Button>
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Bring in your body weight and workout heart rate, and send finished workouts to Samsung
            Health or Google Fit. You choose what to share.
          </Text>
          <Button
            mode="contained"
            onPress={connect}
            loading={busy}
            disabled={busy}
            style={styles.button}
          >
            Connect Health Connect
          </Button>
        </View>
      )}
      {message ? (
        <Text style={[typography.caption, { color: colors.accent, marginTop: spacing.xs }]}>
          {message}
        </Text>
      ) : null}
    </Tile>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -8,
  },
  button: {
    alignSelf: 'flex-start',
  },
});
