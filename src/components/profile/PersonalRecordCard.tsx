import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { requireExercise } from '@/domain/exercises/catalog';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/dates';
import type { PersonalRecord } from '@/types';

type PersonalRecordCardProps = {
  record: PersonalRecord;
};

export function PersonalRecordCard({ record }: PersonalRecordCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const exercise = requireExercise(record.exerciseId);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderColor: colors.border },
      ]}
    >
      <View style={{ padding: spacing.md, gap: 4 }}>
        <View style={styles.header}>
          <Ionicons name="trophy" size={14} color={colors.warning} />
          <Text
            style={[typography.captionBold, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
        </View>
        <View style={styles.valueRow}>
          <AnimatedNumber
            value={record.value}
            decimals={1}
            style={[typography.title, { color: colors.textPrimary }]}
          />
          <Text style={[typography.caption, { color: colors.textMuted }]}> kg e1RM</Text>
        </View>
        <Text style={[typography.micro, { color: colors.textMuted }]}>
          {formatDate(record.date)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
});
