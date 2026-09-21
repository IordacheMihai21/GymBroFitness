import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, HelperText, ProgressBar, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { generateProgram } from '@/domain/programs/generator';
import {
  buildOnboardingPreferences,
  buildOnboardingProfile,
  validateOnboardingInput,
  type OnboardingInput,
  type OnboardingValidationIssue,
} from '@/domain/programs/onboarding';
import { saveTrainingProfile } from '@/domain/programs/profileStore';
import { saveActiveProgram } from '@/domain/programs/programStore';
import { useTheme } from '@/theme';
import type { ExperienceLevel } from '@/types';

const STEPS = ['Profile', 'Training', 'Plan'] as const;

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  title: string;
  detail: string;
}[] = [
  { value: 'beginner', title: 'Building base', detail: 'Simple loading, fewer edge cases' },
  { value: 'intermediate', title: 'Progressive lifter', detail: 'Balanced volume and overload' },
  { value: 'advanced', title: 'Advanced', detail: 'Tighter RIR and higher skill bias' },
];

const GOAL_OPTIONS: {
  value: OnboardingInput['goal'];
  title: string;
  detail: string;
}[] = [
  {
    value: 'hypertrophy',
    title: 'Build muscle',
    detail: 'Moderate-to-high reps with enough weekly volume to grow',
  },
  {
    value: 'strength',
    title: 'Get stronger',
    detail: 'Lower-rep compound work with longer recovery between sets',
  },
  {
    value: 'mixed',
    title: 'Strength + muscle',
    detail: 'Strength-focused compounds and hypertrophy accessories',
  },
];

const ENVIRONMENT_OPTIONS: {
  value: OnboardingInput['environment'];
  title: string;
  detail: string;
}[] = [
  { value: 'commercial_gym', title: 'Full gym', detail: 'Barbell, machines, cables' },
  { value: 'home_gym', title: 'Home setup', detail: 'Bench, DBs, pull-up bar' },
  { value: 'bodyweight', title: 'Minimal', detail: 'Bodyweight and bands' },
];

const DAY_OPTIONS: OnboardingInput['daysPerWeek'][] = [2, 3, 4, 5, 6];
const SESSION_OPTIONS: OnboardingInput['sessionMinutes'][] = [30, 45, 60, 75, 90];
const UNIT_OPTIONS: OnboardingInput['units'][] = ['kg', 'lb'];

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
  const [daysPerWeek, setDaysPerWeek] = useState<OnboardingInput['daysPerWeek']>(4);
  const [sessionMinutes, setSessionMinutes] = useState<OnboardingInput['sessionMinutes']>(60);
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
      daysPerWeek,
      sessionMinutes,
    }),
    [daysPerWeek, displayName, environment, experience, goal, sessionMinutes, units],
  );

  const previewPreferences = useMemo(() => buildOnboardingPreferences(input), [input]);
  const previewProgram = useMemo(
    () => generateProgram(previewPreferences, 'preview-user'),
    [previewPreferences],
  );

  const progress = (step + 1) / STEPS.length;

  function advance() {
    setStatus(null);
    if (step === 0) {
      const nextIssues = validateOnboardingInput(input);
      setIssues(nextIssues);
      if (nextIssues.length > 0) return;
    }
    setIssues([]);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setStatus(null);
    setIssues([]);
    setStep((current) => Math.max(current - 1, 0));
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
      setStatus('Could not create the training profile. Try another setup.');
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
      <Animated.ScrollView
        entering={FadeIn.duration(220)}
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
            <Text style={[typography.title, { color: colors.textPrimary }]}>Build your plan</Text>
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
            <Animated.View key={step} entering={FadeInUp.duration(220)} style={{ gap: spacing.lg }}>
              {step === 0 ? (
                <LocalProfileStep
                  displayName={displayName}
                  units={units}
                  setDisplayName={setDisplayName}
                  setUnits={setUnits}
                  nameIssue={issueFor('displayName')}
                />
              ) : null}

              {step === 1 ? (
                <TrainingStep
                  goal={goal}
                  experience={experience}
                  environment={environment}
                  daysPerWeek={daysPerWeek}
                  sessionMinutes={sessionMinutes}
                  setGoal={setGoal}
                  setExperience={setExperience}
                  setEnvironment={setEnvironment}
                  setDaysPerWeek={setDaysPerWeek}
                  setSessionMinutes={setSessionMinutes}
                />
              ) : null}

              {step === 2 ? (
                <ReviewStep
                  displayName={displayName}
                  preferences={previewPreferences}
                  program={previewProgram}
                />
              ) : null}
            </Animated.View>
          </Card.Content>
        </Card>

        {status ? (
          <Text style={[typography.caption, { color: colors.danger }]}>{status}</Text>
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
              Save plan
            </Button>
          )}
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

function LocalProfileStep({
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
        eyebrow="Local profile"
        title="No account required."
        body="Your profile, plan and workout history stay on this device unless you export them."
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
        label="Units"
        options={UNIT_OPTIONS}
        selected={units}
        onSelect={setUnits}
        format={(value) => value.toUpperCase()}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        You can add optional profile details and advanced preferences later in Settings.
      </Text>
    </View>
  );
}

function TrainingStep({
  goal,
  experience,
  environment,
  daysPerWeek,
  sessionMinutes,
  setGoal,
  setExperience,
  setEnvironment,
  setDaysPerWeek,
  setSessionMinutes,
}: {
  goal: OnboardingInput['goal'];
  experience: OnboardingInput['experience'];
  environment: OnboardingInput['environment'];
  daysPerWeek: OnboardingInput['daysPerWeek'];
  sessionMinutes: OnboardingInput['sessionMinutes'];
  setGoal: (value: OnboardingInput['goal']) => void;
  setExperience: (value: OnboardingInput['experience']) => void;
  setEnvironment: (value: OnboardingInput['environment']) => void;
  setDaysPerWeek: (value: OnboardingInput['daysPerWeek']) => void;
  setSessionMinutes: (value: OnboardingInput['sessionMinutes']) => void;
}) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <SectionHeader
        eyebrow="Training model"
        title="Set the constraints that change the plan."
        body="Your goal changes rep ranges and rest. Experience and schedule shape the rest of the plan."
      />
      <OptionGrid label="Primary goal" options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />
      <OptionGrid
        label="Experience"
        options={EXPERIENCE_OPTIONS}
        selected={experience}
        onSelect={setExperience}
      />
      <OptionGrid
        label="Environment"
        options={ENVIRONMENT_OPTIONS}
        selected={environment}
        onSelect={setEnvironment}
      />
      <InlineChips
        label="Days per week"
        options={DAY_OPTIONS}
        selected={daysPerWeek}
        onSelect={setDaysPerWeek}
        format={(value) => `${value}d`}
      />
      <InlineChips
        label="Session target"
        options={SESSION_OPTIONS}
        selected={sessionMinutes}
        onSelect={setSessionMinutes}
        format={(value) => `${value}m`}
      />
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
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <SectionHeader
        eyebrow="Ready"
        title="Your first block is ready to save."
        body={`This creates the local profile and activates the generated ${formatGoal(preferences.goal)} plan.`}
      />
      <View style={styles.summaryGrid}>
        <SummaryCell label="profile" value={displayName.trim()} />
        <SummaryCell label="split" value={program.name} />
        <SummaryCell label="goal" value={formatGoal(preferences.goal)} />
        <SummaryCell label="schedule" value={`${preferences.daysPerWeek}d/wk`} />
        <SummaryCell label="session" value={`${preferences.sessionMinutes} min`} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]}>Generated week</Text>
        {program.days.map((day) => (
          <View
            key={day.id}
            style={[
              styles.dayRow,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{day.name}</Text>
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
    </View>
  );
}

function formatGoal(goal: OnboardingInput['goal']): string {
  if (goal === 'hypertrophy') return 'muscle-building';
  if (goal === 'strength') return 'strength';
  return 'strength + muscle';
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
              onPress={() => onSelect(option.value)}
              style={[
                styles.optionRow,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surfaceRaised,
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

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepBadge: {
    minWidth: 52,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  progress: {
    height: 5,
    borderRadius: 999,
  },
  heroCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 999,
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCell: {
    width: '48%',
    minHeight: 56,
    borderRadius: 14,
    justifyContent: 'center',
    gap: 4,
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
});
