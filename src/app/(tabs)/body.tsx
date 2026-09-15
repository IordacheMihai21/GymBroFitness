import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';
import { BarChart, type barDataItem } from 'react-native-gifted-charts';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Card, Chip, Divider, List, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated';

import { Reveal } from '@/components/ui/Reveal';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  BODY_HEAT_COLORS,
  BODY_HEAT_LEGEND,
  DEFAULT_MUSCLE,
  RANK_TIER_COLORS,
  type BodySide,
  bodyIntensityForFatigue,
  bodySidesForMuscle,
  bodySlugsForMuscle,
  defaultMuscleForBodySide,
  heatColorForFatigue,
  muscleFromBodySlug,
  shortVolumeZoneLabel,
} from '@/domain/muscles/muscleMap';
import {
  buildMuscleIntelligence,
  type MuscleIntelligence,
  type MuscleProgramExercise,
  type MuscleStrengthRank,
} from '@/domain/workouts/muscleIntelligence';
import { listWorkoutHistory } from '@/domain/workouts/historyStore';
import { formatDate } from '@/utils/dates';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useTheme, type SemanticColors } from '@/theme';
import type { MuscleGroup, WorkoutSession } from '@/types';

export default function BodyScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>(DEFAULT_MUSCLE);
  const [bodySide, setBodySide] = useState<BodySide>('front');
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const { program } = useActiveProgram();
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
      return () => {
        mounted = false;
      };
    }, []),
  );

  const intelligence = useMemo(
    () => buildMuscleIntelligence(program.days, history),
    [history, program.days],
  );
  const selected =
    intelligence.find((item) => item.muscle === selectedMuscle) ??
    intelligence.find((item) => item.muscle === DEFAULT_MUSCLE) ??
    intelligence[0];
  const bodyData = useMemo(
    () => buildBodyData(intelligence, selected.muscle, colors),
    [colors, intelligence, selected.muscle],
  );
  const selectedTone = useMemo(() => muscleTone(selected, colors), [colors, selected]);
  const selectedUiColor =
    selectedTone.fill === BODY_HEAT_COLORS.dormant ? colors.textSecondary : selectedTone.fill;
  const selectedRankColor = RANK_TIER_COLORS[selected.rank.tier];
  const rankData = useMemo(
    () => buildRankChartData(intelligence, selected.muscle, colors),
    [colors, intelligence, selected.muscle],
  );
  const hasRankData = rankData.some((item) => (item.value ?? 0) > 0);
  const maxRankValue = Math.max(...rankData.map((item) => item.value ?? 0), 1);

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
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Muscle intelligence
            </Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Body</Text>
          </View>
          <Chip compact mode="flat" icon="database">
            {history.length} logs
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
          <Card.Content style={{ gap: spacing.lg }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.micro, { color: selectedUiColor }]}>Selected tissue</Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {MUSCLE_LABELS[selected.muscle]}
                </Text>
              </View>
              <Chip
                compact
                mode="flat"
                icon="gesture-swipe"
                style={{ backgroundColor: withAlpha(selectedUiColor, '18') }}
                textStyle={{ color: selectedUiColor }}
                onPress={() => setBodySideFromGesture(bodySide === 'front' ? 'back' : 'front')}
              >
                {bodySide === 'front' ? 'Front' : 'Back'}
              </Chip>
            </View>

            <GestureDetector gesture={swipeGesture}>
              <View style={[styles.bodyStage, { backgroundColor: colors.surfaceRaised }]}>
                <Body
                  data={bodyData}
                  colors={[
                    colors.surfacePressed,
                    colors.surfacePressed,
                    colors.surfacePressed,
                    colors.surfacePressed,
                  ]}
                  side={bodySide}
                  scale={bodyScale}
                  border="none"
                  defaultFill={colors.surfacePressed}
                  defaultStroke={colors.border}
                  defaultStrokeWidth={0.35}
                  onBodyPartPress={handleBodyPartPress}
                />
              </View>
            </GestureDetector>
            <HeatLegend />

            <View style={styles.metricGrid}>
              <MetricBlock
                label="Fatigue"
                value={`${selected.fatigue.score}%`}
                detail={shortVolumeZoneLabel(selected.fatigue.volume.zone)}
              />
              <MetricBlock
                label="Last time"
                value={`${selected.fatigue.lastSessionSets}`}
                detail={selected.fatigue.lastSessionName ?? 'No direct sets'}
              />
              <MetricBlock
                label="Load rank"
                value={rankLabel(selected.rank)}
                detail={rankDetail(selected.rank)}
              />
            </View>
            <ProgressBar
              progress={selected.fatigue.score / 100}
              color={selectedTone.fill}
              style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
            />
            <View style={styles.fatigueMetaRow}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {selected.fatigue.weeklySets} direct sets this week
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {lastTrainedLabel(selected)}
              </Text>
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
              <View>
                <Text style={[typography.micro, { color: selectedRankColor }]}>
                  Strength leaderboard
                </Text>
                <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                  Heaviest loaded set
                </Text>
              </View>
              <Chip
                compact
                mode="flat"
                icon="podium"
                style={{ backgroundColor: withAlpha(selectedRankColor, '18') }}
                textStyle={{ color: selectedRankColor }}
              >
                Tier {selected.rank.tier}
              </Chip>
            </View>

            {hasRankData ? (
              <View style={styles.chartFrame}>
                <BarChart
                  data={rankData}
                  height={118}
                  width={300}
                  maxValue={maxRankValue + 20}
                  barWidth={24}
                  spacing={18}
                  roundedTop
                  roundedBottom
                  hideAxesAndRules
                  hideYAxisText
                  xAxisThickness={0}
                  yAxisThickness={0}
                  yAxisLabelWidth={0}
                  disableScroll
                  backgroundColor="transparent"
                />
              </View>
            ) : (
              <List.Item
                title="No loaded records yet"
                description="Heavy top sets appear here after completed sessions."
                left={(props) => <List.Icon {...props} icon="chart-bar" color={colors.accent} />}
                titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
              />
            )}
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={3}>
        <DetailCard title="Program exercises" eyebrow="Current plan">
          {selected.programExercises.length === 0 ? (
            <EmptyListItem
              icon="dumbbell"
              title="No direct prescription"
              description="This muscle is not a primary target in the current generated week."
            />
          ) : (
            selected.programExercises
              .slice(0, 6)
              .map((exercise, index) => (
                <ProgramExerciseItem
                  key={`${exercise.exerciseId}-${exercise.dayName}`}
                  exercise={exercise}
                  showDivider={index < Math.min(selected.programExercises.length, 6) - 1}
                />
              ))
          )}
        </DetailCard>
      </Reveal>

      <Reveal index={4}>
        <DetailCard title="Records" eyebrow="Saved history">
          {selected.records.length === 0 ? (
            <EmptyListItem
              icon="trophy-outline"
              title="No records yet"
              description="Finish loaded work for this muscle to unlock PRs and previous-set context."
            />
          ) : (
            selected.records.slice(0, 5).map((record, index) => (
              <View key={record.exerciseId}>
                <List.Item
                  title={record.name}
                  description={[
                    record.bestLoadKg != null
                      ? `Top ${record.bestLoadKg}kg x ${record.repsAtBestLoad ?? 0}`
                      : 'No loaded top set',
                    record.bestE1rmKg != null ? `e1RM ${record.bestE1rmKg.toFixed(1)}kg` : null,
                    `${record.lastSessionSets} sets last time`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  left={(props) => (
                    <List.Icon {...props} icon="medal-outline" color={colors.accent} />
                  )}
                  right={() => (
                    <Text
                      style={[typography.micro, { color: colors.textMuted, alignSelf: 'center' }]}
                    >
                      {record.lastPerformedAt ? formatDate(record.lastPerformedAt) : ''}
                    </Text>
                  )}
                  titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                  descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                />
                {index < Math.min(selected.records.length, 5) - 1 ? <Divider /> : null}
              </View>
            ))
          )}
        </DetailCard>
      </Reveal>
    </Animated.ScrollView>
  );
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

function DetailCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
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
        <View>
          <Text style={[typography.micro, { color: colors.accent }]}>{eyebrow}</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        {children}
      </Card.Content>
    </Card>
  );
}

function MetricBlock({ label, value, detail }: { label: string; value: string; detail: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metricBlock, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text numberOfLines={1} style={[typography.micro, { color: colors.textMuted }]}>
        {detail}
      </Text>
    </View>
  );
}

function ProgramExerciseItem({
  exercise,
  showDivider,
}: {
  exercise: MuscleProgramExercise;
  showDivider: boolean;
}) {
  const { colors, typography } = useTheme();

  return (
    <View>
      <List.Item
        title={exercise.name}
        description={`${exercise.dayName} · ${exercise.workingSets} x ${exercise.repRangeLabel} · RIR ${exercise.targetRir} · ${exercise.role}`}
        left={(props) => <List.Icon {...props} icon="dumbbell" color={colors.accent} />}
        titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
        descriptionStyle={[typography.caption, { color: colors.textMuted }]}
      />
      {showDivider ? <Divider /> : null}
    </View>
  );
}

function EmptyListItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  const { colors, typography } = useTheme();

  return (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon={icon} color={colors.accent} />}
      titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
      descriptionStyle={[typography.caption, { color: colors.textMuted }]}
      style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
    />
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
  return bodyIntensityForFatigue({
    score: item.fatigue.score,
    zone: item.fatigue.volume.zone,
    hasSignal: item.programExercises.length > 0 || item.records.length > 0,
  });
}

function muscleTone(item: MuscleIntelligence, colors: SemanticColors) {
  const fill = heatColorForFatigue(item.fatigue.score, item.fatigue.volume.zone);

  return {
    fill,
    subtleFill: withAlpha(
      fill,
      item.fatigue.score >= 48 ? 'BA' : item.fatigue.score >= 18 ? '82' : '58',
    ),
    stroke: item.rank.tier === 'S' ? RANK_TIER_COLORS.S : colors.textPrimary,
  };
}

function buildRankChartData(
  intelligence: MuscleIntelligence[],
  selectedMuscle: MuscleGroup,
  colors: SemanticColors,
): barDataItem[] {
  return intelligence
    .filter((item) => item.rank.topLoadKg != null)
    .sort(
      (a, b) =>
        (b.rank.topLoadKg ?? 0) - (a.rank.topLoadKg ?? 0) ||
        MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle]),
    )
    .slice(0, 6)
    .map((item) => ({
      value: item.rank.topLoadKg ?? 0,
      label: MUSCLE_LABELS[item.muscle].slice(0, 3),
      frontColor:
        item.muscle === selectedMuscle
          ? muscleTone(item, colors).fill
          : RANK_TIER_COLORS[item.rank.tier],
    }));
}

function rankLabel(rank: MuscleStrengthRank): string {
  if (rank.rank == null) return '--';
  return `#${rank.rank}`;
}

function rankDetail(rank: MuscleStrengthRank): string {
  if (rank.topLoadKg == null) return 'Unranked';
  return `${rank.topLoadKg}kg top set`;
}

function lastTrainedLabel(selected: MuscleIntelligence): string {
  if (!selected.fatigue.lastTrainedAt) return 'No direct session yet';
  if (selected.fatigue.lastTrainedDaysAgo === 0) return 'Trained today';
  if (selected.fatigue.lastTrainedDaysAgo === 1) return 'Trained yesterday';
  return `${selected.fatigue.lastTrainedDaysAgo} days since trained`;
}

function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
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
  bodyStage: {
    minHeight: 456,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    overflow: 'hidden',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBlock: {
    flex: 1,
    minHeight: 76,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  progress: {
    height: 7,
    borderRadius: 999,
  },
  heatLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: -4,
  },
  heatLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heatLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  fatigueMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartFrame: {
    width: '100%',
    height: 140,
    overflow: 'hidden',
  },
  listPanel: {
    borderRadius: 14,
  },
});
