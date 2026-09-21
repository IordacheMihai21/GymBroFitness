import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon } from 'react-native-paper';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { requireExercise } from '@/domain/exercises/catalog';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/dates';
import type { PersonalRecord, Units } from '@/types';
import { displayLoad, unitLabel } from '@/utils/units';

type PersonalRecordCardProps = {
  record: PersonalRecord;
  units: Units;
};

export function PersonalRecordCard({ record, units }: PersonalRecordCardProps) {
  const { colors, spacing, typography } = useTheme();
  const exercise = requireExercise(record.exerciseId);

  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 4, padding: spacing.md }}>
        <View style={styles.header}>
          <Icon source="trophy" size={14} color={colors.warning} />
          <Text style={[typography.captionBold, { color: colors.textSecondary }]} numberOfLines={1}>
            {exercise.name}
          </Text>
        </View>
        <View style={styles.valueRow}>
          <AnimatedNumber
            value={displayLoad(record.value, units) ?? 0}
            decimals={1}
            style={[typography.title, { color: colors.textPrimary }]}
          />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {unitLabel(units)} e1RM
          </Text>
        </View>
        <Text style={[typography.micro, { color: colors.textMuted }]}>
          {formatDate(record.date)}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
});
