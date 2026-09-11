import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Reveal } from '@/components/ui/Reveal';
import { DEMO_DISPLAY_NAME } from '@/domain/programs/demoPreferences';
import { useTheme } from '@/theme';

const MENU_ITEMS = [{ icon: 'settings-outline', label: 'Settings', route: '/settings' }] as const satisfies {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: '/settings';
}[];

export default function ProfileScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Animated.ScrollView
      entering={FadeIn}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <Reveal>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: colors.surfacePressed, borderRadius: radius.pill }]}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>
              {DEMO_DISPLAY_NAME.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{DEMO_DISPLAY_NAME}</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Training since Aug 2026
            </Text>
          </View>
        </View>
      </Reveal>

      <View style={{ gap: spacing.sm }}>
        {MENU_ITEMS.map((item, i) => (
          <Reveal key={item.route} index={1 + i}>
            <Pressable
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [
                styles.menuRow,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.surfaceRaised,
                  borderRadius: radius.lg,
                  borderColor: colors.border,
                  padding: spacing.md,
                },
              ]}
            >
              <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
