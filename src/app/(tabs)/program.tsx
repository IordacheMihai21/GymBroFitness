import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Body from 'react-native-body-highlighter';
import { Button, Dialog, IconButton, Menu, Portal, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/ui/Reveal';
import { InfoHint } from '@/components/ui/InfoHint';
import { ListRow } from '@/components/ui/ListRow';
import { ExerciseStrip } from '@/components/home/ExerciseStrip';
import { DayCard } from '@/components/program/DayCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Tile } from '@/components/ui/Tile';
import { requireExercise } from '@/domain/exercises/catalog';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import {
  DetailCard,
  ProgramExerciseRow,
  ProgressionCockpit,
  SwapPanel,
  VolumeRow,
} from '@/components/program/ProgramBlocks';
import { inputTheme, useTheme } from '@/theme';

import { formatEquipmentSummary, formatGoal } from '@/features/program/program.helpers';
import { useProgramScreen } from '@/features/program/useProgramScreen';

type RenameTarget =
  | { kind: 'program'; name: string }
  | { kind: 'day'; name: string }
  | { kind: 'template'; id: string; name: string };

export default function ProgramScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
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
    renameActiveProgram,
    renameSelectedDay,
    renameSavedTemplate,
    patchPrescription,
    movePrescription,
    replacePrescription,
    resetGeneratedProgram,
    saveSelectedDayAsTemplate,
  } = useProgramScreen();

  async function saveRename() {
    if (!renameTarget?.name.trim()) return;
    if (renameTarget.kind === 'program') await renameActiveProgram(renameTarget.name);
    else if (renameTarget.kind === 'day') await renameSelectedDay(renameTarget.name);
    else await renameSavedTemplate(renameTarget.id, renameTarget.name);
    setRenameTarget(null);
  }

  const priorities =
    preferences.musclePriorities.length > 0
      ? preferences.musclePriorities.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')
      : 'Balanced week';

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
          <Pressable
            style={{ flex: 1, minWidth: 0 }}
            disabled={saving}
            onPress={() => setRenameTarget({ kind: 'program', name: program.name })}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${program.name}`}
          >
            <Text style={[typography.display, { color: colors.textPrimary }]}>Plan</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]} numberOfLines={1}>
              {program.name}, {program.daysPerWeek} days a week
              {source === 'local' ? ', edited' : ''}
            </Text>
          </Pressable>
          <Menu
            visible={planMenuOpen}
            onDismiss={() => setPlanMenuOpen(false)}
            anchor={
              <IconButton
                icon="dots-horizontal"
                iconColor={colors.textSecondary}
                disabled={saving}
                accessibilityLabel="More plan actions"
                onPress={() => setPlanMenuOpen(true)}
                style={styles.iconButton}
              />
            }
          >
            <Menu.Item
              leadingIcon="pencil-outline"
              title="Rename plan"
              onPress={() => {
                setPlanMenuOpen(false);
                setRenameTarget({ kind: 'program', name: program.name });
              }}
            />
            <Menu.Item
              leadingIcon="book-open-variant"
              title="Browse plans"
              onPress={() => {
                setPlanMenuOpen(false);
                router.push('/program-library');
              }}
            />
            <Menu.Item
              leadingIcon="playlist-plus"
              title="Build a plan"
              onPress={() => {
                setPlanMenuOpen(false);
                router.push('/program-builder');
              }}
            />
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
        {status ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}
          >
            {status}
          </Text>
        ) : null}
      </Reveal>

      <Portal>
        <Dialog visible={resetDialogOpen} onDismiss={() => setResetDialogOpen(false)}>
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
        <Dialog visible={renameTarget != null} onDismiss={() => setRenameTarget(null)}>
          <Dialog.Title>
            {renameTarget?.kind === 'program'
              ? 'Rename plan'
              : renameTarget?.kind === 'day'
                ? 'Rename day'
                : 'Rename workout'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              theme={inputTheme}
              autoFocus
              mode="outlined"
              label="Name"
              value={renameTarget?.name ?? ''}
              onChangeText={(name) =>
                setRenameTarget((current) => (current ? { ...current, name } : null))
              }
              returnKeyType="done"
              onSubmitEditing={() => void saveRename()}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameTarget(null)}>Cancel</Button>
            <Button
              mode="contained"
              loading={saving}
              disabled={saving || !renameTarget?.name.trim()}
              onPress={() => void saveRename()}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Reveal index={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRail}
          style={{ marginHorizontal: -spacing.lg }}
        >
          <View style={{ width: spacing.lg - 10 }} />
          {program.days.map((day, index) => (
            <DayCard
              key={day.id}
              day={day}
              index={index}
              selected={selectedDayIndex === index}
              onPress={() => setSelectedDayIndex(index)}
            />
          ))}
          <View style={{ width: spacing.lg - 10 }} />
        </ScrollView>
      </Reveal>

      <Reveal index={2}>
        <Tile glow style={{ gap: spacing.lg }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[typography.title, { color: colors.textPrimary }]}>
                {selectedDay.name}
              </Text>
              {selectedDay.focus.length > 0 ? (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {selectedDay.focus.map((muscle) => MUSCLE_LABELS[muscle]).join(', ')}
                </Text>
              ) : null}
            </View>
            <IconButton
              icon="pencil-outline"
              iconColor={colors.textSecondary}
              disabled={saving}
              accessibilityLabel={`Rename ${selectedDay.name}`}
              onPress={() => setRenameTarget({ kind: 'day', name: selectedDay.name })}
              style={styles.iconButton}
            />
          </View>
          <View style={styles.heroStats}>
            <PlanStat value={String(selectedDay.prescriptions.length)} label="exercises" />
            <PlanStat value={String(dayStats.sets)} label="sets" />
            <PlanStat value={`~${selectedDay.estimatedMinutes}`} label="min" />
          </View>
          <ExerciseStrip
            items={selectedDay.prescriptions.map((prescription, index) => ({
              key: `${prescription.exerciseId}-${index}`,
              exercise: requireExercise(prescription.exerciseId),
              detail: `${prescription.workingSets} × ${prescription.minReps}-${prescription.maxReps}`,
            }))}
            onPressItem={(exercise) =>
              router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })
            }
          />
          <View style={{ gap: spacing.xs }}>
            <Button
              mode="contained"
              onPress={() => startDay()}
              contentStyle={styles.primaryActionContent}
            >
              Start {selectedDay.name}
            </Button>
            <View style={styles.secondaryActionRow}>
              <Button compact mode="text" onPress={() => editDay()}>
                Edit before starting
              </Button>
              <Button
                compact
                mode="text"
                disabled={saving}
                onPress={saveSelectedDayAsTemplate}
                textColor={colors.textSecondary}
              >
                Save as workout
              </Button>
            </View>
          </View>
        </Tile>
      </Reveal>

      <Reveal index={3}>
        <Tile title="Exercises">
          <View>
            {selectedDay.prescriptions.map((prescription, index) => (
              <View
                key={`${prescription.exerciseId}-${index}`}
                style={{
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                }}
              >
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
              </View>
            ))}
          </View>
        </Tile>
      </Reveal>

      <Reveal index={4}>
        <DetailCard
          title="Saved workouts"
          titleRight={
            <Button compact mode="text" onPress={() => router.push('/custom-workout')}>
              New
            </Button>
          }
        >
          {templates.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Build a custom workout and tap Save workout. It shows up here so you can repeat it.
            </Text>
          ) : (
            <View>
              {templates.slice(0, 4).map((template, index, shown) => (
                <ListRow
                  key={template.id}
                  title={template.name}
                  subtitle={`${template.day.prescriptions.length} exercises, about ${template.day.estimatedMinutes} min`}
                  onPress={() => startTemplate(template.id)}
                  last={index === shown.length - 1}
                  accessibilityLabel={`Start ${template.name}`}
                  left={
                    <IconButton
                      icon="pencil-outline"
                      size={18}
                      iconColor={colors.textMuted}
                      disabled={saving}
                      accessibilityLabel={`Rename ${template.name}`}
                      onPress={() =>
                        setRenameTarget({ kind: 'template', id: template.id, name: template.name })
                      }
                      style={styles.templateRename}
                    />
                  }
                />
              ))}
            </View>
          )}
        </DetailCard>
      </Reveal>

      <Reveal index={5}>
        <ProgressionCockpit summary={progressionSummary} units={preferences.units} />
      </Reveal>

      <Reveal index={6}>
        <DetailCard title="Weekly volume" titleRight={<InfoHint term="volumeLandmarks" />}>
          <View style={styles.bodyRow}>
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="front"
              scale={0.34}
              border="none"
              defaultFill={colors.surfaceRaised}
              defaultStroke={colors.border}
            />
            <Body
              data={bodyData}
              colors={[`${colors.accent}77`, colors.accent]}
              side="back"
              scale={0.34}
              border="none"
              defaultFill={colors.surfaceRaised}
              defaultStroke={colors.border}
            />
          </View>

          <View style={{ gap: spacing.md }}>
            {muscleLoads.slice(0, 6).map((item) => (
              <VolumeRow key={item.muscle} item={item} />
            ))}
          </View>
        </DetailCard>
      </Reveal>

      <Reveal index={7}>
        <DetailCard title="About this plan">
          <View>
            <ListRow title="Goal" value={formatGoal(preferences.goal)} />
            <ListRow title="Session length" value={`${preferences.sessionMinutes} min`} />
            <ListRow title="Priorities" subtitle={priorities} />
            <ListRow
              title="Equipment"
              subtitle={formatEquipmentSummary(preferences.equipment)}
              last
            />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{program.rationale}</Text>
        </DetailCard>
      </Reveal>
    </ScrollView>
  );
}

function PlanStat({ value, label }: { value: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AnimatedNumber
        value={value}
        style={[typography.jumbo, { color: colors.textPrimary, fontSize: 26, lineHeight: 30 }]}
      />
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    margin: 0,
  },
  dayRail: {
    gap: 10,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryActionContent: {
    minHeight: 52,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  templateRename: {
    width: 36,
    height: 36,
    margin: 0,
    marginLeft: -8,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
});
