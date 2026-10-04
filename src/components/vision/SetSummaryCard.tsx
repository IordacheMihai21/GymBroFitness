import { StyleSheet, Text, View } from 'react-native';

import { InfoHint } from '@/components/ui/InfoHint';
import type { GlossaryTermKey } from '@/domain/glossary/terms';
import type { RepAnalysis } from '@/domain/vision/formScoring';
import { buildSetSummary } from '@/domain/vision/sessionSummary';
import { useTheme } from '@/theme';

type SetSummaryCardProps = {
  reps: RepAnalysis[];
};

export function SetSummaryCard({ reps }: SetSummaryCardProps) {
  const { colors, spacing, typography } = useTheme();
  const summary = buildSetSummary(reps);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Set complete</Text>
          <Text style={[typography.display, { color: colors.textPrimary }]}>
            {summary.reps} rep{summary.reps === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.jumbo, { color: colors.accent, fontSize: 34, lineHeight: 40 }]}>
            {summary.averageScore}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>avg form score</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat
          label="Best rep"
          value={
            summary.bestRep
              ? `Rep ${summary.bestRep.repNumber}, ${summary.bestRep.overallScore}`
              : '-'
          }
        />
        <Stat
          label="Worst rep"
          value={
            summary.worstRep
              ? `Rep ${summary.worstRep.repNumber}, ${summary.worstRep.overallScore}`
              : '-'
          }
        />
      </View>
      <View style={styles.statRow}>
        <Stat label="Avg ROM" value={`${summary.averageRomScore}/100`} hint="rom" />
        <Stat label="Avg tempo" value={`${summary.averageTempoScore}/100`} hint="tempo" />
      </View>

      {summary.mostCommonIssue ? (
        <View style={[styles.panel, { borderLeftColor: colors.warning }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Most common issue</Text>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
            {summary.mostCommonIssue}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        {summary.recommendations.map((rec) => (
          <Text key={rec} style={[typography.body, { color: colors.textSecondary }]}>
            {rec}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: GlossaryTermKey }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.numeric, { color: colors.textPrimary }]}>{value}</Text>
      <View style={styles.statLabelRow}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
        {hint ? <InfoHint term={hint} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  panel: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 2,
  },
});
