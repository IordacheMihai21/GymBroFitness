import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, Dialog, IconButton, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow } from '@/components/ui/ListRow';
import { Pill } from '@/components/ui/Pill';
import { Stat } from '@/components/ui/Stat';
import { MUSCLE_LABELS } from '@/constants/muscleLabels';
import { requireExercise } from '@/domain/exercises/catalog';
import {
  buildProgramFromLibraryTemplate,
  getProgramLibraryTemplate,
  listProgramLibraryTemplates,
  templateWeeklySetCount,
  type ProgramLibraryCategory,
  type ProgramLibraryTemplate,
} from '@/domain/programs/programLibrary';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useBackDestination } from '@/hooks/useBackDestination';
import { useTheme } from '@/theme';
import type { ProgramDay, TrainingProgram } from '@/types';

type LibraryFilter = 'all' | ProgramLibraryCategory;

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upper_lower', label: 'Upper/Lower' },
  { id: 'ppl', label: 'Push Pull Legs' },
  { id: 'full_body', label: 'Full body' },
  { id: 'powerbuilding', label: 'Powerbuilding' },
  { id: 'specialization', label: 'Specialization' },
];

export default function ProgramLibraryScreen() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const backToProgram = useBackDestination('/program');
  const { user, preferences, program, saveProgram } = useActiveProgram();
  const templates = useMemo(() => listProgramLibraryTemplates(preferences), [preferences]);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.id ?? 'upper-lower-hypertrophy-4',
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const filteredTemplates = useMemo(
    () => templates.filter((template) => filter === 'all' || template.category === filter),
    [filter, templates],
  );
  const selectedTemplate =
    getProgramLibraryTemplate(selectedTemplateId) ?? filteredTemplates[0] ?? templates[0];
  const previewProgram = useMemo(
    () =>
      buildProgramFromLibraryTemplate(selectedTemplate.id, {
        userId: user.id,
        preferences,
        now: '2026-09-15T00:00:00.000Z',
      }),
    [preferences, selectedTemplate.id, user.id],
  );
  const replacedCount = useMemo(
    () => countEquipmentSwaps(selectedTemplate, previewProgram),
    [previewProgram, selectedTemplate],
  );

  async function setActiveProgram() {
    setSaving(true);
    setStatus(null);
    try {
      const next = buildProgramFromLibraryTemplate(selectedTemplate.id, {
        userId: user.id,
        preferences,
      });
      await saveProgram(next);
      setConfirming(false);
      backToProgram();
    } catch {
      setStatus('Could not import this program.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <View>
        <IconButton
          icon="chevron-left"
          iconColor={colors.textPrimary}
          accessibilityLabel="Back to plan"
          onPress={backToProgram}
          style={styles.backButton}
        />
        <Text style={[typography.display, { color: colors.textPrimary }]}>Browse plans</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {templates.length} plans, adapted to your equipment
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRail}
        >
          {FILTERS.map((item) => (
            <Pill
              key={item.id}
              label={item.label}
              active={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </ScrollView>

        <View>
          {filteredTemplates.map((template, index) => (
            <TemplateTile
              key={template.id}
              template={template}
              selected={template.id === selectedTemplate.id}
              onSelect={() => setSelectedTemplateId(template.id)}
              last={index === filteredTemplates.length - 1}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>
            {selectedTemplate.name}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {selectedTemplate.description}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <Stat value={String(selectedTemplate.daysPerWeek)} label="days a week" />
          <Stat value={String(templateWeeklySetCount(selectedTemplate))} label="sets a week" />
          <Stat value={formatLevel(selectedTemplate.level)} label="level" />
        </View>

        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatGoal(selectedTemplate.goal)}. Emphasis on{' '}
          {selectedTemplate.emphasis
            .slice(0, 5)
            .map((muscle) => MUSCLE_LABELS[muscle].toLowerCase())
            .join(', ')}
          .{' '}
          {replacedCount === 0
            ? 'Every exercise fits your equipment.'
            : `${replacedCount} ${replacedCount === 1 ? 'exercise is' : 'exercises are'} swapped to fit your equipment.`}
        </Text>

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          {previewProgram.days.map((day, index) => (
            <ProgramDayPreview
              key={day.id}
              day={day}
              last={index === previewProgram.days.length - 1}
            />
          ))}
        </View>

        {status ? (
          <Text style={[typography.caption, { color: colors.warning }]}>{status}</Text>
        ) : null}
      </View>

      <Button
        mode="contained"
        loading={saving}
        disabled={saving}
        onPress={() => setConfirming(true)}
        contentStyle={styles.primaryContent}
      >
        Use this plan
      </Button>

      <Portal>
        <Dialog visible={confirming} onDismiss={() => !saving && setConfirming(false)}>
          <Dialog.Title>Switch to {selectedTemplate.name}?</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.md }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              This replaces {program.name} for future workouts. Your history, records, saved
              workouts and any workout in progress stay as they are.
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {selectedTemplate.daysPerWeek} days a week, {templateWeeklySetCount(selectedTemplate)}{' '}
              sets a week.{' '}
              {replacedCount === 0
                ? 'No equipment swaps.'
                : `${replacedCount} equipment ${replacedCount === 1 ? 'swap' : 'swaps'}.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(false)} disabled={saving}>
              Keep current plan
            </Button>
            <Button onPress={setActiveProgram} loading={saving} disabled={saving}>
              Switch plan
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Animated.ScrollView>
  );
}

function TemplateTile({
  template,
  selected,
  onSelect,
  last,
}: {
  template: ProgramLibraryTemplate;
  selected: boolean;
  onSelect: () => void;
  last: boolean;
}) {
  const { colors, typography } = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{template.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
          {template.daysPerWeek} days, {template.level}. {template.subtitle}
        </Text>
      </View>
      <MaterialCommunityIcons
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={22}
        color={selected ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

function ProgramDayPreview({ day, last }: { day: ProgramDay; last: boolean }) {
  const sets = day.prescriptions.reduce((sum, prescription) => sum + prescription.workingSets, 0);

  return (
    <ListRow
      title={day.name}
      subtitle={`${day.prescriptions.length} exercises, ${sets} sets, about ${day.estimatedMinutes} min. ${formatExerciseNames(day)}`}
      last={last}
    />
  );
}

function countEquipmentSwaps(template: ProgramLibraryTemplate, program: TrainingProgram): number {
  return template.days.reduce((total, day, dayIndex) => {
    const programDay = program.days[dayIndex];
    if (!programDay) return total;
    return (
      total +
      day.prescriptions.filter(
        (prescription, index) =>
          programDay.prescriptions[index]?.exerciseId !== prescription.exerciseId,
      ).length
    );
  }, 0);
}

function formatExerciseNames(day: ProgramDay): string {
  return day.prescriptions
    .slice(0, 4)
    .map((prescription) => requireExercise(prescription.exerciseId).name)
    .join(', ');
}

function formatLevel(level: ProgramLibraryTemplate['level']): string {
  return `${level[0].toUpperCase()}${level.slice(1)}`;
}

function formatGoal(goal: ProgramLibraryTemplate['goal']): string {
  if (goal === 'hypertrophy') return 'Build muscle';
  if (goal === 'strength') return 'Strength';
  return 'Strength + muscle';
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: -12,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  chipRail: {
    gap: 8,
    paddingRight: 16,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
  },
  primaryContent: {
    minHeight: 52,
  },
});
