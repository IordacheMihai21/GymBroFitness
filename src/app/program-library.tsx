import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  IconButton,
  List,
  Portal,
  ProgressBar,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { useTheme } from '@/theme';
import type { ProgramDay, TrainingProgram } from '@/types';

type LibraryFilter = 'all' | ProgramLibraryCategory;

const FILTERS: { id: LibraryFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'view-grid-outline' },
  { id: 'upper_lower', label: 'Upper / Lower', icon: 'swap-vertical' },
  { id: 'ppl', label: 'PPL', icon: 'calendar-repeat' },
  { id: 'full_body', label: 'Full Body', icon: 'human' },
  { id: 'powerbuilding', label: 'Powerbuilding', icon: 'weight-lifter' },
  { id: 'specialization', label: 'Specialize', icon: 'target' },
];

export default function ProgramLibraryScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      router.replace('/program');
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
        paddingTop: Math.max(insets.top, spacing.xxl) + spacing.md,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View style={styles.headerRow}>
        <IconButton
          mode="contained-tonal"
          icon="arrow-left"
          accessibilityLabel="Back to program"
          onPress={() => router.back()}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Program systems</Text>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Library</Text>
        </View>
        <Chip compact mode="flat" icon="dumbbell">
          {templates.length}
        </Chip>
      </View>

      <Card
        mode="contained"
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderStrong,
            borderRadius: radius.xl,
          },
        ]}
      >
        <Card.Content style={{ gap: spacing.md }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.micro, { color: colors.accent }]}>Matched pick</Text>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                {selectedTemplate.name}
              </Text>
            </View>
            <Chip compact mode="flat" icon="calendar-week">
              {selectedTemplate.daysPerWeek}d/wk
            </Chip>
            <Chip compact mode="outlined" icon="target">
              {formatGoal(selectedTemplate.goal)}
            </Chip>
          </View>

          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {selectedTemplate.description}
          </Text>

          <View style={styles.metricGrid}>
            <Metric label="days" value={String(selectedTemplate.daysPerWeek)} />
            <Metric label="sets/wk" value={String(templateWeeklySetCount(selectedTemplate))} />
            <Metric label="swaps" value={String(replacedCount)} />
          </View>

          <View style={styles.chipRow}>
            {selectedTemplate.emphasis.slice(0, 5).map((muscle) => (
              <Chip key={muscle} compact mode="outlined">
                {MUSCLE_LABELS[muscle]}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRail}
      >
        {FILTERS.map((item) => (
          <Chip
            key={item.id}
            compact
            icon={item.icon}
            selected={filter === item.id}
            mode={filter === item.id ? 'flat' : 'outlined'}
            onPress={() => setFilter(item.id)}
            style={filter === item.id ? { backgroundColor: colors.accentSoft } : undefined}
            textStyle={filter === item.id ? { color: colors.accent } : undefined}
          >
            {item.label}
          </Chip>
        ))}
      </ScrollView>

      <View style={styles.templateStack}>
        {filteredTemplates.map((template) => (
          <TemplateTile
            key={template.id}
            template={template}
            selected={template.id === selectedTemplate.id}
            onSelect={() => setSelectedTemplateId(template.id)}
          />
        ))}
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
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.micro, { color: colors.accent }]}>Preview</Text>
              <Text style={[typography.subheading, { color: colors.textPrimary }]}>
                Weekly structure
              </Text>
            </View>
            <Chip compact mode="outlined" icon="tune-variant">
              {formatLevel(selectedTemplate.level)}
            </Chip>
          </View>

          <View
            style={[
              styles.sourcePanel,
              { backgroundColor: colors.surfaceRaised, padding: spacing.md },
            ]}
          >
            <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
              {selectedTemplate.subtitle}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {replacedCount === 0
                ? 'Every exercise matches your available equipment.'
                : `${replacedCount} exercise${replacedCount === 1 ? '' : 's'} will be substituted for your equipment or exclusions.`}
            </Text>
            <View style={styles.chipRow}>
              {selectedTemplate.tags.map((tag) => (
                <Chip key={tag} compact mode="outlined">
                  {tag}
                </Chip>
              ))}
            </View>
          </View>

          {previewProgram.days.map((day, index) => (
            <View key={day.id}>
              <ProgramDayPreview day={day} index={index} />
              {index < previewProgram.days.length - 1 ? <Divider /> : null}
            </View>
          ))}

          {status ? (
            <Text style={[typography.captionBold, { color: colors.warning }]}>{status}</Text>
          ) : null}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="clipboard-check-outline"
        loading={saving}
        disabled={saving}
        onPress={() => setConfirming(true)}
      >
        Review activation
      </Button>

      <Portal>
        <Dialog visible={confirming} onDismiss={() => !saving && setConfirming(false)}>
          <Dialog.Title>Activate {selectedTemplate.name}?</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.md }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              This replaces the active plan “{program.name}” for future workouts. Completed workout
              history, personal records, saved templates and any active workout draft stay intact.
            </Text>
            <View style={[styles.impactPanel, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
                {selectedTemplate.daysPerWeek} days · {formatGoal(selectedTemplate.goal)} ·{' '}
                {templateWeeklySetCount(selectedTemplate)} prescribed sets/week
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {replacedCount === 0
                  ? 'No equipment substitutions.'
                  : `${replacedCount} equipment-based substitution${replacedCount === 1 ? '' : 's'} shown in the preview.`}
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(false)} disabled={saving}>
              Keep current plan
            </Button>
            <Button onPress={setActiveProgram} loading={saving} disabled={saving}>
              Activate previewed plan
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
}: {
  template: ProgramLibraryTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Card
      mode="contained"
      onPress={onSelect}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              {template.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {template.subtitle}
            </Text>
          </View>
          <IconButton
            mode={selected ? 'contained' : 'contained-tonal'}
            icon={selected ? 'check' : 'chevron-right'}
            size={18}
            onPress={onSelect}
          />
        </View>

        <View style={styles.tileFooter}>
          <Chip compact mode="flat" icon="calendar-week">
            {template.daysPerWeek} days
          </Chip>
          <Chip compact mode="outlined" icon="signal">
            {formatLevel(template.level)}
          </Chip>
        </View>

        <ProgressBar
          progress={template.daysPerWeek / 6}
          color={colors.accent}
          style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
        />
      </Card.Content>
    </Card>
  );
}

function ProgramDayPreview({ day, index }: { day: ProgramDay; index: number }) {
  const { colors, typography } = useTheme();
  const sets = day.prescriptions.reduce((sum, prescription) => sum + prescription.workingSets, 0);

  return (
    <List.Item
      title={day.name}
      description={`${day.prescriptions.length} exercises · ${sets} sets · ${day.estimatedMinutes}m · ${formatExerciseNames(day)}`}
      left={(props) => (
        <List.Icon
          {...props}
          icon={index === 0 ? 'star-four-points' : 'playlist-play'}
          color={colors.accent}
        />
      )}
      right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
      titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
      descriptionStyle={[typography.caption, { color: colors.textMuted }]}
      descriptionNumberOfLines={2}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metric, { backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
    </View>
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
    .join(' / ');
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRail: {
    gap: 8,
    paddingRight: 16,
  },
  templateStack: {
    gap: 10,
  },
  tileFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progress: {
    height: 5,
    borderRadius: 999,
  },
  sourcePanel: {
    borderRadius: 14,
    gap: 4,
  },
  impactPanel: {
    borderRadius: 14,
    gap: 6,
    padding: 12,
  },
});
