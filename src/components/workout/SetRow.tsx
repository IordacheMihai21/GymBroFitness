import { StyleSheet, Text, View } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';
import type { PerformedSet } from '@/types';

type SetRowProps = {
  set: PerformedSet;
  targetLabel: string;
  onChange: (patch: Partial<PerformedSet>) => void;
  onToggleComplete: () => void;
  onCopyPrevious?: () => void;
};

export function SetRow({
  set,
  targetLabel,
  onChange,
  onToggleComplete,
  onCopyPrevious,
}: SetRowProps) {
  const { colors, radius, spacing, typography } = useTheme();

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
        <View style={styles.setMeta}>
          <Text style={[typography.captionBold, { color: colors.textPrimary }]}>
            Set {set.setNumber}
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={1}>
            {targetLabel}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          {onCopyPrevious ? (
            <IconButton
              icon="content-copy"
              mode="contained-tonal"
              size={16}
              onPress={onCopyPrevious}
              disabled={set.completed}
              style={styles.compactButton}
            />
          ) : null}

          <IconButton
            icon="check"
            mode={set.completed ? 'contained' : 'contained-tonal'}
            size={18}
            onPress={onToggleComplete}
            style={styles.compactButton}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          mode="outlined"
          dense
          label="kg"
          value={set.loadKg != null ? String(set.loadKg) : ''}
          onChangeText={(text) => onChange({ loadKg: text ? Number(text) : null })}
          keyboardType="decimal-pad"
          editable={!set.completed}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          dense
          label="reps"
          value={set.reps != null ? String(set.reps) : ''}
          onChangeText={(text) => onChange({ reps: text ? Number(text) : null })}
          keyboardType="number-pad"
          editable={!set.completed}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          dense
          label="RIR"
          value={set.rir != null ? String(set.rir) : ''}
          onChangeText={(text) => onChange({ rir: text ? Number(text) : null })}
          keyboardType="number-pad"
          editable={!set.completed}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 108,
    paddingVertical: 10,
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
  compactButton: {
    margin: 0,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
  },
});
