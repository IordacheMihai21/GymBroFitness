import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Checkbox, Chip } from 'react-native-paper';

import { useTheme } from '@/theme';
import type { ReadinessCheckIn } from '@/types';

type Rating = 1 | 2 | 3 | 4 | 5;

type ReadinessCheckInCardProps = {
  onSave: (readiness: ReadinessCheckIn) => void;
  onSkip: () => void;
};

export function ReadinessCheckInCard({ onSave, onSkip }: ReadinessCheckInCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [energy, setEnergy] = useState<Rating>(3);
  const [sleepQuality, setSleepQuality] = useState<Rating>(3);
  const [recovery, setRecovery] = useState<Rating>(3);
  const [hasPain, setHasPain] = useState(false);

  return (
    <Card
      mode="contained"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
      }}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={[typography.micro, { color: colors.accent }]}>Optional check-in</Text>
          <Text style={[typography.subheading, { color: colors.textPrimary }]}>
            How are you today?
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Self-reported context can hold a recommendation; it never claims to measure recovery.
          </Text>
        </View>

        <RatingRow label="Energy" value={energy} onChange={setEnergy} />
        <RatingRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <RatingRow label="Felt recovery" value={recovery} onChange={setRecovery} />

        <Checkbox.Item
          label="I have pain that may affect this workout"
          status={hasPain ? 'checked' : 'unchecked'}
          onPress={() => setHasPain((current) => !current)}
          position="leading"
          mode="android"
          labelStyle={[typography.caption, { color: colors.textPrimary }]}
          style={styles.checkbox}
        />

        <View style={styles.actions}>
          <Button mode="text" onPress={onSkip} style={styles.action}>
            Skip
          </Button>
          <Button
            mode="contained-tonal"
            onPress={() =>
              onSave({
                energy,
                sleepQuality,
                recovery,
                soreness: {},
                hasPain,
              })
            }
            style={styles.action}
          >
            Save check-in
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Rating;
  onChange: (value: Rating) => void;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.ratingRow}>
      <Text style={[typography.captionBold, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
      <View style={styles.ratingOptions}>
        {([1, 2, 3, 4, 5] as const).map((rating) => (
          <Chip
            key={rating}
            compact
            selected={rating === value}
            onPress={() => onChange(rating)}
            accessibilityLabel={`${label} ${rating} of 5`}
            style={styles.ratingChip}
          >
            {rating}
          </Chip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ratingRow: {
    gap: 8,
  },
  ratingOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  ratingChip: {
    minWidth: 34,
  },
  checkbox: {
    paddingHorizontal: 0,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  action: {
    minWidth: 100,
  },
});
