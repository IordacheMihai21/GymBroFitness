import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Checkbox } from 'react-native-paper';

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
  const [expanded, setExpanded] = useState(false);

  // Collapsed by default: the check-in is optional, the first set is not.
  if (!expanded) {
    return (
      <View
        style={[
          styles.panel,
          styles.collapsed,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            paddingLeft: spacing.md,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>How do you feel?</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            Optional. Adjusts today if sleep or recovery is low.
          </Text>
        </View>
        <Button compact mode="text" textColor={colors.textSecondary} onPress={onSkip}>
          Skip
        </Button>
        <Button compact mode="contained-tonal" onPress={() => setExpanded(true)}>
          Rate
        </Button>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.lg,
        },
      ]}
    >
      <View style={{ gap: 2 }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>How do you feel?</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Optional. 1 is low, 5 is great.
        </Text>
      </View>

      <RatingRow label="Energy" value={energy} onChange={setEnergy} />
      <RatingRow label="Sleep" value={sleepQuality} onChange={setSleepQuality} />
      <RatingRow label="Recovery" value={recovery} onChange={setRecovery} />

      <Checkbox.Item
        label="Something hurts today"
        status={hasPain ? 'checked' : 'unchecked'}
        onPress={() => setHasPain((current) => !current)}
        position="leading"
        mode="android"
        labelStyle={[typography.body, { color: colors.textPrimary, textAlign: 'left' }]}
        style={styles.checkbox}
      />

      <View style={styles.actions}>
        <Button mode="text" textColor={colors.textSecondary} onPress={onSkip}>
          Skip
        </Button>
        <Button
          mode="contained"
          onPress={() =>
            onSave({
              energy,
              sleepQuality,
              recovery,
              soreness: {},
              hasPain,
            })
          }
        >
          Save
        </Button>
      </View>
    </View>
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
  const { colors, radius, typography } = useTheme();

  return (
    <View style={styles.ratingRow}>
      <Text style={[typography.body, { color: colors.textSecondary, width: 80 }]}>{label}</Text>
      <View style={styles.ratingOptions}>
        {([1, 2, 3, 4, 5] as const).map((rating) => {
          const selected = rating === value;
          return (
            <Pressable
              key={rating}
              onPress={() => onChange(rating)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} ${rating} of 5`}
              style={[
                styles.ratingButton,
                {
                  borderRadius: radius.md,
                  backgroundColor: selected ? colors.textPrimary : colors.surfaceRaised,
                },
              ]}
            >
              <Text
                style={[
                  typography.numeric,
                  { color: selected ? colors.textInverse : colors.textSecondary, fontSize: 15 },
                ]}
              >
                {rating}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingRight: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingOptions: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  ratingButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
