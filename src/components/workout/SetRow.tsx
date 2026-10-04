import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Divider, IconButton, Menu, TextInput } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { durations, easeOutExpo, popSpring } from '@/components/ui/motion';

import { formatPlateBreakdown, plateBreakdown } from '@/domain/workouts/plateMath';
import { formatRir } from '@/domain/workouts/rir';
import { fonts, inputTheme, MIN_TOUCH_TARGET, useTheme } from '@/theme';
import type {
  EquipmentType,
  PerformedSet,
  SetKind,
  SetTechnique,
  SubEffort,
  TrackingType,
  Units,
} from '@/types';
import { displayLoad, loadInputToKg, parseDecimalInput, unitLabel } from '@/utils/units';

/** Equipment where a barbell/EZ bar is actually loaded with plates. */
const PLATE_LOADED_EQUIPMENT: Partial<Record<EquipmentType, Record<Units, number>>> = {
  barbell: { kg: 20, lb: 45 },
  smith_machine: { kg: 20, lb: 45 },
  ez_bar: { kg: 10, lb: 25 },
};

const TECHNIQUES: SetTechnique[] = [
  'standard',
  'drop_set',
  'rest_pause',
  'myo_reps',
  'cluster_set',
  'top_backoff',
];

const TECHNIQUE_LABELS: Record<SetTechnique, string> = {
  standard: 'Standard',
  drop_set: 'Drop set',
  rest_pause: 'Rest-pause',
  myo_reps: 'Myo-reps',
  cluster_set: 'Cluster set',
  top_backoff: 'Top + backoff',
};

const TECHNIQUE_ADD_LABEL: Record<SetTechnique, string> = {
  standard: 'Add effort',
  drop_set: 'Add drop',
  rest_pause: 'Add cluster',
  myo_reps: 'Add cluster',
  cluster_set: 'Add cluster',
  top_backoff: 'Add backoff',
};

const SET_KINDS: SetKind[] = ['working', 'warmup', 'failure'];

const SET_KIND_LABELS: Record<SetKind, string> = {
  working: 'Working set',
  warmup: 'Warm-up set',
  failure: 'To failure',
};

/** Short badge text for a non-default set kind; omitted entirely for 'working'. */
const SET_KIND_BADGE: Partial<Record<SetKind, string>> = {
  warmup: 'Warm-up',
  failure: 'Failure',
};

type SetRowProps = {
  set: PerformedSet;
  targetLabel: string;
  onChange: (patch: Partial<PerformedSet>) => void;
  onToggleComplete: () => void;
  onCopyPrevious?: () => void;
  onCopyToRemaining?: () => void;
  onToggleSkip?: () => void;
  /** Exercise equipment tags; used to show a live plate-math breakdown. */
  equipment?: EquipmentType[];
  /** "Last: 100 kg × 8 @ RIR 2" from the most recent session that trained this exercise. */
  previousLabel?: string | null;
  /** Opens the RIR wheel picker for this set. */
  onOpenRirPicker: () => void;
  /** Locks every interactive control while the workout is paused. */
  disabled?: boolean;
  trackingType: TrackingType;
  units: Units;
  validationError?: string | null;
  /** Completes this row and advances focus to the next open set. */
  onSubmitEditing?: () => void;
};

export type SetRowHandle = {
  focusPrimaryInput: () => void;
};

type FocusableInput = { focus: () => void };

export const SetRow = forwardRef<SetRowHandle, SetRowProps>(function SetRow(
  {
    set,
    targetLabel,
    onChange,
    onToggleComplete,
    onCopyPrevious,
    onCopyToRemaining,
    onToggleSkip,
    equipment,
    previousLabel,
    onOpenRirPicker,
    disabled = false,
    trackingType,
    units,
    validationError,
    onSubmitEditing,
  },
  ref,
) {
  const { colors, radius, spacing, typography } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const loadInputRef = useRef<FocusableInput | null>(null);
  const resultInputRef = useRef<FocusableInput | null>(null);
  const reduceMotion = useReducedMotion();
  // Completion sweep: the row fills with the success tint from left to right
  // while the check pops, so ticking a set feels like racking the bar.
  const completion = useSharedValue(set.completed ? 1 : 0);
  const checkScale = useSharedValue(1);
  const wasCompleted = useRef(set.completed);

  useEffect(() => {
    if (wasCompleted.current === set.completed) return;
    wasCompleted.current = set.completed;
    if (reduceMotion) {
      completion.value = set.completed ? 1 : 0;
      return;
    }
    completion.value = withTiming(set.completed ? 1 : 0, {
      duration: set.completed ? durations.slow : durations.fast,
      easing: easeOutExpo,
    });
    if (set.completed) {
      checkScale.value = withSequence(withTiming(0.78, { duration: 90 }), withSpring(1, popSpring));
    }
  }, [checkScale, completion, reduceMotion, set.completed]);

  const technique = set.technique ?? 'standard';
  const subEfforts = set.subEfforts ?? [];
  const isLocked = disabled || set.completed || set.skipped;
  const menuLocked = disabled || set.completed;

  const barWeight = equipment
    ?.map((item) => PLATE_LOADED_EQUIPMENT[item]?.[units])
    .find((value): value is number => value != null);
  const plates =
    barWeight != null && set.loadKg != null && set.loadKg > 0
      ? plateBreakdown(displayLoad(set.loadKg, units) ?? 0, units, { barWeight })
      : null;
  const supportsLoad = trackingType === 'weight_reps' || trackingType === 'weighted_bodyweight';
  const supportsReps = trackingType !== 'time';
  const supportsTechniques =
    trackingType === 'weight_reps' || trackingType === 'weighted_bodyweight';
  const hasSetActions = Boolean(onCopyPrevious || onCopyToRemaining || onToggleSkip);

  useImperativeHandle(
    ref,
    () => ({
      focusPrimaryInput() {
        (supportsLoad ? loadInputRef : resultInputRef).current?.focus();
      },
    }),
    [supportsLoad],
  );

  function selectTechnique(next: SetTechnique) {
    setMenuVisible(false);
    onChange({ technique: next, subEfforts: next === 'standard' ? [] : subEfforts });
  }

  function selectKind(next: SetKind) {
    setMenuVisible(false);
    onChange(next === 'failure' ? { kind: next, rir: 0 } : { kind: next });
  }

  function addSubEffort() {
    const next: SubEffort = { loadKg: set.loadKg, reps: null, restSeconds: 0 };
    onChange({ subEfforts: [...subEfforts, next] });
  }

  function updateSubEffort(index: number, patch: Partial<SubEffort>) {
    onChange({ subEfforts: subEfforts.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
  }

  function removeSubEffort(index: number) {
    onChange({ subEfforts: subEfforts.filter((_, i) => i !== index) });
  }

  function copyPrevious() {
    setMenuVisible(false);
    onCopyPrevious?.();
  }

  const kindLabel = SET_KIND_BADGE[set.kind];

  const sweepStyle = useAnimatedStyle(() => ({
    width: `${completion.value * 100}%`,
    opacity: Math.min(1, completion.value * 1.6),
  }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const tags = [kindLabel, technique !== 'standard' ? TECHNIQUE_LABELS[technique] : null].filter(
    (tag): tag is string => tag != null,
  );

  return (
    <View
      style={[
        styles.row,
        {
          borderRadius: radius.lg,
          borderColor: set.completed ? 'transparent' : colors.border,
          paddingHorizontal: spacing.sm,
          marginHorizontal: -spacing.sm,
          opacity: set.skipped ? 0.6 : 1,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.successSoft, borderRadius: radius.lg },
          sweepStyle,
        ]}
      />
      <View style={styles.rowHeader}>
        <Text
          style={[
            typography.numeric,
            styles.setNumber,
            { color: set.completed ? colors.success : colors.textMuted },
          ]}
        >
          {set.setNumber}
        </Text>
        <View style={styles.setMeta}>
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {previousLabel ?? 'No previous set'}
          </Text>
          {tags.length > 0 ? (
            <Text
              style={[
                typography.captionBold,
                { color: set.kind === 'failure' ? colors.warning : colors.accent },
              ]}
              numberOfLines={1}
            >
              {tags.join(', ')}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionGroup}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-horizontal"
                size={18}
                iconColor={colors.textMuted}
                onPress={() => setMenuVisible(true)}
                disabled={menuLocked}
                accessibilityLabel={`Set ${set.setNumber} options`}
                accessibilityState={{ expanded: menuVisible }}
                style={styles.compactButton}
              />
            }
          >
            {onCopyPrevious ? (
              <Menu.Item
                onPress={copyPrevious}
                title="Copy previous set"
                leadingIcon="content-copy"
              />
            ) : null}
            {onCopyToRemaining ? (
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  onCopyToRemaining();
                }}
                title="Apply to remaining sets"
                leadingIcon="playlist-edit"
                disabled={set.skipped}
              />
            ) : null}
            {onToggleSkip ? (
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  onToggleSkip();
                }}
                title={set.skipped ? 'Restore set' : 'Skip set'}
                leadingIcon={set.skipped ? 'backup-restore' : 'skip-next-outline'}
              />
            ) : null}
            {hasSetActions ? <Divider /> : null}
            {SET_KINDS.map((item) => (
              <Menu.Item
                key={item}
                onPress={() => selectKind(item)}
                title={SET_KIND_LABELS[item]}
                leadingIcon={item === set.kind ? 'check' : undefined}
                disabled={set.skipped}
              />
            ))}
            {supportsTechniques ? <Divider /> : null}
            {supportsTechniques
              ? TECHNIQUES.map((item) => (
                  <Menu.Item
                    key={item}
                    onPress={() => selectTechnique(item)}
                    title={TECHNIQUE_LABELS[item]}
                    leadingIcon={item === technique ? 'check' : undefined}
                    disabled={set.skipped}
                  />
                ))
              : null}
          </Menu>

          <Animated.View style={checkStyle}>
            <IconButton
              icon={set.skipped ? 'skip-next-outline' : 'check'}
              mode={set.completed ? 'contained' : 'contained-tonal'}
              containerColor={set.completed ? colors.success : colors.surfaceRaised}
              iconColor={set.completed ? colors.onAccent : colors.textSecondary}
              size={20}
              onPress={onToggleComplete}
              disabled={disabled || set.skipped}
              accessibilityLabel={
                set.completed
                  ? `Mark set ${set.setNumber} incomplete`
                  : `Mark set ${set.setNumber} complete, target ${targetLabel}`
              }
              style={styles.compactButton}
            />
          </Animated.View>
        </View>
      </View>

      {set.skipped ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Skipped. Not counted in progression or volume.
        </Text>
      ) : null}

      {!set.skipped ? (
        <View style={styles.inputGroup}>
          {supportsLoad ? (
            <TextInput
              theme={inputTheme}
              ref={(instance: FocusableInput | null) => {
                loadInputRef.current = instance;
              }}
              mode="outlined"
              dense
              label={
                trackingType === 'weighted_bodyweight'
                  ? `extra ${unitLabel(units)}`
                  : unitLabel(units)
              }
              value={set.loadKg != null ? String(displayLoad(set.loadKg, units)) : ''}
              onChangeText={(text) => onChange({ loadKg: loadInputToKg(text, units) })}
              keyboardType="decimal-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => resultInputRef.current?.focus()}
              editable={!isLocked}
              style={[styles.input, { backgroundColor: colors.background }]}
              contentStyle={styles.inputContent}
            />
          ) : null}
          {supportsReps ? (
            <TextInput
              theme={inputTheme}
              ref={(instance: FocusableInput | null) => {
                resultInputRef.current = instance;
              }}
              mode="outlined"
              dense
              label="reps"
              value={set.reps != null ? String(set.reps) : ''}
              onChangeText={(text) => onChange({ reps: parseDecimalInput(text) })}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={onSubmitEditing}
              editable={!isLocked}
              style={[styles.input, { backgroundColor: colors.background }]}
              contentStyle={styles.inputContent}
            />
          ) : (
            <TextInput
              theme={inputTheme}
              ref={(instance: FocusableInput | null) => {
                resultInputRef.current = instance;
              }}
              mode="outlined"
              dense
              label="seconds"
              value={set.durationSeconds != null ? String(set.durationSeconds) : ''}
              onChangeText={(text) => onChange({ durationSeconds: parseDecimalInput(text) })}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={onSubmitEditing}
              editable={!isLocked}
              style={[styles.input, { backgroundColor: colors.background }]}
              contentStyle={styles.inputContent}
            />
          )}
          <Pressable
            onPress={onOpenRirPicker}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel={`RIR for set ${set.setNumber}: ${set.rir != null ? formatRir(set.rir) : 'not set'}`}
            style={[
              styles.rirButton,
              {
                borderColor: colors.borderStrong,
                borderRadius: radius.md,
                backgroundColor: colors.background,
                opacity: isLocked ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[typography.micro, { color: colors.textMuted }]}>RIR</Text>
            <Text style={[typography.numeric, { color: colors.textPrimary }]}>
              {set.rir != null ? formatRir(set.rir) : '-'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {plates ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Per side: {formatPlateBreakdown(plates)}
          {!plates.exact ? `, closest is ${plates.achievedWeight} ${unitLabel(units)}` : ''}
        </Text>
      ) : null}

      {set.formAnalysis ? (
        <View style={{ gap: 2 }}>
          <Text style={[typography.captionBold, { color: colors.success }]}>
            Form AI {set.formAnalysis.averageScore}/100, ROM {set.formAnalysis.averageRomScore},
            tempo {set.formAnalysis.averageTempoScore}
            {set.formAnalysis.velocityLossPct != null
              ? `, velocity loss ${Math.round(set.formAnalysis.velocityLossPct)}%`
              : ''}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>
            {set.formAnalysis.mostCommonIssue ??
              set.formAnalysis.recommendations[0] ??
              'Clean set. Keep this as your baseline.'}
          </Text>
        </View>
      ) : null}

      {supportsTechniques && technique !== 'standard' ? (
        <View style={[styles.subEffortPanel, { borderColor: colors.border }]}>
          {subEfforts.map((effort, index) => (
            <View key={index} style={styles.subEffortRow}>
              <Text
                style={[typography.numeric, { color: colors.textMuted, width: 18, fontSize: 13 }]}
              >
                {index + 1}
              </Text>
              <TextInput
                theme={inputTheme}
                mode="outlined"
                dense
                label={unitLabel(units)}
                value={effort.loadKg != null ? String(displayLoad(effort.loadKg, units)) : ''}
                onChangeText={(text) =>
                  updateSubEffort(index, { loadKg: loadInputToKg(text, units) })
                }
                keyboardType="decimal-pad"
                editable={!isLocked}
                style={[styles.subEffortInput, { backgroundColor: colors.background }]}
              />
              <TextInput
                theme={inputTheme}
                mode="outlined"
                dense
                label="reps"
                value={effort.reps != null ? String(effort.reps) : ''}
                onChangeText={(text) => updateSubEffort(index, { reps: parseDecimalInput(text) })}
                keyboardType="number-pad"
                editable={!isLocked}
                style={[styles.subEffortInput, { backgroundColor: colors.background }]}
              />
              <IconButton
                icon="close"
                size={16}
                iconColor={colors.textMuted}
                disabled={isLocked}
                onPress={() => removeSubEffort(index)}
                accessibilityLabel={`Remove effort ${index + 1}`}
                style={styles.compactButton}
              />
            </View>
          ))}
          <Text
            onPress={isLocked ? undefined : addSubEffort}
            accessibilityRole="button"
            style={[
              typography.captionBold,
              { color: isLocked ? colors.textMuted : colors.accent, paddingVertical: 8 },
            ]}
          >
            + {TECHNIQUE_ADD_LABEL[technique]}
          </Text>
        </View>
      ) : null}
      {validationError ? (
        <Text style={[typography.caption, { color: colors.danger }]}>{validationError}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: 10,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setNumber: {
    width: 20,
  },
  setMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
  },
  inputContent: {
    fontFamily: fonts.mono,
  },
  rirButton: {
    flex: 1,
    height: 48,
    marginTop: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactButton: {
    margin: 0,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
  },
  subEffortPanel: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  subEffortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subEffortInput: {
    flex: 1,
    height: 40,
  },
});
