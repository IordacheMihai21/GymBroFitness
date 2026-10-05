import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runOnJS } from 'react-native-reanimated';

import { Sparkline } from '@/components/charts/Sparkline';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ListRow } from '@/components/ui/ListRow';
import { Tile } from '@/components/ui/Tile';
import { listBodyMeasurements } from '@/domain/body/bodyTrackingStore';
import { syncWeightFromHealthConnect } from '@/services/healthConnect';
import type { BodyMeasurementEntry } from '@/domain/body/measurements';
import { bodyweightSnapshot } from '@/domain/workouts/dashboard';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { Reveal } from '@/components/ui/Reveal';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  BODY_HEAT_LEGEND,
  DEFAULT_MUSCLE,
  RANK_TIER_COLORS,
  type BodySide,
  bodyIntensityForVolume,
  bodySidesForMuscle,
  bodySlugsForMuscle,
  defaultMuscleForBodySide,
  heatColorForVolumeZone,
  muscleFromBodySlug,
  shortVolumeZoneLabel,
} from '@/domain/muscles/muscleMap';
import {
  buildMuscleIntelligence,
  type MuscleIntelligence,
} from '@/domain/workouts/muscleIntelligence';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import {
  buildBodyProgression,
  type BodyBadge,
  type MuscleRankProgress,
} from '@/domain/workouts/muscleProgression';
import { VolumeLandmarkGauge } from '@/components/muscles/VolumeLandmarkGauge';
import { formatDate } from '@/utils/dates';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme, type SemanticColors } from '@/theme';
import type { MuscleGroup, WorkoutSession } from '@/types';
import { displayLoad, formatLoad, formatVolumeLoad, unitLabel } from '@/utils/units';

const BODY_SIDES = [
  { label: 'Front', value: 'front' },
  { label: 'Back', value: 'back' },
] as const;

export default function BodyScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>(DEFAULT_MUSCLE);
  const [bodySide, setBodySide] = useState<BodySide>('front');
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([]);
  const bodyweight = useMemo(() => bodyweightSnapshot(measurements), [measurements]);
  const { user, program, preferences } = useActiveProgram();
  const bodyScale = useMemo(
    () => Math.min(1.1, Math.max(0.9, (width - spacing.x4l * 2) / 240)),
    [spacing.x4l, width],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      listWorkoutHistory().then((next) => {
        if (mounted) setHistory(next);
      });
      const loadMeasurements = () =>
        listBodyMeasurements()
          .then((next) => {
            if (mounted) setMeasurements(next);
          })
          .catch(() => undefined);
      void loadMeasurements();
      // New weigh-ins from a scale or health app (throttled; no-op unless connected).
      void syncWeightFromHealthConnect(user.id).then((added) => {
        if (added > 0) void loadMeasurements();
      });
      return () => {
        mounted = false;
      };
    }, [user.id]),
  );

  const intelligence = useMemo(
    () => buildMuscleIntelligence(program.days, history, undefined, preferences.units),
    [history, preferences.units, program.days],
  );
  const progression = useMemo(() => buildBodyProgression(history), [history]);
  const selected =
    intelligence.find((item) => item.muscle === selectedMuscle) ??
    intelligence.find((item) => item.muscle === DEFAULT_MUSCLE) ??
    intelligence[0];
  const selectedRank =
    progression.muscles.find((item) => item.muscle === selectedMuscle) ?? progression.muscles[0];
  const bodyData = useMemo(
    () => buildBodyData(intelligence, selected.muscle, colors),
    [colors, intelligence, selected.muscle],
  );

  const selectMuscle = useCallback((muscle: MuscleGroup) => {
    setSelectedMuscle(muscle);
    Haptics.selectionAsync();
  }, []);

  const setBodySideFromGesture = useCallback((nextSide: BodySide) => {
    setBodySide(nextSide);
    setSelectedMuscle((current) =>
      bodySidesForMuscle(current).includes(nextSide) ? current : defaultMuscleForBodySide(nextSide),
    );
    Haptics.selectionAsync();
  }, []);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((event) => {
          if (event.translationX < -42) runOnJS(setBodySideFromGesture)('back');
          else if (event.translationX > 42) runOnJS(setBodySideFromGesture)('front');
        }),
    [setBodySideFromGesture],
  );

  function handleBodyPartPress(part: ExtendedBodyPart) {
    if (!part.slug) return;
    const nextMuscle = muscleFromBodySlug(part.slug);
    if (nextMuscle) selectMuscle(nextMuscle);
  }

  const latestSession = selected.recentSessions[0];

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
      <Reveal style={{ marginBottom: spacing.sm }}>
        <Text style={[typography.display, { color: colors.textPrimary }]}>Body</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {history.length === 1 ? '1 workout logged' : `${history.length} workouts logged`}
        </Text>
      </Reveal>

      <Reveal index={1}>
        <Tile
          title="Weight and progress photos"
          onPress={() => router.push('/body-log')}
          accessibilityLabel="Open weight, measurements and progress photos"
        >
          {bodyweight ? (
            <View style={styles.weightRow}>
              <View style={{ gap: 2 }}>
                <AnimatedNumber
                  value={`${displayLoad(bodyweight.latestKg, preferences.units) ?? 0}`}
                  style={[
                    typography.jumbo,
                    { color: colors.textPrimary, fontSize: 30, lineHeight: 34 },
                  ]}
                />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {unitLabel(preferences.units)}, {formatDate(bodyweight.date)}
                  {bodyweight.deltaKg != null
                    ? `, ${bodyweight.deltaKg > 0 ? '+' : ''}${(displayLoad(bodyweight.deltaKg, preferences.units) ?? 0).toFixed(1)}`
                    : ''}
                </Text>
              </View>
              <Sparkline
                values={bodyweight.series}
                width={140}
                height={44}
                color={colors.textSecondary}
              />
            </View>
          ) : (
            <View style={styles.weightRow}>
              <MaterialCommunityIcons name="scale-bathroom" size={28} color={colors.accent} />
              <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>
                Log bodyweight, measurements and photos to track how your body changes.
              </Text>
            </View>
          )}
        </Tile>
      </Reveal>

      <Reveal index={2}>
        <Tile>
          <View style={styles.headerRow}>
            <Text style={[typography.heading, { color: colors.textPrimary, flex: 1 }]}>
              Muscle map
            </Text>
            <Segmented options={BODY_SIDES} value={bodySide} onChange={setBodySideFromGesture} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Direct sets this week. Tap a muscle, swipe to turn around.
          </Text>

          <GestureDetector gesture={swipeGesture}>
            <View style={styles.bodyStage}>
              <Body
                data={bodyData}
                colors={[
                  colors.surfaceRaised,
                  colors.surfaceRaised,
                  colors.surfaceRaised,
                  colors.surfaceRaised,
                ]}
                side={bodySide}
                scale={bodyScale}
                border="none"
                defaultFill={colors.surfaceRaised}
                defaultStroke={colors.border}
                defaultStrokeWidth={0.35}
                onBodyPartPress={handleBodyPartPress}
              />
            </View>
          </GestureDetector>
          <HeatLegend />
        </Tile>
      </Reveal>

      <Reveal index={3}>
        <Tile glow>
          <View style={{ gap: 2 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>
              {MUSCLE_LABELS[selected.muscle]}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {shortVolumeZoneLabel(selected.trainingLoad.volume.zone)} volume,{' '}
              {lastTrainedLabel(selected).toLowerCase()}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Stat value={String(selected.trainingLoad.directSets)} label="direct sets" emphasis />
            <Stat value={String(selected.trainingLoad.indirectExposures)} label="indirect" />
            <Stat
              value={
                selected.trainingLoad.averageRir != null
                  ? String(selected.trainingLoad.averageRir)
                  : '-'
              }
              label="avg RIR"
            />
          </View>
          <VolumeLandmarkGauge
            landmarks={selected.trainingLoad.volume.landmarks}
            weeklySets={selected.trainingLoad.volume.weeklySets}
            zone={selected.trainingLoad.volume.zone}
          />

          <View style={{ gap: 2 }}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              {selected.signal.label}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {selected.signal.detail}
            </Text>
          </View>

          <RankLine rank={selectedRank} />

          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {selected.formQuality.averageScore != null
              ? `Form AI ${selected.formQuality.averageScore}/100 over ${selected.formQuality.analyzedSetCount} sets. ${selected.formQuality.mostCommonIssue ?? 'No repeated issue.'}`
              : 'Film a set on a supported lift to see Form AI scores here.'}
          </Text>
        </Tile>
      </Reveal>

      <Reveal index={4}>
        <Section title="Last session">
          {latestSession ? (
            <View>
              <ListRow
                title={latestSession.dayName}
                subtitle={`${formatDate(latestSession.performedAt)}, ${latestSession.sets} sets, ${formatVolumeLoad(latestSession.volumeKg, preferences.units)}`}
                onPress={() =>
                  router.push({
                    pathname: '/history',
                    params: { sessionId: latestSession.sessionId },
                  })
                }
              />
              {latestSession.exercises.slice(0, 3).map((exercise, index, shown) => (
                <ListRow
                  key={exercise.exerciseId}
                  title={exercise.name}
                  subtitle={`${exercise.sets} sets, best ${exercise.bestSetLabel}`}
                  value={
                    exercise.averageFormScore != null ? `${exercise.averageFormScore}` : undefined
                  }
                  last={index === shown.length - 1}
                />
              ))}
            </View>
          ) : (
            <EmptyText>Finish a session with direct sets for this muscle to see it here.</EmptyText>
          )}
          <Button
            compact
            mode="text"
            onPress={() => router.push('/history')}
            style={styles.inlineButton}
          >
            All workout history
          </Button>
        </Section>
      </Reveal>

      <Reveal index={5}>
        <Section title="Records">
          {selected.records.length === 0 ? (
            <EmptyText>Finish loaded work for this muscle to set your first records.</EmptyText>
          ) : (
            <View>
              {selected.records.slice(0, 5).map((record, index, shown) => (
                <ListRow
                  key={record.exerciseId}
                  title={record.name}
                  subtitle={[
                    record.bestLoadKg != null
                      ? `Top ${formatLoad(record.bestLoadKg, preferences.units)} x ${record.repsAtBestLoad ?? 0}`
                      : 'No loaded top set',
                    record.bestE1rmKg != null
                      ? `e1RM ${formatLoad(record.bestE1rmKg, preferences.units)}`
                      : null,
                    record.lastPerformedAt ? formatDate(record.lastPerformedAt) : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  onPress={() =>
                    router.push({ pathname: '/exercise/[id]', params: { id: record.exerciseId } })
                  }
                  last={index === shown.length - 1}
                />
              ))}
            </View>
          )}
        </Section>
      </Reveal>

      <Reveal index={6}>
        <Section title="In your plan">
          {selected.programExercises.length === 0 ? (
            <EmptyText>This muscle is not a main target in your current plan.</EmptyText>
          ) : (
            <View>
              {selected.programExercises.slice(0, 6).map((exercise, index, shown) => (
                <ListRow
                  key={`${exercise.exerciseId}-${exercise.dayName}`}
                  title={exercise.name}
                  subtitle={`${exercise.dayName}, ${exercise.workingSets} x ${exercise.repRangeLabel}, RIR ${exercise.targetRir}`}
                  last={index === shown.length - 1}
                />
              ))}
            </View>
          )}
        </Section>
      </Reveal>

      <Reveal index={7}>
        <Section
          title="Badges"
          right={
            <Text style={[typography.numeric, { color: colors.textMuted, fontSize: 15 }]}>
              {progression.unlockedBadgeCount}/{progression.badges.length}
            </Text>
          }
        >
          <View>
            {progression.badges.map((badge, index) => (
              <BadgeRow
                key={badge.id}
                badge={badge}
                last={index === progression.badges.length - 1}
              />
            ))}
          </View>
        </Section>
      </Reveal>

      <Reveal index={8}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Colors compare this week&apos;s direct sets with general reference ranges. Rank tracks
          long-term training history. Neither measures fatigue or recovery, and strength stays
          exercise-specific because different machines are not comparable.
        </Text>
      </Reveal>
    </ScrollView>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tile title={title} aside={right}>
      {children}
    </Tile>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  const { colors, typography } = useTheme();
  return <Text style={[typography.caption, { color: colors.textMuted }]}>{children}</Text>;
}

function HeatLegend() {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.heatLegend}>
      {BODY_HEAT_LEGEND.map((item) => (
        <View key={item.label} style={styles.heatLegendItem}>
          <View style={[styles.heatLegendDot, { backgroundColor: item.color }]} />
          <Text style={[typography.micro, { color: colors.textMuted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function RankLine({ rank }: { rank: MuscleRankProgress }) {
  const { colors, typography } = useTheme();
  const rankColor = RANK_TIER_COLORS[rank.rank];

  return (
    <View accessibilityLabel={rankAccessibilityLabel(rank)} style={{ gap: 6 }}>
      <View style={styles.headerRow}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
          {rank.rank === 'Unranked' ? 'Not ranked yet' : `Rank ${rank.rank}`}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {rank.directSets} sets, {rank.sessionCount} sessions
        </Text>
      </View>
      <ProgressLine progress={rank.progress} color={rankColor} />
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {rank.nextRank
          ? `${rank.setsRemaining} ${rank.setsRemaining === 1 ? 'set' : 'sets'} and ${rank.sessionsRemaining} ${rank.sessionsRemaining === 1 ? 'session' : 'sessions'} to Rank ${rank.nextRank}`
          : 'Highest rank reached'}
      </Text>
    </View>
  );
}

function BadgeRow({ badge, last }: { badge: BodyBadge; last: boolean }) {
  const { colors, typography } = useTheme();
  const progressLabel = badge.unlocked
    ? 'Unlocked'
    : badge.unit === '%'
      ? `${Math.min(100, badge.current)}%`
      : `${badge.current}/${badge.target} ${badge.unit}`;

  return (
    <View
      accessibilityLabel={`${badge.name}. ${badge.description} ${progressLabel}`}
      style={[
        styles.badgeRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          opacity: badge.unlocked ? 1 : 0.7,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={badge.icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={22}
        color={badge.unlocked ? colors.accent : colors.textMuted}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{badge.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{badge.description}</Text>
      </View>
      <Text
        style={[
          typography.captionBold,
          { color: badge.unlocked ? colors.accent : colors.textSecondary },
        ]}
      >
        {progressLabel}
      </Text>
    </View>
  );
}

function buildBodyData(
  intelligence: MuscleIntelligence[],
  selectedMuscle: MuscleGroup,
  colors: SemanticColors,
): ExtendedBodyPart[] {
  return intelligence.flatMap((item) => {
    const isSelected = item.muscle === selectedMuscle;
    const intensity = bodyIntensity(item);
    const tone = muscleTone(item, colors);
    return bodySlugsForMuscle(item.muscle).flatMap((slug) => {
      if (!isSelected && intensity === 0) return [];
      return [
        {
          slug,
          intensity: isSelected ? 4 : intensity,
          styles: {
            fill: isSelected ? tone.fill : tone.subtleFill,
            stroke: isSelected ? tone.stroke : tone.fill,
            strokeWidth: isSelected ? 1.2 : 0.45,
          },
        },
      ];
    });
  });
}

function bodyIntensity(item: MuscleIntelligence): number {
  return bodyIntensityForVolume({
    zone: item.trainingLoad.volume.zone,
    hasSignal: item.programExercises.length > 0 || item.records.length > 0,
  });
}

function muscleTone(item: MuscleIntelligence, colors: SemanticColors) {
  const fill = heatColorForVolumeZone(item.trainingLoad.volume.zone);
  const intensity = bodyIntensity(item);

  return {
    fill,
    subtleFill: withAlpha(fill, intensity >= 3 ? 'BA' : intensity >= 2 ? '82' : '58'),
    stroke: colors.textPrimary,
  };
}

function lastTrainedLabel(selected: MuscleIntelligence): string {
  if (!selected.trainingLoad.lastTrainedAt) return 'No direct session yet';
  if (selected.trainingLoad.lastTrainedDaysAgo === 0) return 'Trained today';
  if (selected.trainingLoad.lastTrainedDaysAgo === 1) return 'Trained yesterday';
  return `${selected.trainingLoad.lastTrainedDaysAgo} days since trained`;
}

function rankAccessibilityLabel(rank: MuscleRankProgress): string {
  if (!rank.nextRank) {
    return `Rank ${rank.rank}. ${rank.directSets} direct sets across ${rank.sessionCount} sessions. Highest evidence rank reached.`;
  }
  return `Rank ${rank.rank}. ${rank.directSets} direct sets across ${rank.sessionCount} sessions. ${rank.setsRemaining} sets and ${rank.sessionsRemaining} sessions to Rank ${rank.nextRank}.`;
}

function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}

const styles = StyleSheet.create({
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bodyStage: {
    minHeight: 440,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    marginLeft: -12,
  },
  badgeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  heatLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  heatLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heatLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
});
