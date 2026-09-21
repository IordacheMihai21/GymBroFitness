import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { ElementRef, RefObject } from 'react';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Icon, List } from 'react-native-paper';

import { useTheme } from '@/theme';

export type HomeSheet = 'swap' | 'weakPoint' | 'streak';

type SheetModalRef = ElementRef<typeof BottomSheetModal>;

type HomeActionSheetProps = {
  activeSheet: HomeSheet | null;
  modalRef: RefObject<SheetModalRef | null>;
  streakDays: number;
  currentDayName: string;
  swapLabel: string;
  onDismiss: () => void;
  onConfirmSwap: () => void;
};

export function HomeActionSheet({
  activeSheet,
  modalRef,
  streakDays,
  currentDayName,
  swapLabel,
  onDismiss,
  onConfirmSwap,
}: HomeActionSheetProps) {
  const { colors, spacing } = useTheme();
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.52} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={['42%', '58%']}
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={[styles.sheet, { padding: spacing.lg }]}>
        {activeSheet === 'swap' && (
          <SwapSheet
            currentDayName={currentDayName}
            swapLabel={swapLabel}
            onConfirmSwap={onConfirmSwap}
          />
        )}
        {activeSheet === 'weakPoint' && <WeakPointSheet />}
        {activeSheet === 'streak' && <StreakSheet streakDays={streakDays} />}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function SheetHeader({ icon, title, eyebrow }: { icon: string; title: string; eyebrow: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.sheetHeader}>
      <View style={[styles.headerIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon source={icon} size={18} color={colors.accent} />
      </View>
      <View>
        <Text style={[typography.micro, { color: colors.textMuted }]}>{eyebrow}</Text>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{title}</Text>
      </View>
    </View>
  );
}

function SwapSheet({
  currentDayName,
  swapLabel,
  onConfirmSwap,
}: {
  currentDayName: string;
  swapLabel: string;
  onConfirmSwap: () => void;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <SheetHeader icon="swap-horizontal" eyebrow="Program adjustment" title="Switch today?" />
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        Keep the week coherent: swapping changes today&apos;s training day, not the whole block.
      </Text>
      <View style={{ gap: spacing.xs }}>
        <List.Item
          title={`Keep ${currentDayName}`}
          description="Best if recovery and equipment are normal."
          left={(props) => <List.Icon {...props} icon="calendar-check" />}
          titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
          descriptionStyle={[typography.caption, { color: colors.textMuted }]}
        />
        <List.Item
          title={`Swap to ${swapLabel}`}
          description="Use this when today's main pattern is blocked or sore."
          left={(props) => <List.Icon {...props} icon="shuffle-variant" />}
          titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
          descriptionStyle={[typography.caption, { color: colors.textMuted }]}
        />
      </View>
      <Button mode="contained" icon="swap-horizontal" onPress={onConfirmSwap}>
        Swap to {swapLabel}
      </Button>
    </View>
  );
}

function WeakPointSheet() {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <SheetHeader icon="target" eyebrow="Auto-regulation" title="Weak point focus" />
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        Pick one bias when you want today&apos;s session to lean toward a lagging area. This will
        eventually feed the generator instead of being a manual tweak.
      </Text>
      <View style={styles.chipWrap}>
        {['Upper chest', 'Side delts', 'Triceps lockout', 'Pump finish'].map((label) => (
          <Chip key={label} compact mode="flat" disabled>
            {label}
          </Chip>
        ))}
      </View>
      <Button mode="outlined" icon="lock-outline" disabled>
        Connect to preferences later
      </Button>
    </View>
  );
}

function StreakSheet({ streakDays }: { streakDays: number }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <SheetHeader icon="fire" eyebrow="Consistency" title={`${streakDays} day streak`} />
      <View style={[styles.streakPanel, { backgroundColor: colors.accentSoft }]}>
        <Text style={[typography.display, { color: colors.accent }]}>{streakDays}</Text>
        <Text style={[typography.body, { color: colors.textPrimary }]}>
          The streak stays alive if the last completed workout was today or yesterday.
        </Text>
      </View>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Streaks should motivate consistency, not punish planned rest days. Once persistence lands,
        rest days can preserve the chain when they are part of the program.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  streakPanel: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
});
