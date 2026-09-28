import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Body from 'react-native-body-highlighter';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  IconButton,
  List,
  Menu,
  Portal,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/ui/Reveal';
import { InfoHint } from '@/components/ui/InfoHint';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  DetailCard,
  MetricBlock,
  ProgramExerciseRow,
  ProgressionCockpit,
  SwapPanel,
  VolumeRow,
} from '@/components/program/ProgramBlocks';
import { useTheme } from '@/theme';

import { formatEquipmentSummary, formatGoal } from '@/features/program/program.helpers';
import { useProgramScreen } from '@/features/program/useProgramScreen';

export default function ProgramScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    preferences,
    program,
    source,
    selectedDayIndex,
    setSelectedDayIndex,
    templates,
    swapTarget,
    setSwapTarget,
    saving,
    status,
    planMenuOpen,
    setPlanMenuOpen,
    resetDialogOpen,
    setResetDialogOpen,
    selectedDay,
    dayStats,
    muscleLoads,
    bodyData,
    progressionSummary,
    swapOptions,
    startDay,
    editDay,
    startTemplate,
    patchPrescription,
    movePrescription,
    replacePrescription,
    resetGeneratedProgram,
    saveSelectedDayAsTemplate,
  } = useProgramScreen();

  return (
    <ScrollView
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
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Your training plan
            </Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Plan</Text>
          </View>
          <Chip compact mode="flat" icon="calendar-week">
            {program.daysPerWeek}d/wk
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
            <View style={styles.activePlanHeader}>
              <View style={styles.activePlanTitle}>
                <Text style={[typography.micro, { color: colors.accent }]}>Active split</Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={2}>
                  {program.name}
                </Text>
              </View>
              <Chip
                compact
                mode="flat"
                icon={source === 'local' ? 'content-save-check' : 'auto-fix'}
              >
                {source === 'local' ? 'Edited' : 'Generated'}
              </Chip>
            </View>

            <View style={styles.metricGrid}>
              <MetricBlock label="days" value={String(program.days.length)} />
              <MetricBlock label="session" value={`${preferences.sessionMinutes}m`} />
              <MetricBlock label="goal" value={formatGoal(preferences.goal)} />
            </View>

            <View style={styles.chipRow}>
              {preferences.musclePriorities.length > 0 ? (
                preferences.musclePriorities.map((muscle) => (
                  <Chip key={muscle} compact mode="outlined">
                    {MUSCLE_LABELS[muscle]}
                  </Chip>
                ))
              ) : (
                <Chip compact mode="outlined">
                  Balanced week
                </Chip>
              )}
            </View>

            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Equipment: {formatEquipmentSummary(preferences.equipment)}
            </Text>

            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={3}>
              {program.rationale}
            </Text>

            <Divider />

            <View style={styles.planManagementHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                  Change plan
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted }]}>
                  Browse a split or build your own.
                </Text>
              </View>
              <Menu
                visible={planMenuOpen}
                onDismiss={() => setPlanMenuOpen(false)}
                anchor={
                  <IconButton
                    icon="dots-horizontal"
                    size={20}
                    disabled={saving}
                    accessibilityLabel="More plan actions"
                    onPress={() => setPlanMenuOpen(true)}
                    style={styles.planMenuButton}
                  />
                }
              >
                <Menu.Item
                  leadingIcon="restart"
                  title="Restore generated plan"
                  onPress={() => {
                    setPlanMenuOpen(false);
                    setResetDialogOpen(true);
                  }}
                />
              </Menu>
            </View>

            <View style={styles.planActionRow}>
              <Button
                style={styles.planAction}
                mode="outlined"
                icon="book-open-variant"
                disabled={saving}
                onPress={() => router.push('/program-library')}
              >
                Library
              </Button>
              <Button
                style={styles.planAction}
                mode="outlined"
                icon="playlist-plus"
                disabled={saving}
                onPress={() => router.push('/program-builder')}
              >
                Build
              </Button>
            </View>
            {status ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {status}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      </Reveal>

      <Portal>
        <Dialog visible={resetDialogOpen} onDismiss={() => setResetDialogOpen(false)}>
          <Dialog.Icon icon="restart-alert" />
          <Dialog.Title>Restore generated plan?</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Your edits to this plan will be replaced by the generated version.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetDialogOpen(false)}>Keep edits</Button>
            <Button textColor={colors.danger} onPress={resetGeneratedProgram} disabled={saving}>
              Restore
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Reveal index={2}>
        <DetailCard eyebrow="Saved workouts" title="Ready to replay">
          {templates.length === 0 ? (
            <List.Item
              title="No saved workouts yet"
              description="Build a custom workout and tap Save workout. It will appear here immediately."
              onPress={() => router.push('/custom-workout')}
              left={(props) => (
                <List.Icon {...props} icon="content-save-outline" color={colors.accent} />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
              )}
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={[styles.listPanel, { backgroundColor: colors.surfaceRaised }]}
            />
          ) : (
            templates.slice(0, 4).map((template, index) => (
              <View key={template.id}>
                <List.Item
                  title={template.name}
                  description={`${template.day.prescriptions.length} exercises · est. ${template.day.estimatedMinutes}m`}
                  onPress={() => startTemplate(template.id)}
                  left={(props) => (
                    <List.Icon {...props} icon="playlist-play" color={colors.accent} />
                  )}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />
                  )}
                  titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
                  descriptionStyle={[typography.caption, { color: colors.textMuted }]}
                />
                {index < Math.min(templates.length, 4) - 1 ? <Divider /> : null}
              </View>
            ))
          )}
        </DetailCard>
      </Reveal>

      <Reveal index={3}>
        <ProgressionCockpit summary={progressionSummary} units={preferences.units} />
      </Reveal>

      <Reveal index={4}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRail}
        >
          {program.days.map((day, index) => (
            <Chip
              key={day.id}
              compact
              selected={selectedDayIndex === index}
              mode={selectedDayIndex === index ? 'flat' : 'outlined'}
              onPress={() => setSelectedDayIndex(index)}
              style={
                selectedDayIndex === index ? { backgroundColor: colors.accentSoft } : undefined
              }
              textStyle={selectedDayIndex === index ? { color: colors.accent } : undefined}
            >
              {day.name}
            </Chip>
          ))}
        </ScrollView>
      </Reveal>

      <Reveal index={5}>
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
                <Text style={[typography.micro, { color: colors.accent }]}>Selected day</Text>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>
                  {selectedDay.name}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Button
                  compact
                  mode="outlined"
                  icon="content-save-outline"
                  disabled={saving}
                  onPress={saveSelectedDayAsTemplate}
                >
                  Template
                </Button>
                <Button compact mode="outlined" icon="pencil" onPress={() => editDay()}>
                  Edit
                </Button>
                <Button
                  compact
                  mode="outlined"
                  icon="playlist-plus"
                  onPress={() => router.push('/custom-workout')}
                >
                  Custom
                </Button>
                <Button mode="contained" icon="play" onPress={() => startDay()}>
                  Start
                </Button>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricBlock label="exercises" value={String(selectedDay.prescriptions.length)} />
              <MetricBlock label="sets" value={String(dayStats.sets)} />
              <MetricBlock label="est." value={`${selectedDay.estimatedMinutes}m`} />
            </View>

            <View style={styles.focusRow}>
              {selectedDay.focus.map((muscle) => (
                <Chip key={muscle} compact mode="flat">
                  {MUSCLE_LABELS[muscle]}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      </Reveal>

      <Reveal index={6}>
        <DetailCard eyebrow="Prescription" title="Exercise order">
          {selectedDay.prescriptions.map((prescription, index) => (
            <View key={`${prescription.exerciseId}-${index}`}>
              <ProgramExerciseRow
                prescription={prescription}
                index={index}
                saving={saving}
                swapOpen={
                  swapTarget?.dayIndex === selectedDayIndex &&
                  swapTarget.prescriptionIndex === index
                }
                onPatch={(patch) => patchPrescription(index, patch)}
                onMoveUp={index > 0 ? () => movePrescription(index, -1) : undefined}
                onMoveDown={
                  index < selectedDay.prescriptions.length - 1
                    ? () => movePrescription(index, 1)
                    : undefined
                }
                onSwap={() =>
                  setSwapTarget((current) =>
                    current?.dayIndex === selectedDayIndex && current.prescriptionIndex === index
                      ? null
                      : { dayIndex: selectedDayIndex, prescriptionIndex: index },
                  )
                }
              />
              {swapTarget?.dayIndex === selectedDayIndex &&
              swapTarget.prescriptionIndex === index ? (
                <SwapPanel
                  options={swapOptions}
                  saving={saving}
                  onSelect={replacePrescription}
                  onCancel={() => setSwapTarget(null)}
                />
              ) : null}
              {index < selectedDay.prescriptions.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </DetailCard>
      </Reveal>

      <Reveal index={7}>
        <DetailCard
          eyebrow="Weekly dose"
          title="Muscle volume"
          titleRight={<InfoHint term="volumeLandmarks" />}
        >
          <View style={styles.bodyRow}>
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="front"
              scale={0.34}
              border="none"
              defaultFill={colors.surfacePressed}
              defaultStroke={colors.border}
            />
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="back"
              scale={0.34}
              border="none"
              defaultFill={colors.surfacePressed}
              defaultStroke={colors.border}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            {muscleLoads.slice(0, 6).map((item) => (
              <VolumeRow key={item.muscle} item={item} />
            ))}
          </View>
        </DetailCard>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  activePlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activePlanTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planManagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planMenuButton: {
    margin: 0,
  },
  planActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planAction: {
    flex: 1,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBlock: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayRail: {
    gap: 8,
    paddingRight: 16,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  orderColumn: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 0,
  },
  orderMoveButton: {
    width: 28,
    height: 28,
    margin: 0,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  rowChipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepper: {
    minWidth: 76,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  stepperButton: {
    width: 28,
    height: 28,
    margin: 0,
  },
  swapButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  swapPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    marginBottom: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  volumeMeter: {
    width: 104,
    gap: 5,
  },
  progress: {
    height: 6,
    borderRadius: 999,
  },
  listPanel: {
    borderRadius: 14,
  },
  progressionHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  progressionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBadge: {
    minWidth: 72,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignItems: 'center',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyProgressionPanel: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
});
