import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Chip, HelperText, ProgressBar, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { generateProgram } from '@/domain/programs/generator';
import {
  buildOnboardingPreferences,
  buildOnboardingProfile,
  defaultEquipmentForEnvironment,
  fitOnboardingDays,
  validateOnboardingInput,
  type OnboardingInput,
  type OnboardingValidationIssue,
} from '@/domain/programs/onboarding';
import { saveTrainingProfile } from '@/domain/programs/profileStore';
import { saveActiveProgram } from '@/domain/programs/programStore';
import { useTheme } from '@/theme';
import {
  EQUIPMENT_TYPES,
  PRIORITY_MUSCLES,
  type DayOfWeek,
  type EquipmentType,
  type ExperienceLevel,
  type MuscleGroup,
} from '@/types';

const STEPS = ['Profile', 'Goal', 'Week', 'Setup', 'Plan'] as const;

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  title: string;
  detail: string;
}[] = [
  { value: 'beginner', title: 'Under 1 year', detail: 'Building consistent technique and loading' },
  {
    value: 'intermediate',
    title: '1–3 years',
    detail: 'Consistent training with established lifts',
  },
  { value: 'advanced', title: '4+ years', detail: 'Stable technique and deliberate programming' },
];

const GOAL_OPTIONS: {
  value: OnboardingInput['goal'];
  title: string;
  detail: string;
}[] = [
  {
    value: 'hypertrophy',
    title: 'Hypertrophy',
    detail: 'Growth-biased rep ranges, volume and exercise selection',
  },
  {
    value: 'strength',
    title: 'Strength',
    detail: 'Lower-rep compounds with longer rest periods',
  },
  {
    value: 'mixed',
    title: 'Powerbuilding',
    detail: 'Strength-biased compounds and hypertrophy accessories',
  },
];

const ENVIRONMENT_OPTIONS: {
  value: OnboardingInput['environment'];
  title: string;
  detail: string;
}[] = [
  { value: 'commercial_gym', title: 'Commercial gym', detail: 'Free weights, cables and machines' },
  { value: 'home_gym', title: 'Home gym', detail: 'Adjustable dumbbells, bench, bar and bands' },
  { value: 'bodyweight', title: 'Minimal setup', detail: 'Bodyweight, pull-up bar and bands' },
];

const DAY_OPTIONS: OnboardingInput['daysPerWeek'][] = [2, 3, 4, 5, 6];
const SESSION_OPTIONS: OnboardingInput['sessionMinutes'][] = [30, 45, 60, 75, 90];
const UNIT_OPTIONS: OnboardingInput['units'][] = ['kg', 'lb'];
const WEEKDAYS: { value: DayOfWeek; short: string; label: string }[] = [
  { value: 0, short: 'Mon', label: 'Monday' },
  { value: 1, short: 'Tue', label: 'Tuesday' },
  { value: 2, short: 'Wed', label: 'Wednesday' },
  { value: 3, short: 'Thu', label: 'Thursday' },
  { value: 4, short: 'Fri', label: 'Friday' },
  { value: 5, short: 'Sat', label: 'Saturday' },
  { value: 6, short: 'Sun', label: 'Sunday' },
];

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  adjustable_dumbbell: 'Adjustable DBs',
  bench: 'Flat bench',
  incline_bench: 'Incline bench',
  squat_rack: 'Squat rack',
  pull_up_bar: 'Pull-up bar',
  dip_station: 'Dip station',
  cable_machine: 'Cable stack',
  plate_loaded_machine: 'Plate-loaded',
  selectorized_machine: 'Selectorized',
  smith_machine: 'Smith machine',
  resistance_band: 'Bands',
  kettlebell: 'Kettlebells',
  leg_press: 'Leg press',
  hack_squat: 'Hack squat',
  ez_bar: 'EZ bar',
  bodyweight: 'Bodyweight',
};

export default function OnboardingScreen() {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [units, setUnits] = useState<OnboardingInput['units']>('kg');
  const [goal, setGoal] = useState<OnboardingInput['goal']>('hypertrophy');
  const [experience, setExperience] = useState<OnboardingInput['experience']>('intermediate');
  const [environment, setEnvironment] = useState<OnboardingInput['environment']>('commercial_gym');
  const [equipment, setEquipment] = useState<EquipmentType[]>(
    defaultEquipmentForEnvironment('commercial_gym'),
  );
  const [daysPerWeek, setDaysPerWeekState] = useState<OnboardingInput['daysPerWeek']>(4);
  const [preferredDays, setPreferredDays] = useState<DayOfWeek[]>([0, 1, 3, 4]);
  const [sessionMinutes, setSessionMinutes] = useState<OnboardingInput['sessionMinutes']>(60);
  const [musclePriorities, setMusclePriorities] = useState<MuscleGroup[]>([]);
  const [issues, setIssues] = useState<OnboardingValidationIssue[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const input = useMemo<OnboardingInput>(
    () => ({
      displayName,
      units,
      goal,
      experience,
      environment,
      equipment,
      daysPerWeek,
      preferredDays,
      sessionMinutes,
      musclePriorities,
    }),
    [
      daysPerWeek,
      displayName,
      environment,
      equipment,
      experience,
      goal,
      musclePriorities,
      preferredDays,
      sessionMinutes,
      units,
    ],
  );

  const previewPreferences = useMemo(() => buildOnboardingPreferences(input), [input]);
  const previewProgram = useMemo(
    () => generateProgram(previewPreferences, 'preview-user'),
    [previewPreferences],
  );
  const progress = (step + 1) / STEPS.length;

  function issuesForCurrentStep(nextIssues: OnboardingValidationIssue[]) {
    const fields: (keyof OnboardingInput)[][] = [
      ['displayName'],
      [],
      ['preferredDays'],
      ['equipment', 'musclePriorities'],
      [],
    ];
    return nextIssues.filter((issue) => fields[step].includes(issue.field));
  }

  function advance() {
    setStatus(null);
    const nextIssues = issuesForCurrentStep(validateOnboardingInput(input));
    setIssues(nextIssues);
    if (nextIssues.length > 0) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setStatus(null);
    setIssues([]);
    setStep((current) => Math.max(current - 1, 0));
  }

  function changeDaysPerWeek(value: OnboardingInput['daysPerWeek']) {
    setDaysPerWeekState(value);
    setPreferredDays((current) => fitOnboardingDays(value, current));
  }

  function toggleTrainingDay(day: DayOfWeek) {
    setStatus(null);
    setIssues([]);
    setPreferredDays((current) => {
      if (current.includes(day)) return current.filter((item) => item !== day);
      if (current.length >= daysPerWeek) {
        setStatus(
          `Remove one day before selecting another. Your plan is set to ${daysPerWeek} days.`,
        );
        return current;
      }
      return [...current, day].sort((a, b) => a - b);
    });
  }

  function selectEnvironment(value: OnboardingInput['environment']) {
    setEnvironment(value);
    setEquipment(defaultEquipmentForEnvironment(value));
    setIssues([]);
  }

  function toggleEquipment(value: EquipmentType) {
    setIssues([]);
    setEquipment((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function togglePriority(value: MuscleGroup) {
    setStatus(null);
    setIssues([]);
    setMusclePriorities((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= 3) {
        setStatus('Choose up to three priority muscles. Remove one before adding another.');
        return current;
      }
      return [...current, value];
    });
  }

  async function createProfile() {
    const nextIssues = validateOnboardingInput(input);
    setIssues(nextIssues);
    setStatus(null);
    if (nextIssues.length > 0) return;

    setSaving(true);
    try {
      const user = buildOnboardingProfile(input);
      const preferences = buildOnboardingPreferences(input);
      const program = generateProgram(preferences, user.id);
      await saveTrainingProfile({ user, preferences });
      await saveActiveProgram(program);
      router.replace('/');
    } catch {
      setStatus('The plan could not be created from this setup. Review equipment and try again.');
    } finally {
      setSaving(false);
    }
  }

  function issueFor(field: OnboardingValidationIssue['field']): string | undefined {
    return issues.find((issue) => issue.field === field)?.message;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
          paddingBottom: insets.bottom + spacing.x4l,
          paddingHorizontal: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>GymBroFitness</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>
              Build your training block
            </Text>
          </View>
          <View
            style={[
              styles.stepBadge,
              { backgroundColor: colors.accentSoft, borderColor: colors.borderStrong },
            ]}
          >
            <Text style={[typography.captionBold, { color: colors.accent }]}>
              {step + 1}/{STEPS.length}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={styles.stepLabels}>
            {STEPS.map((label, index) => (
              <Text
                key={label}
                style={[
                  typography.micro,
                  { color: index === step ? colors.textPrimary : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          <ProgressBar
            progress={progress}
            color={colors.accent}
            style={[styles.progress, { backgroundColor: colors.surfaceRaised }]}
          />
        </View>

        <Card
          mode="contained"
          style={[
            styles.heroCard,
            elevation.low,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
        >
          <Card.Content style={{ gap: spacing.lg }}>
            {step === 0 ? (
              <ProfileStep
                displayName={displayName}
                units={units}
                setDisplayName={setDisplayName}
                setUnits={setUnits}
                nameIssue={issueFor('displayName')}
              />
            ) : null}
            {step === 1 ? (
              <GoalStep
                goal={goal}
                experience={experience}
                setGoal={setGoal}
                setExperience={setExperience}
              />
            ) : null}
            {step === 2 ? (
              <ScheduleStep
                daysPerWeek={daysPerWeek}
                preferredDays={preferredDays}
                sessionMinutes={sessionMinutes}
                setDaysPerWeek={changeDaysPerWeek}
                toggleTrainingDay={toggleTrainingDay}
                setSessionMinutes={setSessionMinutes}
                dayIssue={issueFor('preferredDays')}
              />
            ) : null}
            {step === 3 ? (
              <SetupStep
                environment={environment}
                equipment={equipment}
                musclePriorities={musclePriorities}
                selectEnvironment={selectEnvironment}
                toggleEquipment={toggleEquipment}
                togglePriority={togglePriority}
                equipmentIssue={issueFor('equipment')}
                priorityIssue={issueFor('musclePriorities')}
              />
            ) : null}
            {step === 4 ? (
              <ReviewStep
                displayName={displayName}
                preferences={previewPreferences}
                program={previewProgram}
              />
            ) : null}
          </Card.Content>
        </Card>

        {status ? (
          <Text
            accessibilityRole="alert"
            style={[
              typography.caption,
              {
                color: status.startsWith('The plan') ? colors.danger : colors.warning,
                backgroundColor: status.startsWith('The plan')
                  ? colors.dangerSoft
                  : colors.warningSoft,
                borderRadius: radius.md,
                padding: spacing.md,
              },
            ]}
          >
            {status}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Button mode="text" onPress={back} disabled={step === 0 || saving}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button mode="contained" onPress={advance} icon="arrow-right">
              Continue
            </Button>
          ) : (
            <Button
              mode="contained"
              icon="check"
              onPress={createProfile}
              loading={saving}
              disabled={saving}
            >
              Activate plan
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileStep({
  displayName,
  units,
  setDisplayName,
  setUnits,
  nameIssue,
}: {
  displayName: string;
  units: OnboardingInput['units'];
  setDisplayName: (value: string) => void;
  setUnits: (value: OnboardingInput['units']) => void;
  nameIssue?: string;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        eyebrow="Local setup"
        title="Set your training profile."
        body="No account is required. Your block and workout history are created on this device first."
      />
      <TextInput
        mode="outlined"
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        textColor={colors.textPrimary}
        outlineColor={colors.border}
        activeOutlineColor={colors.accent}
        error={Boolean(nameIssue)}
        style={{ backgroundColor: colors.surfaceRaised }}
      />
      <HelperText type="error" visible={Boolean(nameIssue)}>
        {nameIssue}
      </HelperText>
      <InlineChips
        label="Load units"
        options={UNIT_OPTIONS}
        selected={units}
        onSelect={setUnits}
        format={(value) => value.toUpperCase()}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Advanced preferences remain editable without resetting completed workouts.
      </Text>
    </View>
  );
}

function GoalStep({
  goal,
  experience,
  setGoal,
  setExperience,
}: {
  goal: OnboardingInput['goal'];
  experience: OnboardingInput['experience'];
  setGoal: (value: OnboardingInput['goal']) => void;
  setExperience: (value: OnboardingInput['experience']) => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeader
        eyebrow="Training model"
        title="Define the block, not your identity."
        body="Goal controls rep ranges and rest. Training age calibrates exercise complexity, starting volume and RIR."
      />
      <OptionGrid
        label="Primary objective"
        options={GOAL_OPTIONS}
        selected={goal}
        onSelect={setGoal}
      />
      <OptionGrid
        label="Consistent lifting history"
        options={EXPERIENCE_OPTIONS}
        selected={experience}
        onSelect={setExperience}
      />
    </View>
  );
}

function ScheduleStep({
  daysPerWeek,
  preferredDays,
  sessionMinutes,
  setDaysPerWeek,
  toggleTrainingDay,
  setSessionMinutes,
  dayIssue,
}: {
  daysPerWeek: OnboardingInput['daysPerWeek'];
  preferredDays: DayOfWeek[];
  sessionMinutes: OnboardingInput['sessionMinutes'];
  setDaysPerWeek: (value: OnboardingInput['daysPerWeek']) => void;
  toggleTrainingDay: (value: DayOfWeek) => void;
  setSessionMinutes: (value: OnboardingInput['sessionMinutes']) => void;
  dayIssue?: string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeader
        eyebrow="Weekly structure"
        title="Make the program fit the week."
        body="Session length is a hard constraint: optional work is trimmed before the main movements."
      />
      <InlineChips
        label="Training frequency"
        options={DAY_OPTIONS}
        selected={daysPerWeek}
        onSelect={setDaysPerWeek}
        format={(value) => `${value} days`}
      />
      <View style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>Training days</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {preferredDays.length}/{daysPerWeek}
          </Text>
        </View>
        <View style={styles.chipRow}>
          {WEEKDAYS.map((day) => {
            const active = preferredDays.includes(day.value);
            return (
              <Chip
                key={day.value}
                compact
                accessibilityLabel={day.label}
                selected={active}
                mode={active ? 'flat' : 'outlined'}
                onPress={() => toggleTrainingDay(day.value)}
                style={[
                  styles.choiceChip,
                  active ? { backgroundColor: colors.accentSoft } : undefined,
                ]}
                textStyle={active ? { color: colors.accent } : undefined}
              >
                {day.short}
              </Chip>
            );
          })}
        </View>
        <HelperText type="error" visible={Boolean(dayIssue)}>
          {dayIssue}
        </HelperText>
      </View>
      <InlineChips
        label="Session ceiling"
        options={SESSION_OPTIONS}
        selected={sessionMinutes}
        onSelect={setSessionMinutes}
        format={(value) => `${value} min`}
      />
    </View>
  );
}

function SetupStep({
  environment,
  equipment,
  musclePriorities,
  selectEnvironment,
  toggleEquipment,
  togglePriority,
  equipmentIssue,
  priorityIssue,
}: {
  environment: OnboardingInput['environment'];
  equipment: EquipmentType[];
  musclePriorities: MuscleGroup[];
  selectEnvironment: (value: OnboardingInput['environment']) => void;
  toggleEquipment: (value: EquipmentType) => void;
  togglePriority: (value: MuscleGroup) => void;
  equipmentIssue?: string;
  priorityIssue?: string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeader
        eyebrow="Exercise pool"
        title="Control what can enter the block."
        body="Start from a gym preset, then keep only the equipment you can reliably use."
      />
      <OptionGrid
        label="Training environment"
        options={ENVIRONMENT_OPTIONS}
        selected={environment}
        onSelect={selectEnvironment}
      />
      <View style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>Equipment</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {equipment.length} selected
          </Text>
        </View>
        <ToggleChips
          options={EQUIPMENT_TYPES}
          selected={equipment}
          onToggle={toggleEquipment}
          format={(value) => EQUIPMENT_LABELS[value]}
        />
        <HelperText type="error" visible={Boolean(equipmentIssue)}>
          {equipmentIssue}
        </HelperText>
      </View>
      <View style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
            Priority muscles
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Optional · {musclePriorities.length}/3
          </Text>
        </View>
        <ToggleChips
          options={PRIORITY_MUSCLES}
          selected={musclePriorities}
          onToggle={togglePriority}
          format={(value) => MUSCLE_LABELS[value]}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Priorities receive limited extra weekly volume while the rest of the program remains
          balanced.
        </Text>
        <HelperText type="error" visible={Boolean(priorityIssue)}>
          {priorityIssue}
        </HelperText>
      </View>
    </View>
  );
}

function ReviewStep({
  displayName,
  preferences,
  program,
}: {
  displayName: string;
  preferences: ReturnType<typeof buildOnboardingPreferences>;
  program: ReturnType<typeof generateProgram>;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const scheduledDays = preferences.preferredDays
    .map((day) => WEEKDAYS.find((option) => option.value === day)?.short)
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeader
        eyebrow="Block preview"
        title="Review before activation."
        body="This is the exact local plan GymBroFitness will activate. You can edit its days and exercises later without rewriting history."
      />
      <View style={styles.summaryGrid}>
        <SummaryCell label="profile" value={displayName.trim()} />
        <SummaryCell label="split" value={program.name} />
        <SummaryCell label="objective" value={formatGoal(preferences.goal)} />
        <SummaryCell label="training age" value={formatExperience(preferences.experience)} />
        <SummaryCell label="schedule" value={scheduledDays} />
        <SummaryCell label="session ceiling" value={`${preferences.sessionMinutes} min`} />
      </View>
      <View
        style={[styles.rationale, { backgroundColor: colors.accentSoft, borderRadius: radius.lg }]}
      >
        <Text style={[typography.captionBold, { color: colors.accent }]}>Why this block</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {program.rationale}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]}>Generated week</Text>
        {program.days.map((day, index) => (
          <View
            key={day.id}
            style={[
              styles.dayRow,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <View style={styles.dayIndex}>
              <Text style={[typography.captionBold, { color: colors.accent }]}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{day.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {
                  WEEKDAYS.find((option) => option.value === preferences.preferredDays[index])
                    ?.label
                }
                {' · '}
                {day.focus.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}
              </Text>
            </View>
            <View style={styles.dayMeta}>
              <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                {day.prescriptions.length} exercises
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                ~{day.estimatedMinutes} min
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatGoal(goal: OnboardingInput['goal']): string {
  if (goal === 'hypertrophy') return 'Hypertrophy';
  if (goal === 'strength') return 'Strength';
  return 'Powerbuilding';
}

function formatExperience(experience: ExperienceLevel): string {
  return EXPERIENCE_OPTIONS.find((option) => option.value === experience)?.title ?? experience;
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typography.micro, { color: colors.accent }]}>{eyebrow}</Text>
      <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

function OptionGrid<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: T; title: string; detail: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]}>{label}</Text>
      <View style={{ gap: spacing.sm }}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: pressed
                    ? colors.surfacePressed
                    : active
                      ? colors.accentSoft
                      : colors.surfaceRaised,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.bodyBold,
                    { color: active ? colors.accent : colors.textPrimary },
                  ]}
                >
                  {option.title}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {option.detail}
                </Text>
              </View>
              <View
                style={[
                  styles.radioDot,
                  {
                    borderColor: active ? colors.accent : colors.borderStrong,
                    backgroundColor: active ? colors.accent : 'transparent',
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InlineChips<T extends string | number>({
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
            key={String(option)}
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

function ToggleChips<T extends string>({
  options,
  selected,
  onToggle,
  format,
}: {
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  format: (value: T) => string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <Chip
            key={option}
            compact
            selected={active}
            mode={active ? 'flat' : 'outlined'}
            onPress={() => onToggle(option)}
            style={[styles.choiceChip, active ? { backgroundColor: colors.accentSoft } : undefined]}
            textStyle={active ? { color: colors.accent } : undefined}
          >
            {format(option)}
          </Chip>
        );
      })}
    </View>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.summaryCell, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepBadge: {
    minWidth: 52,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progress: { height: 5, borderRadius: 999 },
  heroCard: { borderWidth: StyleSheet.hairlineWidth },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  radioDot: { width: 16, height: 16, borderWidth: 2, borderRadius: 999 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { minHeight: 48, justifyContent: 'center' },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCell: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 62,
    borderRadius: 14,
    justifyContent: 'center',
    gap: 4,
    padding: 12,
  },
  rationale: { gap: 6, padding: 14 },
  dayRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayIndex: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dayMeta: { alignItems: 'flex-end', gap: 2 },
});
