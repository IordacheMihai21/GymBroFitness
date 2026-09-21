import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon } from 'react-native-paper';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { requireExercise } from '@/domain/exercises/catalog';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/dates';
import type { PersonalRecord, Units } from '@/types';
import { displayLoad, formatLoad, unitLabel } from '@/utils/units';

type PrWatchCardProps = {
  records: PersonalRecord[];
  units: Units;
};

export function PrWatchCard({ records, units }: PrWatchCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const watchlist = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const [hero, ...rest] = watchlist;

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
        },
      ]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Record radar</Text>
            <Text style={[typography.subheading, { color: colors.textPrimary }]}>PR watchlist</Text>
          </View>
          <Icon source="trophy-outline" size={21} color={colors.accent} />
        </View>

        {hero ? (
          <HeroRecord record={hero} units={units} />
        ) : (
          <View style={[styles.emptyPanel, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              No PRs logged yet
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Finish a loaded workout and this card will track your best e1RM records.
            </Text>
          </View>
        )}

        {rest.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            {rest.map((record, index) => (
              <RecordRow key={record.id} record={record} rank={index + 2} units={units} />
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

function HeroRecord({ record, units }: { record: PersonalRecord; units: Units }) {
  const { colors, radius, spacing, typography } = useTheme();
  const exercise = requireExercise(record.exerciseId);
  const targetLift =
    record.loadKg != null && record.reps != null
      ? `${formatLoad(record.loadKg, units)} × ${record.reps}`
      : null;

  return (
    <View style={[styles.heroCard, { borderRadius: radius.lg, shadowColor: colors.accent }]}>
      <LinearGradient
        colors={[colors.brandGradientEnd, colors.brandGradientStart]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroWatermark}>
        <Icon source="trophy" size={72} color="rgba(255,255,255,0.12)" />
      </View>
      <View style={[styles.heroContent, { padding: spacing.lg }]}>
        <View style={styles.heroBadge}>
          <Icon source="trophy" size={13} color="#FFFFFF" />
          <Text style={[typography.micro, { color: '#FFFFFF' }]}>NEW RECORD</Text>
        </View>
        <Text style={[typography.bodyBold, { color: '#FFFFFF' }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <View style={styles.heroValueRow}>
          <AnimatedNumber
            value={displayLoad(record.value, units) ?? 0}
            decimals={1}
            style={[typography.jumbo, { fontSize: 40, lineHeight: 44, color: '#FFFFFF' }]}
          />
          <Text style={[typography.caption, { color: 'rgba(255,255,255,0.8)' }]}>
            {unitLabel(units)} e1RM
          </Text>
        </View>
        <Text style={[typography.micro, { color: 'rgba(255,255,255,0.75)' }]}>
          {targetLift ? `${targetLift} · ` : ''}
          {formatDate(record.date)}
        </Text>
      </View>
    </View>
  );
}

function RecordRow({
  record,
  rank,
  units,
}: {
  record: PersonalRecord;
  rank: number;
  units: Units;
}) {
  const { colors, typography } = useTheme();
  const exercise = requireExercise(record.exerciseId);
  const targetLift =
    record.loadKg != null && record.reps != null
      ? `${formatLoad(record.loadKg, units)} × ${record.reps}`
      : `${displayLoad(record.value, units)} e1RM`;

  return (
    <View style={styles.recordRow}>
      <View style={[styles.rank, { backgroundColor: colors.surfacePressed }]}>
        <Text style={[typography.micro, { color: colors.textMuted }]}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.captionBold, { color: colors.textPrimary }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]} numberOfLines={1}>
          {targetLift} · {formatLoad(record.value, units)} e1RM
        </Text>
      </View>
      <Text style={[typography.captionBold, { color: colors.accent }]}>near</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCard: {
    overflow: 'hidden',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroWatermark: {
    position: 'absolute',
    right: -14,
    bottom: -16,
    transform: [{ rotate: '-15deg' }],
  },
  heroContent: {
    gap: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyPanel: {
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
