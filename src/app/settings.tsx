import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>Settings</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>Coming up next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
