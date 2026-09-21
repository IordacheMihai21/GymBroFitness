import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton, Menu, TextInput } from 'react-native-paper';

import { formatPlateBreakdown, plateBreakdown } from '@/domain/workouts/plateMath';
import { formatRir } from '@/domain/workouts/rir';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';
import type {
  EquipmentType,
  PerformedSet,
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

type SetRowProps = {
  set: PerformedSet;
  targetLabel: string;
  onChange: (patch: Partial<PerformedSet>) => void;
  onToggleComplete: () => void;
  onCopyPrevious?: () => void;
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

  const technique = set.technique ?? 'standard';
  const subEfforts = set.subEfforts ?? [];
  const isLocked = disabled || set.completed;

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

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: set.completed ? colors.successSoft : colors.surfaceRaised,
          borderRadius: radius.md,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <View style={[styles.setNumber, { backgroundColor: colors.surfacePressed }]}>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
            {set.setNumber}
          </Text>
        </View>
        <View style={styles.setMeta}>
          <View style={styles.setTitleRow}>
            <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={1}>
              {previousLabel ?? 'No previous set'}
            </Text>
            {technique !== 'standard' ? (
              <View style={[styles.techniqueBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[typography.micro, { color: colors.accent }]}>
                  {TECHNIQUE_LABELS[technique]}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
            {targetLabel}
          </Text>
          {set.formAnalysis ? (
            <Text style={[typography.micro, { color: colors.success }]} numberOfLines={1}>
              Form AI: {set.formAnalysis.averageScore}/100 · {set.formAnalysis.repCount} reps
            </Text>
          ) : null}
        </View>

        <View style={styles.actionGroup}>
          {supportsTechniques || onCopyPrevious ? (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-horizontal"
                  mode={technique !== 'standard' ? 'contained' : 'contained-tonal'}
                  size={16}
                  onPress={() => setMenuVisible(true)}
                  disabled={isLocked}
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
              {supportsTechniques
                ? TECHNIQUES.map((item) => (
                    <Menu.Item
                      key={item}
                      onPress={() => selectTechnique(item)}
                      title={TECHNIQUE_LABELS[item]}
                      leadingIcon={item === technique ? 'check' : undefined}
                    />
                  ))
                : null}
            </Menu>
          ) : null}

          <IconButton
            icon="check"
            mode={set.completed ? 'contained' : 'contained-tonal'}
            size={18}
            onPress={onToggleComplete}
            disabled={disabled}
            style={styles.compactButton}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        {supportsLoad ? (
          <TextInput
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
            style={styles.input}
          />
        ) : null}
        {supportsReps ? (
          <TextInput
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
            style={styles.input}
          />
        ) : (
          <TextInput
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
            style={styles.input}
          />
        )}
        <Pressable
          onPress={onOpenRirPicker}
          disabled={isLocked}
          style={[styles.rirButton, { borderColor: colors.border, opacity: isLocked ? 0.6 : 1 }]}
        >
          <Text style={[typography.micro, { color: colors.textMuted }]}>RIR</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {set.rir != null ? formatRir(set.rir) : '–'}
          </Text>
        </Pressable>
      </View>

      {plates ? (
        <View style={styles.plateRow}>
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            Per side · {formatPlateBreakdown(plates)}
          </Text>
          {!plates.exact ? (
            <Text style={[typography.micro, { color: colors.accent }]}>
              ≈{plates.achievedWeight} {unitLabel(units)} closest
            </Text>
          ) : null}
        </View>
      ) : null}

      {set.formAnalysis ? (
        <View
          style={[
            styles.formAnalysisPanel,
            { backgroundColor: colors.successSoft, borderColor: colors.success },
          ]}
        >
          <View style={styles.formAnalysisHeader}>
            <Text style={[typography.captionBold, { color: colors.success }]}>
              Form AI {set.formAnalysis.averageScore}/100
            </Text>
            <Text style={[typography.micro, { color: colors.textSecondary }]}>
              ROM {set.formAnalysis.averageRomScore} · Tempo {set.formAnalysis.averageTempoScore}
            </Text>
          </View>
          <Text style={[typography.micro, { color: colors.textSecondary }]} numberOfLines={2}>
            {set.formAnalysis.mostCommonIssue ??
              set.formAnalysis.recommendations[0] ??
              'Clean set — keep this as your baseline.'}
          </Text>
        </View>
      ) : null}

      {supportsTechniques && technique !== 'standard' ? (
        <View style={[styles.subEffortPanel, { borderColor: colors.border }]}>
          {subEfforts.map((effort, index) => (
            <View key={index} style={styles.subEffortRow}>
              <Text style={[typography.micro, { color: colors.textMuted, width: 14 }]}>
                {index + 1}
              </Text>
              <TextInput
                mode="outlined"
                dense
                label={unitLabel(units)}
                value={effort.loadKg != null ? String(displayLoad(effort.loadKg, units)) : ''}
                onChangeText={(text) =>
                  updateSubEffort(index, { loadKg: loadInputToKg(text, units) })
                }
                keyboardType="decimal-pad"
                editable={!isLocked}
                style={styles.subEffortInput}
              />
              <TextInput
                mode="outlined"
                dense
                label="reps"
                value={effort.reps != null ? String(effort.reps) : ''}
                onChangeText={(text) => updateSubEffort(index, { reps: parseDecimalInput(text) })}
                keyboardType="number-pad"
                editable={!isLocked}
                style={styles.subEffortInput}
              />
              <IconButton
                icon="close"
                size={14}
                disabled={isLocked}
                onPress={() => removeSubEffort(index)}
                style={styles.compactButton}
              />
            </View>
          ))}
          <Text
            onPress={isLocked ? undefined : addSubEffort}
            style={[
              typography.captionBold,
              { color: isLocked ? colors.textMuted : colors.accent, paddingVertical: 4 },
            ]}
          >
            + {TECHNIQUE_ADD_LABEL[technique]}
          </Text>
        </View>
      ) : null}
      {validationError ? (
        <Text style={[typography.micro, { color: colors.danger }]}>{validationError}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 96,
    paddingVertical: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  setMeta: {
    flex: 1,
    gap: 2,
  },
  setNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  techniqueBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
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
  rirButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  formAnalysisPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  formAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
