import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';
import type { PerformedSet } from '@/types';

type SetRowProps = {
  set: PerformedSet;
  targetLabel: string;
  onChange: (patch: Partial<PerformedSet>) => void;
  onToggleComplete: () => void;
};

export function SetRow({ set, targetLabel, onChange, onToggleComplete }: SetRowProps) {
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
      <Text style={[typography.captionBold, { color: colors.textMuted, width: 28 }]}>
        {set.setNumber}
      </Text>

      <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
        {targetLabel}
      </Text>

      <TextInput
        value={set.loadKg != null ? String(set.loadKg) : ''}
        onChangeText={(text) => onChange({ loadKg: text ? Number(text) : null })}
        placeholder="kg"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        editable={!set.completed}
        style={[typography.bodyBold, styles.input, { color: colors.textPrimary }]}
      />
      <TextInput
        value={set.reps != null ? String(set.reps) : ''}
        onChangeText={(text) => onChange({ reps: text ? Number(text) : null })}
        placeholder="reps"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        editable={!set.completed}
        style={[typography.bodyBold, styles.input, { color: colors.textPrimary }]}
      />

      <Pressable
        onPress={onToggleComplete}
        hitSlop={8}
        style={[
          styles.checkButton,
          {
            backgroundColor: set.completed ? colors.success : colors.surfacePressed,
            borderRadius: radius.pill,
          },
        ]}
      >
        <Ionicons
          name="checkmark"
          size={18}
          color={set.completed ? colors.onAccent : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TOUCH_TARGET,
  },
  input: {
    width: 56,
    textAlign: 'center',
    paddingVertical: 6,
  },
  checkButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
