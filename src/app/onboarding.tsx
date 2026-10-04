import { useEffect, useMemo, useRef, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow } from '@/components/ui/ListRow';
import { Pill } from '@/components/ui/Pill';
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
import { inputTheme, useTheme } from '@/theme';
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
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

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
  const preview = useMemo(() => {
    try {
      return {
        program: generateProgram(previewPreferences, 'preview-user'),
        error: null,
      };
    } catch {
      return {
        program: null,
        error: 'The plan needs a broader equipment selection before it can be generated.',
      };
    }
  }, [previewPreferences]);

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
    if (step === 3 && preview.error) {
      setStatus(preview.error);
      return;
    }
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
    setStatus(null);
    setIssues([]);
    setEquipment((current) => {
      if (!current.includes(value)) return [...current, value];
      if (current.length === 1) {
        setStatus('Keep at least one equipment option selected.');
        return current;
      }
      return current.filter((item) => item !== value);
    });
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
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
          paddingBottom: insets.bottom + spacing.x4l,
          paddingHorizontal: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <View style={styles.stepBars}>
            {STEPS.map((label, index) => (
              <View
                key={label}
                style={[
                  styles.stepBar,
                  { backgroundColor: index <= step ? colors.accent : colors.surfaceRaised },
                ]}
              />
            ))}
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Step {step + 1} of {STEPS.length}
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
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
          {step === 4 && preview.program ? (
            <ReviewStep preferences={previewPreferences} program={preview.program} />
          ) : null}
        </View>

        {status ? (
          <Text
            accessibilityRole="alert"
            style={[
              typography.caption,
              {
                color: status.startsWith('The plan') ? colors.danger : colors.warning,
                borderLeftWidth: 2,
                borderLeftColor: status.startsWith('The plan') ? colors.danger : colors.warning,
                paddingLeft: spacing.md,
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
            <Button
              mode="contained"
              onPress={advance}
              style={styles.primaryAction}
              contentStyle={styles.primaryContent}
            >
              Continue
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={createProfile}
              loading={saving}
              disabled={saving}
              style={styles.primaryAction}
              contentStyle={styles.primaryContent}
            >
              Start training
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
        title="Let's set you up."
        body="No account needed. Everything stays on this phone unless you turn on cloud backup later."
      />
      <TextInput
        theme={inputTheme}
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
        label="Weight unit"
        options={UNIT_OPTIONS}
        selected={units}
        onSelect={setUnits}
        format={(value) => value.toUpperCase()}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        You can change any of this later in Settings.
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
        title="What are you training for?"
        body="Your goal sets rep ranges and rest. Experience sets exercise choice, starting volume and effort."
      />
      <OptionGrid label="Goal" options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />
      <OptionGrid
        label="How long have you lifted consistently?"
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
        title="When do you train?"
        body="Session length decides how many exercises fit. Times are estimates."
      />
      <InlineChips
        label="Days a week"
        options={DAY_OPTIONS}
        selected={daysPerWeek}
        onSelect={setDaysPerWeek}
        format={(value) => `${value} days`}
      />
      <View style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Which days</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {preferredDays.length}/{daysPerWeek}
          </Text>
        </View>
        <View style={styles.chipRow}>
          {WEEKDAYS.map((day) => {
            const active = preferredDays.includes(day.value);
            return (
              <Pill
                key={day.value}
                label={day.short}
                accessibilityLabel={day.label}
                active={active}
                onPress={() => toggleTrainingDay(day.value)}
              />
            );
          })}
        </View>
        <HelperText type="error" visible={Boolean(dayIssue)}>
          {dayIssue}
        </HelperText>
      </View>
      <InlineChips
        label="Session length"
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
        title="What do you have access to?"
        body="Pick a preset, then untick anything you can't reliably use."
      />
      <OptionGrid
        label="Where you train"
        options={ENVIRONMENT_OPTIONS}
        selected={environment}
        onSelect={selectEnvironment}
      />
      <View style={{ gap: spacing.sm }}>
        <View style={styles.labelRow}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Equipment</Text>
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
          <Text style={[typography.caption, { color: colors.textMuted }]}>Priority muscles</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Optional, {musclePriorities.length} of 3
          </Text>
        </View>
        <ToggleChips
          options={PRIORITY_MUSCLES}
          selected={musclePriorities}
          onToggle={togglePriority}
          format={(value) => MUSCLE_LABELS[value]}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Priorities get a few extra sets a week. The rest stays balanced.
        </Text>
        <HelperText type="error" visible={Boolean(priorityIssue)}>
          {priorityIssue}
        </HelperText>
      </View>
    </View>
  );
}

function ReviewStep({
  preferences,
  program,
}: {
  preferences: ReturnType<typeof buildOnboardingPreferences>;
  program: ReturnType<typeof generateProgram>;
}) {
  const { colors, spacing, typography } = useTheme();
  const scheduledDays = preferences.preferredDays
    .map((day) => WEEKDAYS.find((option) => option.value === day)?.short)
    .filter(Boolean)
    .join(', ');
  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeader
        title="Your plan"
        body="You can edit days and exercises any time. Your history is never rewritten."
      />
      <View>
        <ListRow
          title={program.name}
          subtitle={`${formatGoal(preferences.goal)}, ${formatExperience(preferences.experience).toLowerCase()}`}
        />
        <ListRow
          title="Schedule"
          subtitle={`${scheduledDays}, ${preferences.sessionMinutes} min sessions`}
          last
        />
      </View>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{program.rationale}</Text>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Your week</Text>
        <View>
          {program.days.map((day, index) => (
            <ListRow
              key={day.id}
              title={day.name}
              subtitle={`${
                WEEKDAYS.find((option) => option.value === preferences.preferredDays[index])
                  ?.label ?? ''
              }, ${day.focus.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}`}
              value={`${day.prescriptions.length} ex`}
              last={index === program.days.length - 1}
            />
          ))}
        </View>
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

function SectionHeader({ title, body }: { title: string; body: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typography.display, { color: colors.textPrimary }]}>{title}</Text>
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
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
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
                  backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                  borderColor: active ? colors.accent : 'transparent',
                  borderRadius: radius.lg,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {option.title}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {option.detail}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={active ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={active ? colors.accent : colors.textMuted}
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
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => (
          <Pill
            key={String(option)}
            label={format(option)}
            active={selected === option}
            onPress={() => onSelect(option)}
          />
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
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pill
          key={option}
          label={format(option)}
          active={selected.includes(option)}
          onPress={() => onToggle(option)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stepBars: { flexDirection: 'row', gap: 4 },
  stepBar: { flex: 1, height: 3, borderRadius: 2 },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryAction: { flex: 1 },
  primaryContent: { minHeight: 52 },
  optionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
