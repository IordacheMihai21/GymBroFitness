import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  TextInput,
} from 'react-native-paper';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { signInWithEmail, signOut, signUpWithEmail } from '@/services/supabase/auth';
import {
  clearLocalSyncMarker,
  inspectCloudSync,
  pushLocalBackup,
  restoreInspectedCloudBackup,
  type CloudSyncInspection,
} from '@/services/supabase/sync';
import { useTheme } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Optional account/backup card — GymBroFitness is local-first (see
 * PRODUCT.md and the onboarding copy: "No account required"), so this never
 * gates the app. It renders nothing when this build has no Supabase project
 * configured, and even when configured, signing in is something the user
 * opts into from Settings, not something the app demands on launch.
 */
export function AccountCard() {
  const { colors, radius, spacing, typography } = useTheme();
  const { session, loading: sessionLoading } = useSupabaseSession();

  if (!isSupabaseConfigured()) return null;

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text style={[typography.micro, { color: colors.accent }]}>Sync</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>Account</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Optional — your data stays on this device either way. Sign in only if you want a backup
            you can restore from.
          </Text>
        </View>

        {sessionLoading ? null : session ? (
          <SignedInRow userId={session.user.id} email={session.user.email ?? 'this account'} />
        ) : (
          <AuthForm />
        )}
      </Card.Content>
    </Card>
  );
}

function SignedInRow({ userId, email }: { userId: string; email: string }) {
  const { colors, spacing, typography } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Extract<
    CloudSyncInspection,
    { action: 'confirm_remote' }
  > | null>(null);

  function finishSync(action: 'pushed' | 'pulled') {
    setSyncMessage(
      action === 'pulled'
        ? 'Cloud data restored. Your existing workout history was kept.'
        : 'This device is now backed up to the cloud.',
    );
  }

  async function beginSync() {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const inspection = await inspectCloudSync(userId);
      if (inspection.action === 'confirm_remote') {
        setPendingRestore(inspection);
        return;
      }
      const result = await pushLocalBackup(userId);
      finishSync(result.action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync.');
    } finally {
      setSyncing(false);
    }
  }

  async function resolveConflict(choice: 'restore' | 'keep_local') {
    if (!pendingRestore) return;
    setSyncing(true);
    setError(null);
    try {
      const result =
        choice === 'restore'
          ? await restoreInspectedCloudBackup(userId, pendingRestore)
          : await pushLocalBackup(userId);
      setPendingRestore(null);
      finishSync(result.action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.body, { color: colors.textPrimary }]}>Signed in as {email}</Text>
      {syncMessage ? (
        <Text style={[typography.caption, { color: colors.success }]}>{syncMessage}</Text>
      ) : null}
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      <Button
        mode="contained-tonal"
        icon="cloud-sync-outline"
        loading={syncing}
        disabled={syncing || signingOut}
        onPress={beginSync}
      >
        Sync now
      </Button>
      <Button
        mode="outlined"
        icon="logout"
        loading={signingOut}
        disabled={signingOut || syncing}
        onPress={() => {
          setSigningOut(true);
          setError(null);
          signOut()
            .then(() => clearLocalSyncMarker(userId))
            .catch((err) => setError(err instanceof Error ? err.message : 'Could not sign out.'))
            .finally(() => setSigningOut(false));
        }}
      >
        Sign out
      </Button>

      <Portal>
        <Dialog visible={pendingRestore != null} onDismiss={() => setPendingRestore(null)}>
          <Dialog.Icon icon="cloud-alert" />
          <Dialog.Title>Cloud backup found</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Choose which plan and profile to keep. Restoring merges cloud workout history and
              templates into this device, but replaces its profile and active plan.
            </Text>
            {pendingRestore ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Cloud: {pendingRestore.preview.sessionCount} workouts and{' '}
                {pendingRestore.preview.templateCount} templates · exported{' '}
                {new Date(pendingRestore.preview.exportedAt).toLocaleDateString()}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={syncing} onPress={() => void resolveConflict('keep_local')}>
              Keep this device
            </Button>
            <Button
              mode="contained"
              loading={syncing}
              disabled={syncing}
              onPress={() => void resolveConflict('restore')}
            >
              Restore cloud
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function AuthForm() {
  const { colors, spacing, typography } = useTheme();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const emailIssue =
    email.length > 0 && !EMAIL_PATTERN.test(email) ? 'Enter a valid email.' : undefined;
  const passwordIssue =
    password.length > 0 && password.length < 6 ? 'Use at least 6 characters.' : undefined;
  const canSubmit = EMAIL_PATTERN.test(email) && password.length >= 6 && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    setConfirmationSent(false);
    try {
      if (mode === 'sign_up') {
        const { session } = await signUpWithEmail(email, password);
        if (!session) setConfirmationSent(true);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <SegmentedButtons
        value={mode}
        onValueChange={(value) => {
          setMode(value as typeof mode);
          setError(null);
          setConfirmationSent(false);
        }}
        buttons={[
          { value: 'sign_in', label: 'Sign in' },
          { value: 'sign_up', label: 'Create account' },
        ]}
      />
      <TextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        textColor={colors.textPrimary}
        outlineColor={colors.border}
        activeOutlineColor={colors.accent}
        error={Boolean(emailIssue)}
        style={{ backgroundColor: colors.surfaceRaised }}
      />
      <HelperText type="error" visible={Boolean(emailIssue)}>
        {emailIssue}
      </HelperText>
      <TextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
        textColor={colors.textPrimary}
        outlineColor={colors.border}
        activeOutlineColor={colors.accent}
        error={Boolean(passwordIssue)}
        style={{ backgroundColor: colors.surfaceRaised }}
      />
      <HelperText type="error" visible={Boolean(passwordIssue)}>
        {passwordIssue}
      </HelperText>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      {confirmationSent ? (
        <Text style={[typography.caption, { color: colors.success }]}>
          Check your email to confirm your account, then sign in here.
        </Text>
      ) : null}

      <Button mode="contained" loading={submitting} disabled={!canSubmit} onPress={submit}>
        {mode === 'sign_up' ? 'Create account' : 'Sign in'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
