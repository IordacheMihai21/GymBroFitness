import { type ReactNode, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, HelperText, List, Portal, Searchbar, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/settings/AccountCard';
import { ListRow } from '@/components/ui/ListRow';
import { Pill } from '@/components/ui/Pill';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { ALL_EXERCISES, ENVIRONMENT_EQUIPMENT } from '@/domain/exercises/catalog';
import { generateProgram } from '@/domain/programs/generator';
import {
  createBackupSnapshot,
  loadRestoreRecoveryBackup,
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
  loadExternalExerciseMappings,
  saveExternalExerciseMapping,
} from '@/domain/portability/externalExerciseMappingsStore';
import {
  resetTrainingProfile,
  saveTrainingProfile,
  type TrainingProfileSnapshot,
} from '@/domain/programs/profileStore';
import { resetActiveProgram, saveActiveProgram } from '@/domain/programs/programStore';
import { importWorkoutSessions, listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { inputTheme, useTheme } from '@/theme';
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
  const { colors, spacing, typography } = useTheme();
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
    raw: string;
    result: WorkoutImportResult;
    newSessionCount: number;
    duplicateSessionCount: number;
  } | null>(null);
  const [strongImportUnit, setStrongImportUnit] = useState<Units>(profile.preferences.units);
  const [mappingTarget, setMappingTarget] = useState<string | null>(null);
  const [mappingQuery, setMappingQuery] = useState('');
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
  const mappingChoices = useMemo(() => {
    const query = mappingQuery.trim().toLocaleLowerCase();
    return ALL_EXERCISES.filter((exercise) =>
      query
        ? [exercise.name, ...exercise.aliases].some((name) =>
            name.toLocaleLowerCase().includes(query),
          )
        : true,
    ).slice(0, 12);
  }, [mappingQuery]);

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
      const storedMappings = await loadExternalExerciseMappings();
      const result = parseExternalWorkoutCsv(raw, {
        userId: profile.user.id,
        strongWeightUnit: strongImportUnit,
        exerciseMappings: storedMappings.mappings,
      });
      const existing = new Set((await listWorkoutHistory()).map((session) => session.id));
      const duplicateSessionCount = result.sessions.filter((session) =>
        existing.has(session.id),
      ).length;
      setWorkoutImportCandidate({
        raw,
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

  async function mapExternalExercise(exerciseId: string) {
    if (!mappingTarget || !workoutImportCandidate) return;
    setPortabilityMode('workout_import');
    setStatus(null);
    try {
      const storedMappings = await saveExternalExerciseMapping(
        workoutImportCandidate.result.source,
        mappingTarget,
        exerciseId,
      );
      const result = parseExternalWorkoutCsv(workoutImportCandidate.raw, {
        userId: profile.user.id,
        strongWeightUnit: strongImportUnit,
        exerciseMappings: storedMappings.mappings,
      });
      const existing = new Set((await listWorkoutHistory()).map((session) => session.id));
      const duplicateSessionCount = result.sessions.filter((session) =>
        existing.has(session.id),
      ).length;
      setWorkoutImportCandidate({
        raw: workoutImportCandidate.raw,
        result,
        duplicateSessionCount,
        newSessionCount: result.sessions.length - duplicateSessionCount,
      });
      setMappingTarget(null);
      setMappingQuery('');
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Could not save this exercise mapping.',
      });
    } finally {
      setPortabilityMode(null);
    }
  }

  async function chooseRecoverySnapshot() {
    setPortabilityMode('import');
    setStatus(null);
    try {
      const backup = await loadRestoreRecoveryBackup();
      if (!backup) {
        setStatus({ tone: 'neutral', text: 'No pre-restore recovery snapshot is available.' });
        return;
      }
      setImportCandidate({ backup, preview: await previewBackupRestore(backup) });
    } catch (error) {
      setStatus({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Recovery snapshot could not be read.',
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
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <Section title="Profile">
        <TextInput
          theme={inputTheme}
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
        <SegmentedChips label="Units" options={UNIT_OPTIONS} selected={units} onSelect={setUnits} />
      </Section>

      <AccountCard />

      <Section
        title="Training"
        detail="These shape your generated plan, the exercises it can use and weekly volume."
      >
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
      </Section>

      <Section
        title="Priority muscles"
        detail="Pick up to three. They get extra sets without overloading the rest of the week."
      >
        <View style={styles.muscleGrid}>
          {PRIORITY_MUSCLES.map((muscle) => {
            const active = musclePriorities.includes(muscle);
            const disabled = !active && musclePriorities.length >= 3;
            return (
              <Pill
                key={muscle}
                label={MUSCLE_LABELS[muscle]}
                active={active}
                onPress={() => {
                  if (!disabled) toggleMuscle(muscle);
                }}
              />
            );
          })}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {musclePriorities.length > 0
            ? `${musclePriorities.length} of 3 picked`
            : 'None picked, the week stays balanced.'}
        </Text>
      </Section>

      <PlanPreviewCard
        program={preview.program}
        error={preview.error}
        preferences={draftPreferences}
        programAffectingChanged={programAffectingChanged}
        savingMode={savingMode}
        onSaveProfile={() => persistProfile('profile')}
        onRegenerate={() => persistProfile('regenerate')}
      />

      <Section
        title="Your data"
        detail="Backups include your profile, plan, history, saved workouts and any workout in progress."
      >
        <View>
          <ListRow
            title="Back up everything"
            subtitle={
              portabilityMode === 'backup' ? 'Preparing file' : 'JSON file you can restore later'
            }
            onPress={portabilityMode ? undefined : exportBackup}
          />
          <ListRow
            title="Export sets as CSV"
            subtitle={
              portabilityMode === 'csv' ? 'Preparing file' : 'Completed sets, weights in kg'
            }
            onPress={portabilityMode ? undefined : exportCsv}
          />
          <ListRow
            title="Restore from backup"
            subtitle="Pick a JSON backup file"
            onPress={portabilityMode ? undefined : chooseBackup}
          />
          <ListRow
            title="Import from Hevy or Strong"
            subtitle={portabilityMode === 'workout_import' ? 'Reading file' : 'Pick a CSV export'}
            onPress={portabilityMode ? undefined : chooseWorkoutCsv}
          />
          <ListRow
            title="Undo last restore"
            subtitle="Bring back the data saved before your last restore"
            onPress={portabilityMode ? undefined : chooseRecoverySnapshot}
            last
          />
        </View>
        <SegmentedChips
          label="Weight unit in Strong files"
          options={UNIT_OPTIONS}
          selected={strongImportUnit}
          onSelect={setStrongImportUnit}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Restoring saves a copy of your current data first and never overwrites a workout in
          progress.
        </Text>
      </Section>

      <Section
        title="Credits"
        detail="Exercise reference data and demo images come from these projects."
      >
        <View>
          <ListRow
            title="Exercise data by RepDB (repdb.co)"
            subtitle="Exercise illustrations, used under the RepDB free license"
            onPress={() => void Linking.openURL('https://repdb.co')}
          />
          <ListRow
            title="Free Exercise DB"
            subtitle="Public-domain exercise catalog and fallback images"
            onPress={() => void Linking.openURL('https://github.com/yuhonas/free-exercise-db')}
            last
          />
        </View>
      </Section>

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
          visible={workoutImportCandidate != null && mappingTarget == null}
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
                  <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.warning }]}>
                      Map these exercises now, or import only the recognized rows.
                    </Text>
                    {workoutImportCandidate.result.unmappedExercises.slice(0, 6).map((item) => (
                      <List.Item
                        key={item.name}
                        title={item.name}
                        description={`${item.rowCount} set row${item.rowCount === 1 ? '' : 's'}`}
                        titleNumberOfLines={2}
                        right={() => (
                          <Button
                            compact
                            mode="text"
                            onPress={() => {
                              setMappingTarget(item.name);
                              setMappingQuery('');
                            }}
                          >
                            Map
                          </Button>
                        )}
                      />
                    ))}
                    {workoutImportCandidate.result.unmappedExercises.length > 6 ? (
                      <Text style={[typography.micro, { color: colors.textMuted }]}>
                        And {workoutImportCandidate.result.unmappedExercises.length - 6} more in
                        this file.
                      </Text>
                    ) : null}
                  </View>
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
              disabled={
                portabilityMode === 'workout_import' ||
                workoutImportCandidate?.result.sessions.length === 0
              }
            >
              Import
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={mappingTarget != null}
          onDismiss={() => {
            setMappingTarget(null);
            setMappingQuery('');
          }}
        >
          <Dialog.Title>Map external exercise</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={3}>
              Choose the GymBro exercise equivalent for “{mappingTarget}”. This choice is remembered
              only for this source app.
            </Text>
            <Searchbar
              value={mappingQuery}
              onChangeText={setMappingQuery}
              placeholder="Search catalog"
              accessibilityLabel="Search catalog exercises"
            />
            <ScrollView style={styles.mappingResults} keyboardShouldPersistTaps="handled">
              {mappingChoices.map((exercise) => (
                <List.Item
                  key={exercise.id}
                  title={exercise.name}
                  description={`${exercise.equipment.join(', ')}, ${exercise.primaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}`}
                  titleNumberOfLines={2}
                  descriptionNumberOfLines={2}
                  onPress={() => mapExternalExercise(exercise.id)}
                  disabled={portabilityMode !== null}
                  left={(props) => <List.Icon {...props} icon="dumbbell" color={colors.accent} />}
                />
              ))}
              {mappingChoices.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  No catalog exercise matches this search. Change the query or leave it unmapped.
                </Text>
              ) : null}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setMappingTarget(null);
                setMappingQuery('');
              }}
            >
              Cancel
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
          mode="text"
          textColor={colors.textSecondary}
          onPress={resetProfile}
          disabled={savingMode !== null}
        >
          Discard changes
        </Button>
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
        {detail ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
        ) : null}
      </View>
      {children}
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
  const { colors, typography } = useTheme();

  return (
    <Section
      title={programAffectingChanged ? 'Your plan will be rebuilt' : 'Plan is up to date'}
      detail="Rebuilding replaces the active plan. Your workout history stays."
    >
      {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}

      {program ? (
        <View>
          <ListRow
            title={program.name}
            subtitle={`${formatGoal(preferences.goal)}, ${preferences.daysPerWeek} days a week, ${preferences.sessionMinutes} min sessions`}
          />
          {program.days.map((day, index) => (
            <ListRow
              key={day.id}
              title={day.name}
              subtitle={day.focus.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}
              value={`${day.prescriptions.length} ex, ${day.estimatedMinutes}m`}
              last={index === program.days.length - 1}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.previewActions}>
        <Button
          mode="text"
          onPress={onSaveProfile}
          loading={savingMode === 'profile'}
          disabled={savingMode !== null}
        >
          Save without rebuilding
        </Button>
        <Button
          mode="contained"
          onPress={onRegenerate}
          loading={savingMode === 'regenerate'}
          disabled={savingMode !== null || Boolean(error)}
        >
          Save and rebuild
        </Button>
      </View>
    </Section>
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
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Pill
            key={option}
            label={format(option)}
            active={selected === option}
            onPress={() => onSelect(option)}
          />
        ))}
      </View>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  mappingResults: {
    maxHeight: 320,
  },
});
