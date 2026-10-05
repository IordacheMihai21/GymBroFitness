import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, TextInput as RNTextInput, StyleSheet, Text, View } from 'react-native';
import { Divider, IconButton, Menu } from 'react-native-paper';
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
import type { SetAutofillSuggestion } from '@/domain/workouts/setAutofill';
import { sidePatch } from '@/domain/workouts/sides';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';
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
  /** What an empty field becomes when the set is ticked; shown as greyed hints. */
  suggestion?: SetAutofillSuggestion | null;
  /** Load field meaning, e.g. "kg/side", "kg each", "kg total". */
  loadLabel?: string;
  /** Reps are per side for one-side-at-a-time work. */
  perSide?: boolean;
  /** Removes this (unlogged) set. */
  onDelete?: () => void;
  /** Left and right reps get their own fields (one-side-at-a-time work). */
  splitSides?: boolean;
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
    suggestion = null,
    loadLabel,
    onDelete,
    splitSides = false,
  },
  ref,
) {
  const { colors, radius, spacing, typography } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const loadInputRef = useRef<FocusableInput | null>(null);
  const resultInputRef = useRef<FocusableInput | null>(null);
  const rightInputRef = useRef<FocusableInput | null>(null);
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

  const sweepStyle = useAnimatedStyle(() => ({
    width: `${completion.value * 100}%`,
    opacity: Math.min(1, completion.value * 1.6),
  }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  const hintLoad =
    suggestion?.loadKg != null ? String(displayLoad(suggestion.loadKg, units)) : undefined;
  const hintReps = suggestion?.reps != null ? String(suggestion.reps) : undefined;
  const hintSeconds =
    suggestion?.durationSeconds != null ? String(suggestion.durationSeconds) : undefined;
  const shownRir = set.rir ?? suggestion?.rir ?? null;
  const previous = previousLabel?.replace(/^Last: /, '').replace(/ @ RIR.*$/, '') ?? '-';
  const badge = set.kind === 'warmup' ? 'W' : set.kind === 'failure' ? 'F' : String(set.setNumber);
  const badgeColor =
    set.kind === 'warmup'
      ? colors.warning
      : set.kind === 'failure'
        ? colors.danger
        : set.completed
          ? colors.success
          : colors.textSecondary;
  const inputSurface = set.completed ? 'transparent' : colors.surfaceRaised;
  const inputText = [
    typography.numeric,
    styles.cellInput,
    { color: colors.textPrimary, backgroundColor: inputSurface, borderRadius: radius.md },
  ];

  return (
    <View
      style={[
        styles.row,
        {
          borderRadius: radius.lg,
          paddingHorizontal: spacing.xs,
          marginHorizontal: -spacing.xs,
          opacity: set.skipped ? 0.55 : 1,
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
      <View style={styles.cells}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setMenuVisible(true)}
              disabled={menuLocked}
              accessibilityRole="button"
              accessibilityLabel={`Set ${set.setNumber} options${set.kind !== 'working' ? `, ${SET_KIND_LABELS[set.kind]}` : ''}`}
              accessibilityState={{ expanded: menuVisible }}
              hitSlop={6}
              style={[styles.badgeCell, { borderRadius: radius.sm }]}
            >
              <Text style={[typography.numeric, { color: badgeColor, fontSize: 15 }]}>{badge}</Text>
            </Pressable>
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
          {onDelete ? (
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                onDelete();
              }}
              title="Delete set"
              leadingIcon="delete-outline"
            />
          ) : null}
          {hasSetActions || onDelete ? <Divider /> : null}
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

        <Pressable
          onPress={onCopyPrevious ?? undefined}
          disabled={!onCopyPrevious || isLocked}
          style={styles.previousCell}
          accessibilityLabel={`Last time: ${previous}`}
        >
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {previous}
          </Text>
        </Pressable>

        {supportsLoad ? (
          <RNTextInput
            ref={(instance) => {
              loadInputRef.current = instance;
            }}
            value={set.loadKg != null ? String(displayLoad(set.loadKg, units)) : ''}
            placeholder={hintLoad ?? '-'}
            placeholderTextColor={colors.textMuted}
            onChangeText={(text) => onChange({ loadKg: loadInputToKg(text, units) })}
            keyboardType="decimal-pad"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => resultInputRef.current?.focus()}
            editable={!isLocked}
            selectTextOnFocus
            accessibilityLabel={`${loadLabel ?? unitLabel(units)} for set ${set.setNumber}`}
            style={[inputText, styles.loadCell]}
          />
        ) : null}

        {splitSides && supportsReps && set.kind !== 'warmup' ? (
          <View style={styles.sidesCell}>
            {(['left', 'right'] as const).map((side) => {
              const value = side === 'left' ? set.repsLeft : set.repsRight;
              const hint =
                (side === 'left' ? suggestion?.repsLeft : suggestion?.repsRight) ??
                suggestion?.reps;
              return (
                <RNTextInput
                  key={side}
                  ref={
                    side === 'left'
                      ? (instance) => {
                          resultInputRef.current = instance;
                        }
                      : (instance) => {
                          rightInputRef.current = instance;
                        }
                  }
                  value={value != null ? String(value) : ''}
                  placeholder={hint != null ? String(hint) : side === 'left' ? 'L' : 'R'}
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(text) => onChange(sidePatch(set, side, parseDecimalInput(text)))}
                  keyboardType="number-pad"
                  returnKeyType={side === 'left' ? 'next' : 'done'}
                  blurOnSubmit={side !== 'left'}
                  onSubmitEditing={
                    side === 'left' ? () => rightInputRef.current?.focus() : onSubmitEditing
                  }
                  editable={!isLocked}
                  selectTextOnFocus
                  accessibilityLabel={`${side === 'left' ? 'Left' : 'Right'} reps for set ${set.setNumber}`}
                  style={[inputText, styles.sideInput]}
                />
              );
            })}
          </View>
        ) : (
          <RNTextInput
            ref={(instance) => {
              resultInputRef.current = instance;
            }}
            value={
              supportsReps
                ? set.reps != null
                  ? String(set.reps)
                  : ''
                : set.durationSeconds != null
                  ? String(set.durationSeconds)
                  : ''
            }
            placeholder={(supportsReps ? hintReps : hintSeconds) ?? '-'}
            placeholderTextColor={colors.textMuted}
            onChangeText={(text) =>
              onChange(
                supportsReps
                  ? { reps: parseDecimalInput(text) }
                  : { durationSeconds: parseDecimalInput(text) },
              )
            }
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={onSubmitEditing}
            editable={!isLocked}
            selectTextOnFocus
            accessibilityLabel={`${supportsReps ? 'Reps' : 'Seconds'} for set ${set.setNumber}`}
            style={[inputText, splitSides ? styles.sidesCell : styles.repsCell]}
          />
        )}

        <Pressable
          onPress={onOpenRirPicker}
          disabled={isLocked}
          accessibilityRole="button"
          accessibilityLabel={`RIR for set ${set.setNumber}: ${shownRir != null ? formatRir(shownRir) : 'not set'}`}
          style={[styles.rirCell, { backgroundColor: inputSurface, borderRadius: radius.md }]}
        >
          <Text
            style={[
              typography.numeric,
              { fontSize: 15, color: set.rir != null ? colors.textPrimary : colors.textMuted },
            ]}
          >
            {shownRir != null ? formatRir(shownRir) : '-'}
          </Text>
        </Pressable>

        <Animated.View style={checkStyle}>
          <Pressable
            onPress={onToggleComplete}
            disabled={disabled || set.skipped}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.completed }}
            accessibilityLabel={
              set.completed
                ? `Mark set ${set.setNumber} not done`
                : `Log set ${set.setNumber}, target ${targetLabel}`
            }
            hitSlop={4}
            style={[
              styles.checkCell,
              {
                borderRadius: radius.md,
                backgroundColor: set.completed ? colors.success : colors.surfacePressed,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={set.skipped ? 'skip-next' : 'check'}
              size={22}
              color={set.completed ? colors.background : colors.textSecondary}
            />
          </Pressable>
        </Animated.View>
      </View>

      {technique !== 'standard' ? (
        <Text style={[typography.captionBold, { color: colors.accent, marginLeft: 36 }]}>
          {TECHNIQUE_LABELS[technique]}
        </Text>
      ) : null}

      {plates && !set.completed ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 36 }]}>
          Per side: {formatPlateBreakdown(plates)}
          {!plates.exact ? `, closest is ${plates.achievedWeight} ${unitLabel(units)}` : ''}
        </Text>
      ) : null}

      {set.formAnalysis ? (
        <Text
          style={[typography.caption, { color: colors.textSecondary, marginLeft: 36 }]}
          numberOfLines={2}
        >
          Form AI {set.formAnalysis.averageScore}/100.{' '}
          {set.formAnalysis.mostCommonIssue ??
            set.formAnalysis.recommendations[0] ??
            'Clean set. Keep this as your baseline.'}
        </Text>
      ) : null}

      {supportsTechniques && technique !== 'standard' ? (
        <View style={[styles.subEffortPanel, { marginLeft: 36 }]}>
          {subEfforts.map((effort, index) => (
            <View key={index} style={styles.subEffortRow}>
              <Text
                style={[typography.numeric, { color: colors.textMuted, width: 18, fontSize: 13 }]}
              >
                {index + 1}
              </Text>
              <RNTextInput
                value={effort.loadKg != null ? String(displayLoad(effort.loadKg, units)) : ''}
                placeholder={unitLabel(units)}
                placeholderTextColor={colors.textMuted}
                onChangeText={(text) =>
                  updateSubEffort(index, { loadKg: loadInputToKg(text, units) })
                }
                keyboardType="decimal-pad"
                editable={!isLocked}
                style={[inputText, styles.subEffortInput]}
              />
              <RNTextInput
                value={effort.reps != null ? String(effort.reps) : ''}
                placeholder="reps"
                placeholderTextColor={colors.textMuted}
                onChangeText={(text) => updateSubEffort(index, { reps: parseDecimalInput(text) })}
                keyboardType="number-pad"
                editable={!isLocked}
                style={[inputText, styles.subEffortInput]}
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
              { color: isLocked ? colors.textMuted : colors.accent, paddingVertical: 6 },
            ]}
          >
            + {TECHNIQUE_ADD_LABEL[technique]}
          </Text>
        </View>
      ) : null}
      {validationError ? (
        <Text style={[typography.caption, { color: colors.danger, marginLeft: 36 }]}>
          {validationError}
        </Text>
      ) : null}
    </View>
  );
});

/** Column titles for the set table, aligned with SetRow's cells. */
export function SetTableHeader({
  loadLabel,
  repsLabel,
  showLoad,
  splitSides = false,
}: {
  loadLabel: string;
  repsLabel: string;
  showLoad: boolean;
  /** Reps column is two fields, left and right. */
  splitSides?: boolean;
}) {
  const { colors, typography } = useTheme();
  const label = [typography.micro, { color: colors.textMuted }];
  return (
    <View style={[styles.cells, styles.header]}>
      <Text style={[label, styles.badgeCell, styles.headerLabel]}>SET</Text>
      <Text style={[label, styles.previousCell, styles.headerLabel]}>LAST</Text>
      {showLoad ? (
        <Text style={[label, styles.loadCell, styles.center, styles.headerLabel]}>
          {loadLabel.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={[
          label,
          splitSides ? styles.sidesCell : styles.repsCell,
          styles.center,
          styles.headerLabel,
        ]}
      >
        {splitSides ? 'L / R' : repsLabel.toUpperCase()}
      </Text>
      <Text style={[label, styles.rirCell, styles.center, styles.headerLabel]}>RIR</Text>
      <View style={[styles.checkCell, styles.headerLabel]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 4,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  cells: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  header: {
    paddingBottom: 2,
    alignItems: 'flex-end',
  },
  // Header labels share one baseline; the 44 pt cell heights are for inputs.
  headerLabel: {
    height: undefined,
    minHeight: 0,
  },
  center: {
    textAlign: 'center',
  },
  badgeCell: {
    width: 30,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    textAlignVertical: 'center',
  },
  previousCell: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    minHeight: 44,
  },
  cellInput: {
    height: 44,
    textAlign: 'center',
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  loadCell: {
    width: 68,
  },
  sidesCell: {
    width: 86,
    flexDirection: 'row',
    gap: 4,
  },
  sideInput: {
    flex: 1,
  },
  repsCell: {
    width: 54,
  },
  rirCell: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCell: {
    width: 46,
    height: 44,
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
