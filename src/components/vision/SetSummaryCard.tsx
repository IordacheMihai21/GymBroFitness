import { StyleSheet, Text, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';

import type { RepAnalysis } from '@/domain/vision/formScoring';
import { buildSetSummary } from '@/domain/vision/sessionSummary';
import { useTheme } from '@/theme';

type SetSummaryCardProps = {
  reps: RepAnalysis[];
};

export function SetSummaryCard({ reps }: SetSummaryCardProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const summary = buildSetSummary(reps);

  return (
    <Card
      mode="contained"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}
    >
      <Card.Content style={{ gap: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.micro, { color: colors.accent }]}>Set complete</Text>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>
              {summary.reps} rep{summary.reps === 1 ? '' : 's'}
            </Text>
          </View>
          <Chip compact mode="flat" icon="star-four-points-outline">
            {summary.averageScore}/100 avg
          </Chip>
        </View>

        <View style={styles.statRow}>
          <Stat label="Best rep" value={summary.bestRep ? `#${summary.bestRep.repNumber} · ${summary.bestRep.overallScore}` : '—'} />
          <Stat label="Worst rep" value={summary.worstRep ? `#${summary.worstRep.repNumber} · ${summary.worstRep.overallScore}` : '—'} />
        </View>
        <View style={styles.statRow}>
          <Stat label="Avg ROM" value={`${summary.averageRomScore}/100`} />
          <Stat label="Avg tempo" value={`${summary.averageTempoScore}/100`} />
        </View>

        {summary.mostCommonIssue ? (
          <View style={[styles.panel, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[typography.micro, { color: colors.warning }]}>Most common issue</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{summary.mostCommonIssue}</Text>
          </View>
        ) : null}

        <View style={{ gap: 4 }}>
          {summary.recommendations.map((rec) => (
            <Text key={rec} style={[typography.caption, { color: colors.textMuted }]}>
              • {rec}
            </Text>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.subheading, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
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
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  panel: {
    borderRadius: 14,
    padding: 12,
  },
});
