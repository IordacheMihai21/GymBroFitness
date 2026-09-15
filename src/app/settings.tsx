import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, IconButton, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  resetTrainingProfile,
  saveTrainingProfile,
  type TrainingProfileSnapshot,
} from '@/domain/programs/profileStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { useTheme } from '@/theme';
import type { CoachingTone, ExperienceLevel, TrainingPreferences, Units } from '@/types';

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const UNIT_OPTIONS: Units[] = ['kg', 'lb'];
const TONE_OPTIONS: CoachingTone[] = ['supportive', 'direct', 'hype', 'science'];
const DAY_OPTIONS: TrainingPreferences['daysPerWeek'][] = [2, 3, 4, 5, 6];
const SESSION_OPTIONS: TrainingPreferences['sessionMinutes'][] = [30, 45, 60, 75, 90];

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
  const [experience, setExperience] = useState(profile.preferences.experience);
  const [units, setUnits] = useState(profile.preferences.units);
  const [coachingTone, setCoachingTone] = useState(profile.preferences.coachingTone);
  const [daysPerWeek, setDaysPerWeek] = useState(profile.preferences.daysPerWeek);
  const [sessionMinutes, setSessionMinutes] = useState(profile.preferences.sessionMinutes);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function saveProfile() {
    setSaving(true);
    setStatus(null);
    try {
      const preferences: TrainingPreferences = {
        ...profile.preferences,
        experience,
        units,
        coachingTone,
        daysPerWeek,
        sessionMinutes,
        preferredDays: fitPreferredDays(daysPerWeek, profile.preferences.preferredDays),
      };
      await saveTrainingProfile({
        user: {
          ...profile.user,
          displayName: displayName.trim() || profile.user.displayName,
          onboardingCompleted: true,
        },
        preferences,
      });
      setStatus('Saved. Home, Workout and Profile will refresh from this local profile.');
    } catch {
      setStatus('Could not save profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function resetProfile() {
    setSaving(true);
    setStatus(null);
    try {
      const next = await resetTrainingProfile();
      syncEditor(next);
      setStatus('Reset to starter profile.');
    } catch {
      setStatus('Could not reset profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function syncEditor(next: TrainingProfileSnapshot) {
    setDisplayName(next.user.displayName);
    setExperience(next.preferences.experience);
    setUnits(next.preferences.units);
    setCoachingTone(next.preferences.coachingTone);
    setDaysPerWeek(next.preferences.daysPerWeek);
    setSessionMinutes(next.preferences.sessionMinutes);
  }

  return (
    <ScrollView
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
          onPress={saveProfile}
          disabled={saving}
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
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Athlete</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>Identity</Text>
          </View>
          <TextInput
            mode="outlined"
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            textColor={colors.textPrimary}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
            style={{ backgroundColor: colors.surfaceRaised }}
          />
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
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Training model</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Program defaults
            </Text>
          </View>
          <SegmentedChips
            label="Experience"
            options={EXPERIENCE_OPTIONS}
            selected={experience}
            onSelect={setExperience}
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
          />
        </Card.Content>
      </Card>

      {status ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{status}</Text>
      ) : null}

      <View style={styles.actionRow}>
        <Button mode="outlined" icon="restart" onPress={resetProfile} disabled={saving}>
          Reset
        </Button>
        <Button
          mode="contained"
          icon="check"
          onPress={saveProfile}
          loading={saving}
          disabled={saving}
        >
          Save profile
        </Button>
      </View>
    </ScrollView>
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
            style={selected === option ? { backgroundColor: colors.accentSoft } : undefined}
            textStyle={selected === option ? { color: colors.accent } : undefined}
          >
            {format(option)}
          </Chip>
        ))}
      </View>
    </View>
  );
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
