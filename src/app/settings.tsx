import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { ENVIRONMENT_EQUIPMENT } from '@/domain/exercises/catalog';
import { generateProgram } from '@/domain/programs/generator';
import {
  createBackupSnapshot,
  parseBackup,
  previewBackupRestore,
  restoreBackup,
  serializeBackup,
  workoutHistoryToCsv,
  type BackupPreview,
  type GymBroBackup,
} from '@/domain/portability/backup';
import {
  pickBackupText,
  pickWorkoutCsvText,
  shareTextFile,
} from '@/domain/portability/backupFiles';
import {
  parseExternalWorkoutCsv,
  type WorkoutImportResult,
} from '@/domain/portability/workoutImport';
import {
  resetTrainingProfile,
  saveTrainingProfile,
  type TrainingProfileSnapshot,
} from '@/domain/programs/profileStore';
import { resetActiveProgram, saveActiveProgram } from '@/domain/programs/programStore';
import { importWorkoutSessions, listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { useTheme } from '@/theme';
import type {
  CoachingTone,
  ExperienceLevel,
  MuscleGroup,
  NutritionContext,
  TrainingEnvironment,
  TrainingGoal,
  TrainingPreferences,
  TrainingProgram,
  Units,
} from '@/types';
import { PRIORITY_MUSCLES } from '@/types';

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const GOAL_OPTIONS: TrainingGoal[] = ['hypertrophy', 'strength', 'mixed'];
const NUTRITION_OPTIONS: NutritionContext[] = ['unknown', 'maintenance', 'surplus', 'deficit'];
const UNIT_OPTIONS: Units[] = ['kg', 'lb'];
const TONE_OPTIONS: CoachingTone[] = ['supportive', 'direct', 'hype', 'science'];
const ENVIRONMENT_OPTIONS: TrainingEnvironment[] = [
  'commercial_gym',
  'home_gym',
  'bodyweight',
  'custom',
];
const DAY_OPTIONS: TrainingPreferences['daysPerWeek'][] = [2, 3, 4, 5, 6];
const SESSION_OPTIONS: TrainingPreferences['sessionMinutes'][] = [30, 45, 60, 75, 90];

type StatusTone = 'success' | 'danger' | 'neutral';

type SaveMode = 'profile' | 'regenerate';
type PortabilityMode = 'backup' | 'csv' | 'import' | 'restore' | 'workout_import';

export default function SettingsScreen() {
  const profile = useTrainingProfile();

  return (
    <SettingsEditor
      key={`${profile.source}-${profile.updatedAt}-${profile.user.id}`}
      profile={profile}
    />
  );
}

function SettingsEditor({ profile }: { profile: TrainingProfileSnapshot }) {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState(profile.user.displayName);
  const [goal, setGoal] = useState(profile.preferences.goal);
  const [nutritionContext, setNutritionContext] = useState<NutritionContext>(
    profile.preferences.nutritionContext ?? 'unknown',
  );
  const [experience, setExperience] = useState(profile.preferences.experience);
  const [units, setUnits] = useState(profile.preferences.units);
  const [coachingTone, setCoachingTone] = useState(profile.preferences.coachingTone);
  const [environment, setEnvironment] = useState(profile.preferences.environment);
  const [daysPerWeek, setDaysPerWeek] = useState(profile.preferences.daysPerWeek);
  const [sessionMinutes, setSessionMinutes] = useState(profile.preferences.sessionMinutes);
  const [musclePriorities, setMusclePriorities] = useState(profile.preferences.musclePriorities);
  const [savingMode, setSavingMode] = useState<SaveMode | null>(null);
  const [portabilityMode, setPortabilityMode] = useState<PortabilityMode | null>(null);
  const [importCandidate, setImportCandidate] = useState<{
    backup: GymBroBackup;
    preview: BackupPreview;
  } | null>(null);
  const [workoutImportCandidate, setWorkoutImportCandidate] = useState<{
    result: WorkoutImportResult;
    newSessionCount: number;
    duplicateSessionCount: number;
  } | null>(null);
  const [strongImportUnit, setStrongImportUnit] = useState<Units>(profile.preferences.units);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [fieldIssues, setFieldIssues] = useState<{ displayName?: string }>({});

  const draftPreferences = useMemo<TrainingPreferences>(
    () => ({
      ...profile.preferences,
      goal,
      nutritionContext,
      experience,
      units,
      coachingTone,
      environment,
      equipment: equipmentForEnvironment(environment, profile.preferences.equipment),
      daysPerWeek,
      sessionMinutes,
      preferredDays: fitPreferredDays(daysPerWeek, profile.preferences.preferredDays),
      musclePriorities: musclePriorities.slice(0, 3),
    }),
    [
      coachingTone,
      daysPerWeek,
      environment,
      experience,
      goal,
      musclePriorities,
      nutritionContext,
      profile.preferences,
      sessionMinutes,
      units,
    ],
  );

  const preview = useMemo(() => {
    try {
      return {
        program: generateProgram(draftPreferences, profile.user.id),
        error: null,
      };
    } catch (error) {
      return {
        program: null,
        error: error instanceof Error ? error.message : 'Could not generate a plan preview.',
      };
    }
  }, [draftPreferences, profile.user.id]);

  const programAffectingChanged =
    goal !== profile.preferences.goal ||
    experience !== profile.preferences.experience ||
    environment !== profile.preferences.environment ||
    daysPerWeek !== profile.preferences.daysPerWeek ||
    sessionMinutes !== profile.preferences.sessionMinutes ||
    !sameArray(musclePriorities, profile.preferences.musclePriorities);

  async function persistProfile(mode: SaveMode) {
    const issues = validateProfileFields(displayName);
    setFieldIssues(issues);
    setStatus(null);
    if (Object.keys(issues).length > 0) return;

    setSavingMode(mode);
    try {
      const user = {
        ...profile.user,
        displayName: displayName.trim(),
        onboardingCompleted: true,
      };
      await saveTrainingProfile({ user, preferences: draftPreferences });

      if (mode === 'regenerate') {
        const program = generateProgram(draftPreferences, user.id);
        await saveActiveProgram(program);
        setStatus({
          tone: 'success',
          text: 'Profile saved and active plan regenerated from these settings.',
        });
      } else {
        setStatus({
          tone: 'neutral',
          text: 'Profile saved. Active plan was kept as-is.',
        });
      }
    } catch {
      setStatus({
        tone: 'danger',
        text: 'Could not save this setup. Review the fields and try again.',
      });
    } finally {
      setSavingMode(null);
    }
  }

  async function resetProfile() {
    setSavingMode('profile');
    setStatus(null);
    try {
      const next = await resetTrainingProfile();
      await resetActiveProgram(next.preferences, next.user.id);
      syncEditor(next);
      setFieldIssues({});
      setStatus({
        tone: 'neutral',
        text: 'Reset complete. Home will ask for local profile setup again.',
      });
    } catch {
      setStatus({ tone: 'danger', text: 'Could not reset profile. Try again.' });
    } finally {
      setSavingMode(null);
    }
  }

  function syncEditor(next: TrainingProfileSnapshot) {
    setDisplayName(next.user.displayName);
    setGoal(next.preferences.goal);
    setNutritionContext(next.preferences.nutritionContext ?? 'unknown');
    setExperience(next.preferences.experience);
    setUnits(next.preferences.units);
    setCoachingTone(next.preferences.coachingTone);
    setEnvironment(next.preferences.environment);
    setDaysPerWeek(next.preferences.daysPerWeek);
    setSessionMinutes(next.preferences.sessionMinutes);
    setMusclePriorities(next.preferences.musclePriorities);
  }

  function toggleMuscle(muscle: MuscleGroup) {
    setMusclePriorities((current) => {
      if (current.includes(muscle)) return current.filter((item) => item !== muscle);
      if (current.length >= 3) return current;
      return [...current, muscle];
    });
  }

  async function exportBackup() {
    setPortabilityMode('backup');
    setStatus(null);
    try {
      const backup = await createBackupSnapshot();
      await shareTextFile({
        contents: serializeBackup(backup),
        filename: `gymbro-backup-${backup.exportedAt.slice(0, 10)}.json`,
        mimeType: 'application/json',
      });
      setStatus({ tone: 'success', text: 'Versioned JSON backup created.' });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Could not export the backup.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  async function exportCsv() {
    setPortabilityMode('csv');
    setStatus(null);
    try {
      const sessions = await listWorkoutHistory();
      await shareTextFile({
        contents: workoutHistoryToCsv(sessions),
        filename: `gymbro-history-${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: 'text/csv',
      });
      setStatus({ tone: 'success', text: 'Workout CSV created in canonical kg units.' });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Could not export workout history.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  async function chooseBackup() {
    setPortabilityMode('import');
    setStatus(null);
    try {
      const raw = await pickBackupText();
      if (raw == null) return;
      const backup = parseBackup(raw);
      const nextPreview = await previewBackupRestore(backup);
      setImportCandidate({ backup, preview: nextPreview });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Could not read this backup.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  async function confirmRestore() {
    if (!importCandidate) return;
    setPortabilityMode('restore');
    setStatus(null);
    try {
      await restoreBackup(importCandidate.backup);
      syncEditor({
        version: 1,
        ...importCandidate.backup.profile,
        updatedAt: new Date().toISOString(),
        source: 'local',
      });
      setImportCandidate(null);
      setStatus({
        tone: 'success',
        text: 'Backup restored. Existing matching IDs were kept without duplication.',
      });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text:
          error instanceof Error
            ? `${error.message} The pre-restore snapshot was kept for recovery.`
            : 'Restore failed. The pre-restore snapshot was kept for recovery.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  async function chooseWorkoutCsv() {
    setPortabilityMode('workout_import');
    setStatus(null);
    try {
      const raw = await pickWorkoutCsvText();
      if (raw == null) return;
      const result = parseExternalWorkoutCsv(raw, {
        userId: profile.user.id,
        strongWeightUnit: strongImportUnit,
      });
      const existing = new Set((await listWorkoutHistory()).map((session) => session.id));
      const duplicateSessionCount = result.sessions.filter((session) =>
        existing.has(session.id),
      ).length;
      setWorkoutImportCandidate({
        result,
        duplicateSessionCount,
        newSessionCount: result.sessions.length - duplicateSessionCount,
      });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Could not read this workout CSV.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  async function confirmWorkoutImport() {
    if (!workoutImportCandidate) return;
    setPortabilityMode('workout_import');
    setStatus(null);
    try {
      await importWorkoutSessions(workoutImportCandidate.result.sessions);
      const imported = workoutImportCandidate.newSessionCount;
      setWorkoutImportCandidate(null);
      setStatus({
        tone: 'success',
        text: `${imported} workout${imported === 1 ? '' : 's'} imported without duplicating existing history.`,
      });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Workout import failed.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.md,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Local profile</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Settings</Text>
        </View>
        <IconButton
          icon="content-save-outline"
          mode="contained-tonal"
          onPress={() => persistProfile('profile')}
          disabled={savingMode !== null}
        />
      </View>

      <Card
        mode="contained"
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <SectionHeader eyebrow="Athlete" title="Identity" />
          <TextInput
            mode="outlined"
            label="Display name"
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value);
              setFieldIssues((current) => ({ ...current, displayName: undefined }));
            }}
            autoCapitalize="words"
            textColor={colors.textPrimary}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
            error={Boolean(fieldIssues.displayName)}
            style={{ backgroundColor: colors.surfaceRaised }}
          />
          <HelperText type="error" visible={Boolean(fieldIssues.displayName)}>
            {fieldIssues.displayName}
          </HelperText>
          <SegmentedChips
            label="Units"
            options={UNIT_OPTIONS}
            selected={units}
            onSelect={setUnits}
          />
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <SectionHeader
            eyebrow="Training model"
            title="Program defaults"
            detail="These fields control the generated split, available exercises and weekly volume."
          />
          <SegmentedChips
            label="Primary goal"
            options={GOAL_OPTIONS}
            selected={goal}
            onSelect={setGoal}
            format={formatGoal}
          />
          <SegmentedChips
            label="Experience"
            options={EXPERIENCE_OPTIONS}
            selected={experience}
            onSelect={setExperience}
            format={formatExperience}
          />
          <SegmentedChips
            label="Current nutrition context"
            options={NUTRITION_OPTIONS}
            selected={nutritionContext}
            onSelect={setNutritionContext}
            format={formatNutritionContext}
          />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            This is optional context for conservative volume suggestions, not a calorie target.
          </Text>
          <SegmentedChips
            label="Training environment"
            options={ENVIRONMENT_OPTIONS}
            selected={environment}
            onSelect={setEnvironment}
            format={formatEnvironment}
          />
          <SegmentedChips
            label="Days per week"
            options={DAY_OPTIONS}
            selected={daysPerWeek}
            onSelect={setDaysPerWeek}
            format={(value) => `${value}d`}
          />
          <SegmentedChips
            label="Session target"
            options={SESSION_OPTIONS}
            selected={sessionMinutes}
            onSelect={setSessionMinutes}
            format={(value) => `${value}m`}
          />
          <SegmentedChips
            label="Coach voice"
            options={TONE_OPTIONS}
            selected={coachingTone}
            onSelect={setCoachingTone}
            format={formatTone}
          />
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <SectionHeader
            eyebrow="Priority muscles"
            title="Bias the weekly dose"
            detail="Pick up to three muscles. The generator gives them extra sets without blowing up the whole week."
          />
          <View style={styles.muscleGrid}>
            {PRIORITY_MUSCLES.map((muscle) => {
              const active = musclePriorities.includes(muscle);
              const disabled = !active && musclePriorities.length >= 3;
              return (
                <Chip
                  key={muscle}
                  compact
                  selected={active}
                  disabled={disabled}
                  mode={active ? 'flat' : 'outlined'}
                  onPress={() => toggleMuscle(muscle)}
                  style={active ? { backgroundColor: colors.accentSoft } : undefined}
                  textStyle={active ? { color: colors.accent } : undefined}
                >
                  {MUSCLE_LABELS[muscle]}
                </Chip>
              );
            })}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {musclePriorities.length > 0
              ? `${musclePriorities.length}/3 selected: ${musclePriorities
                  .map((muscle) => MUSCLE_LABELS[muscle])
                  .join(', ')}`
              : 'Balanced plan selected.'}
          </Text>
        </Card.Content>
      </Card>

      <PlanPreviewCard
        program={preview.program}
        error={preview.error}
        preferences={draftPreferences}
        programAffectingChanged={programAffectingChanged}
        savingMode={savingMode}
        onSaveProfile={() => persistProfile('profile')}
        onRegenerate={() => persistProfile('regenerate')}
      />

      <Card
        mode="contained"
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <SectionHeader
            eyebrow="Data portability"
            title="Backup, restore, export"
            detail="JSON includes your local profile, plan, history, active draft, and templates. CSV contains completed sets in canonical kg."
          />
          <View style={styles.portabilityActions}>
            <Button
              mode="contained-tonal"
              icon="database-export-outline"
              onPress={exportBackup}
              loading={portabilityMode === 'backup'}
              disabled={portabilityMode !== null}
            >
              Backup JSON
            </Button>
            <Button
              mode="outlined"
              icon="file-delimited-outline"
              onPress={exportCsv}
              loading={portabilityMode === 'csv'}
              disabled={portabilityMode !== null}
            >
              Export CSV
            </Button>
            <Button
              mode="outlined"
              icon="database-import-outline"
              onPress={chooseBackup}
              loading={portabilityMode === 'import'}
              disabled={portabilityMode !== null}
            >
              Restore JSON
            </Button>
            <Button
              mode="outlined"
              icon="file-import-outline"
              onPress={chooseWorkoutCsv}
              loading={portabilityMode === 'workout_import'}
              disabled={portabilityMode !== null}
            >
              Import Hevy/Strong
            </Button>
          </View>
          <SegmentedChips
            label="Strong CSV weight unit"
            options={UNIT_OPTIONS}
            selected={strongImportUnit}
            onSelect={setStrongImportUnit}
          />
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            Before restore, the current local data is saved to a recovery snapshot. A current active
            draft is never overwritten.
          </Text>
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={importCandidate != null} onDismiss={() => setImportCandidate(null)}>
          <Dialog.Title>Review restore</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            {importCandidate ? (
              <>
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  This replaces the local profile and active plan, then merges history and templates
                  by stable ID.
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {importCandidate.preview.newSessionCount} new sessions ·{' '}
                  {importCandidate.preview.duplicateSessionCount} already present ·{' '}
                  {importCandidate.preview.newTemplateCount} new templates
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Active draft: {formatDraftAction(importCandidate.preview.draftAction)}
                </Text>
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setImportCandidate(null)}
              disabled={portabilityMode === 'restore'}
            >
              Cancel
            </Button>
            <Button
              onPress={confirmRestore}
              loading={portabilityMode === 'restore'}
              disabled={portabilityMode === 'restore'}
            >
              Restore
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={workoutImportCandidate != null}
          onDismiss={() => setWorkoutImportCandidate(null)}
        >
          <Dialog.Title>Review workout import</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            {workoutImportCandidate ? (
              <>
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {workoutImportCandidate.result.source === 'hevy' ? 'Hevy' : 'Strong'} export ·{' '}
                  {workoutImportCandidate.newSessionCount} new sessions ·{' '}
                  {workoutImportCandidate.duplicateSessionCount} already present
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {workoutImportCandidate.result.importedRows}/
                  {workoutImportCandidate.result.totalRows} set rows are importable. Strong weights
                  are interpreted as {strongImportUnit}.
                </Text>
                {workoutImportCandidate.result.unmappedExercises.length > 0 ? (
                  <Text style={[typography.caption, { color: colors.warning }]}>
                    Skipped until mapped:{' '}
                    {workoutImportCandidate.result.unmappedExercises
                      .map((item) => `${item.name} (${item.rowCount})`)
                      .join(', ')}
                  </Text>
                ) : null}
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setWorkoutImportCandidate(null)}
              disabled={portabilityMode === 'workout_import'}
            >
              Cancel
            </Button>
            <Button
              onPress={confirmWorkoutImport}
              loading={portabilityMode === 'workout_import'}
              disabled={portabilityMode === 'workout_import'}
            >
              Import
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {status ? (
        <Text
          style={[
            typography.caption,
            {
              color:
                status.tone === 'danger'
                  ? colors.danger
                  : status.tone === 'success'
                    ? colors.success
                    : colors.textMuted,
            },
          ]}
        >
          {status.text}
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        <Button
          mode="outlined"
          icon="restart"
          onPress={resetProfile}
          disabled={savingMode !== null}
        >
          Reset
        </Button>
        <Button
          mode="contained"
          icon="autorenew"
          onPress={() => persistProfile('regenerate')}
          loading={savingMode === 'regenerate'}
          disabled={savingMode !== null || Boolean(preview.error)}
        >
          Save & regenerate
        </Button>
      </View>
    </ScrollView>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ gap: 4 }}>
      <Text style={[typography.micro, { color: colors.accent }]}>{eyebrow}</Text>
      <Text style={[typography.subheading, { color: colors.textPrimary }]}>{title}</Text>
      {detail ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

function PlanPreviewCard({
  program,
  error,
  preferences,
  programAffectingChanged,
  savingMode,
  onSaveProfile,
  onRegenerate,
}: {
  program: TrainingProgram | null;
  error: string | null;
  preferences: TrainingPreferences;
  programAffectingChanged: boolean;
  savingMode: SaveMode | null;
  onSaveProfile: () => void;
  onRegenerate: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: programAffectingChanged ? colors.accent : colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <SectionHeader
            eyebrow="Plan preview"
            title={programAffectingChanged ? 'Plan will be rebuilt' : 'Current setup is synced'}
            detail="Regeneration replaces the active program. Your workout history stays untouched."
          />
          <Chip compact mode="flat" icon={programAffectingChanged ? 'alert-circle' : 'check'}>
            {programAffectingChanged ? 'changed' : 'synced'}
          </Chip>
        </View>

        {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}

        {program ? (
          <>
            <View style={styles.summaryGrid}>
              <SummaryCell label="split" value={program.name} />
              <SummaryCell label="goal" value={formatGoal(preferences.goal)} />
              <SummaryCell label="schedule" value={`${preferences.daysPerWeek}d/wk`} />
              <SummaryCell label="session" value={`${preferences.sessionMinutes} min`} />
              <SummaryCell
                label="priority"
                value={
                  preferences.musclePriorities.length > 0
                    ? preferences.musclePriorities.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')
                    : 'balanced'
                }
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              {program.days.map((day) => (
                <View
                  key={day.id}
                  style={[
                    styles.dayRow,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                      {day.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {day.focus.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}
                    </Text>
                  </View>
                  <Text style={[typography.captionBold, { color: colors.accent }]}>
                    {day.prescriptions.length} ex
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {day.estimatedMinutes}m
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.previewActions}>
          <Button
            mode="outlined"
            icon="content-save-outline"
            onPress={onSaveProfile}
            loading={savingMode === 'profile'}
            disabled={savingMode !== null}
          >
            Save profile only
          </Button>
          <Button
            mode="contained"
            icon="autorenew"
            onPress={onRegenerate}
            loading={savingMode === 'regenerate'}
            disabled={savingMode !== null || Boolean(error)}
          >
            Regenerate plan
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function SegmentedChips<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  format = String,
}: {
  label: string;
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  format?: (value: T) => string;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Chip
            key={option}
            compact
            selected={selected === option}
            mode={selected === option ? 'flat' : 'outlined'}
            onPress={() => onSelect(option)}
            style={[
              styles.choiceChip,
              selected === option ? { backgroundColor: colors.accentSoft } : undefined,
            ]}
            textStyle={selected === option ? { color: colors.accent } : undefined}
          >
            {format(option)}
          </Chip>
        ))}
      </View>
    </View>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.summaryCell, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function validateProfileFields(displayName: string): { displayName?: string } {
  const issues: { displayName?: string } = {};
  if (displayName.trim().length < 2) {
    issues.displayName = 'Use at least 2 characters.';
  }
  return issues;
}

function equipmentForEnvironment(
  environment: TrainingEnvironment,
  fallback: TrainingPreferences['equipment'],
): TrainingPreferences['equipment'] {
  if (environment === 'custom') return [...fallback];
  return [...(ENVIRONMENT_EQUIPMENT[environment] ?? fallback)];
}

function fitPreferredDays(
  daysPerWeek: TrainingPreferences['daysPerWeek'],
  current: TrainingPreferences['preferredDays'],
): TrainingPreferences['preferredDays'] {
  const defaultDays: TrainingPreferences['preferredDays'] = [0, 1, 2, 3, 4, 5];
  const merged = [...current, ...defaultDays]
    .filter((day, index, days) => days.indexOf(day) === index)
    .slice(0, daysPerWeek);
  return merged as TrainingPreferences['preferredDays'];
}

function sameArray<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function formatExperience(value: ExperienceLevel): string {
  if (value === 'beginner') return 'Beginner';
  if (value === 'advanced') return 'Advanced';
  return 'Intermediate';
}

function formatGoal(value: TrainingGoal): string {
  if (value === 'hypertrophy') return 'Build muscle';
  if (value === 'strength') return 'Get stronger';
  return 'Strength + muscle';
}

function formatNutritionContext(value: NutritionContext): string {
  if (value === 'maintenance') return 'Maintaining';
  if (value === 'surplus') return 'Surplus';
  if (value === 'deficit') return 'Deficit';
  return 'Not set';
}

function formatEnvironment(value: TrainingEnvironment): string {
  if (value === 'commercial_gym') return 'Full gym';
  if (value === 'home_gym') return 'Home gym';
  if (value === 'bodyweight') return 'Minimal';
  return 'Custom';
}

function formatTone(value: CoachingTone): string {
  if (value === 'supportive') return 'Supportive';
  if (value === 'direct') return 'Direct';
  if (value === 'hype') return 'Hype';
  return 'Science';
}

function formatDraftAction(action: BackupPreview['draftAction']): string {
  if (action === 'restore') return 'the backup draft will be restored';
  if (action === 'keep_existing') return 'the current draft will be kept';
  return 'no draft in this backup';
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    minHeight: 44,
    justifyContent: 'center',
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCell: {
    width: '48%',
    minHeight: 56,
    justifyContent: 'center',
    gap: 4,
    borderRadius: 14,
    padding: 12,
  },
  dayRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  portabilityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
