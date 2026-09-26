import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
        {description ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{description}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
});
