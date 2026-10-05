import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HealthConnectCard } from '@/components/profile/HealthConnectCard';
import { ListRow } from '@/components/ui/ListRow';
import { formatGoal } from '@/features/program/program.helpers';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { Reveal } from '@/components/ui/Reveal';
import { Stat } from '@/components/ui/Stat';
import { Tile } from '@/components/ui/Tile';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { buildPlannedWeek, buildWorkoutHistoryInsights } from '@/domain/workouts/historyInsights';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme } from '@/theme';
import type { WorkoutSession } from '@/types';

export default function ProfileScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const { user, preferences, program } = useActiveProgram();
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      listWorkoutHistory().then((next) => {
        if (mounted) setHistory(next);
      });
      return () => {
        mounted = false;
      };
    }, []),
  );
  const plannedWeek = useMemo(
    () => buildPlannedWeek(program.days, preferences.preferredDays),
    [preferences.preferredDays, program.days],
  );
  const insights = useMemo(
    () => buildWorkoutHistoryInsights(history, plannedWeek),
    [history, plannedWeek],
  );
  const level = insights.level;
  const levelCurrent = insights.totalWorkouts - level.tier.minWorkouts;
  const levelRequired = level.nextTier
    ? level.nextTier.minWorkouts - level.tier.minWorkouts
    : Math.max(1, insights.totalWorkouts);
  const equipmentPreview = preferences.equipment.slice(0, 5).map(formatEquipment);
  const priorityMuscles = preferences.musclePriorities.map((muscle) => MUSCLE_LABELS[muscle]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: 12,
      }}
    >
      <Reveal>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill },
            ]}
          >
            <Text style={[typography.title, { color: colors.textPrimary }]}>
              {user.displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.display, { color: colors.textPrimary }]} numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {capitalize(preferences.experience)}, {level.tier.name}
            </Text>
          </View>
        </View>
      </Reveal>

      <Reveal index={1}>
        <Tile
          glow
          title={
            level.nextTier ? `${level.tier.name}, next ${level.nextTier.name}` : level.tier.name
          }
        >
          <View style={styles.statRow}>
            <Stat value={String(insights.totalWorkouts)} label="workouts" />
            <Stat value={String(insights.streakDays)} label="day streak" />
            <Stat
              value={`${levelCurrent}/${levelRequired}`}
              label={level.nextTier ? `to ${level.nextTier.name}` : 'top level'}
            />
          </View>
          <ProgressLine progress={level.progress} height={4} />
        </Tile>
      </Reveal>

      <Reveal index={2}>
        <Tile title="Training setup">
          <View>
            <ListRow title="Plan" subtitle={program.name} onPress={() => router.push('/program')} />
            <ListRow title="Goal" value={formatGoal(preferences.goal)} />
            <ListRow title="Days a week" value={String(preferences.daysPerWeek)} />
            <ListRow title="Session length" value={`${preferences.sessionMinutes} min`} />
            {priorityMuscles.length > 0 ? (
              <ListRow title="Priorities" subtitle={priorityMuscles.join(', ')} />
            ) : null}
            <ListRow
              title="Equipment"
              subtitle={`${equipmentPreview.join(', ')}${preferences.equipment.length > equipmentPreview.length ? `, +${preferences.equipment.length - equipmentPreview.length} more` : ''}`}
              last
            />
          </View>
        </Tile>
      </Reveal>

      <Reveal index={3}>
        <HealthConnectCard userId={user.id} />
      </Reveal>

      <Reveal index={4}>
        <Tile style={{ paddingVertical: spacing.xs }}>
          <ListRow
            title="Workout history"
            left={<RowIcon name="history" />}
            onPress={() => router.push('/history')}
          />
          <ListRow
            title="Form check"
            subtitle="Film a lateral raise and get a form score"
            left={<RowIcon name="camera-outline" />}
            onPress={() =>
              router.push({
                pathname: '/form-check/[exerciseId]',
                params: { exerciseId: 'lateral-raise' },
              })
            }
          />
          <ListRow
            title="Settings"
            subtitle="Units, account, sync and training preferences"
            left={<RowIcon name="cog-outline" />}
            onPress={() => router.push('/settings')}
            last
          />
        </Tile>
      </Reveal>
    </ScrollView>
  );
}

function RowIcon({ name }: { name: keyof typeof MaterialCommunityIcons.glyphMap }) {
  const { colors } = useTheme();
  return <MaterialCommunityIcons name={name} size={22} color={colors.textSecondary} />;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
