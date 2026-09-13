import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, Chip, List, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Reveal } from '@/components/ui/Reveal';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  DEMO_DISPLAY_NAME,
  DEMO_PREFERENCES,
  DEMO_USER_ID,
} from '@/domain/programs/demoPreferences';
import { generateProgram } from '@/domain/programs/generator';
import {
  DEMO_COMPLETED_AT,
  DEMO_INTENSITY_RIR_MATCH,
  DEMO_TOTAL_WORKOUTS,
} from '@/domain/workouts/demoHistory';
import { computeLevel, computeStreak } from '@/domain/workouts/gamification';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const program = useMemo(() => generateProgram(DEMO_PREFERENCES, DEMO_USER_ID), []);
  const level = computeLevel(DEMO_TOTAL_WORKOUTS);
  const levelCurrent = DEMO_TOTAL_WORKOUTS - level.tier.minWorkouts;
  const levelRequired = level.nextTier
    ? level.nextTier.minWorkouts - level.tier.minWorkouts
    : DEMO_TOTAL_WORKOUTS;
  const streakDays = computeStreak(DEMO_COMPLETED_AT);
  const equipmentPreview = DEMO_PREFERENCES.equipment.slice(0, 5).map(formatEquipment);
  const priorityMuscles = DEMO_PREFERENCES.musclePriorities.map((muscle) => MUSCLE_LABELS[muscle]);

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <Reveal>
        <View style={styles.headerRow}>
          <Avatar.Text
            size={58}
            label={DEMO_DISPLAY_NAME.slice(0, 2).toUpperCase()}
            style={{ backgroundColor: colors.accentSoft }}
            color={colors.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Athlete profile</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{DEMO_DISPLAY_NAME}</Text>
          </View>
          <Chip compact mode="flat" icon="arm-flex">
            {DEMO_PREFERENCES.experience}
          </Chip>
        </View>
      </Reveal>

      <Reveal index={1}>
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
            <View style={styles.metricRow}>
              <ProfileMetric label="workouts" value={String(DEMO_TOTAL_WORKOUTS)} />
              <ProfileMetric label="streak" value={`${streakDays}d`} />
              <ProfileMetric label="tier" value={level.tier.name} />
            </View>
            <View style={{ gap: spacing.xs }}>
              <View style={styles.headerRow}>
                <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                  Level progression
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted }]}>
                  {levelCurrent}/{levelRequired}
                </Text>
              </View>
              <ProgressBar
                progress={level.progress}
                color={colors.accent}
                style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
              />
            </View>
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={2}>
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
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.micro, { color: colors.accent }]}>Current program</Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {program.name}
                </Text>
              </View>
              <Chip compact mode="flat" icon="calendar-week">
                {DEMO_PREFERENCES.daysPerWeek}d/wk
              </Chip>
            </View>
            <View style={styles.planGrid}>
              <PlanCell label="session" value={`${DEMO_PREFERENCES.sessionMinutes} min`} />
              <PlanCell label="goal" value={DEMO_PREFERENCES.goal} />
              <PlanCell label="rir match" value={`${Math.round(DEMO_INTENSITY_RIR_MATCH * 100)}%`} />
              <PlanCell label="units" value={DEMO_PREFERENCES.units} />
            </View>
            <View style={styles.chipRow}>
              {priorityMuscles.map((label) => (
                <Chip key={label} compact mode="outlined">
                  {label}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={3}>
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
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>
              Equipment stack
            </Text>
            {equipmentPreview.map((item) => (
              <List.Item
                key={item}
                title={item}
                left={(props) => <List.Icon {...props} icon="dumbbell" color={colors.accent} />}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                style={styles.compactListItem}
              />
            ))}
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {DEMO_PREFERENCES.equipment.length} available implements and stations
            </Text>
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={4}>
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
          <Card.Content style={{ gap: spacing.sm }}>
            <List.Item
              title="Workout history"
              description="Saved sessions, total volume, duration, and lift breakdown"
              onPress={() => router.push('/history')}
              left={(props) => <List.Icon {...props} icon="history" color={colors.accent} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
            />
            <List.Item
              title="Settings"
              description="Units, profile, notifications, and training preferences"
              onPress={() => router.push('/settings')}
              left={(props) => <List.Icon {...props} icon="cog-outline" color={colors.accent} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
            />
          </Card.Content>
        </Card>
      </Reveal>
    </Animated.ScrollView>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[typography.display, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function PlanCell({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.planCell, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatEquipment(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planCell: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactListItem: {
    paddingVertical: 0,
  },
});
