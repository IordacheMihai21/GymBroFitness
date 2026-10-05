import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Body from 'react-native-body-highlighter';

import { PressableScale } from '@/components/ui/PressableScale';
import { exerciseBodyData } from '@/domain/muscles/muscleMap';
import { useTheme } from '@/theme';
import type { ProgramDay } from '@/types';

type DayCardProps = {
  /** Trained at least once this week. */
  done?: boolean;
  day: ProgramDay;
  index: number;
  selected: boolean;
  onPress: () => void;
};

/**
 * One training day in the week rail: a small silhouette lit where the day
 * works, so the split reads at a glance before any text.
 */
export function DayCard({ day, index, selected, onPress, done = false }: DayCardProps) {
  const { colors, radius, typography } = useTheme();
  const backHeavy = day.focus.some((muscle) =>
    ['back', 'hamstrings', 'glutes', 'lower_back'].includes(muscle),
  );
  const frontHeavy = day.focus.some((muscle) =>
    ['chest', 'quadriceps', 'abs', 'biceps', 'shoulders'].includes(muscle),
  );
  const side = backHeavy && !frontHeavy ? 'back' : 'front';
  const data = exerciseBodyData(day.focus, []);
  const sets = day.prescriptions.reduce((total, item) => total + item.workingSets, 0);

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.96}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`Day ${index + 1}, ${day.name}, ${day.prescriptions.length} exercises${done ? ', done this week' : ''}`}
      style={[
        styles.card,
        {
          borderRadius: radius.xl,
          backgroundColor: selected ? colors.accentSoft : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <View style={styles.top}>
        <Text
          style={[
            typography.micro,
            { color: selected ? colors.accent : colors.textMuted, flex: 1 },
          ]}
        >
          Day {index + 1}
        </Text>
        {done ? (
          <View style={[styles.doneBadge, { backgroundColor: colors.success }]}>
            <MaterialCommunityIcons name="check" size={12} color={colors.background} />
          </View>
        ) : null}
      </View>
      <View style={styles.body} importantForAccessibility="no-hide-descendants">
        <Body
          data={data}
          colors={[`${colors.accent}66`, colors.accent]}
          side={side}
          scale={0.3}
          border="none"
          defaultFill={colors.surfacePressed}
        />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={2}>
          {day.name}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]}>
          {day.prescriptions.length} ex, {sets} sets
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 128,
    padding: 12,
    gap: 6,
    borderWidth: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 18,
  },
  doneBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
