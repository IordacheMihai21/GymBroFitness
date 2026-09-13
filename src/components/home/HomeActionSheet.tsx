import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { ElementRef, RefObject } from 'react';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Icon, List, ProgressBar } from 'react-native-paper';

import { computePreWorkoutStatus, type PreWorkoutLog } from '@/domain/workouts/preRoutine';
import { useTheme } from '@/theme';

export type HomeSheet = 'preFuel' | 'swap' | 'weakPoint' | 'streak';

type SheetModalRef = ElementRef<typeof BottomSheetModal>;

type HomeActionSheetProps = {
  activeSheet: HomeSheet | null;
  modalRef: RefObject<SheetModalRef | null>;
  preWorkoutLog: PreWorkoutLog;
  streakDays: number;
  currentDayName: string;
  swapLabel: string;
  onDismiss: () => void;
  onConfirmSwap: () => void;
};

export function HomeActionSheet({
  activeSheet,
  modalRef,
  preWorkoutLog,
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
        {activeSheet === 'preFuel' && <PreFuelSheet log={preWorkoutLog} />}
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

function PreFuelSheet({ log }: { log: PreWorkoutLog }) {
  const { colors, spacing, typography } = useTheme();
  const status = computePreWorkoutStatus(log);
  const progress = Math.min(1, status.minutesSinceTaken / log.peakWindowMinutes);

  return (
    <View style={{ gap: spacing.lg }}>
      <SheetHeader icon="flash" eyebrow="Pre-routine" title="Fuel window" />
      <View style={{ gap: spacing.sm }}>
        <View style={styles.metricGrid}>
          <Metric label="Dose" value={`${log.doseMg}mg`} />
          <Metric label="Taken" value={`${status.minutesSinceTaken}m ago`} />
          <Metric label="Carbs" value={`${log.carbsLoadedG}g`} />
        </View>
        <ProgressBar
          progress={progress}
          color={colors.accent}
          style={[styles.progress, { backgroundColor: colors.surfacePressed }]}
        />
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {status.atPeak
            ? 'You are in the peak window. Start warmups before the signal fades.'
            : `Peak effect is roughly ${status.minutesToPeak} minutes away. Keep setup tight, then start.`}
        </Text>
      </View>
      <Button mode="outlined" icon="plus" disabled>
        Full pre-routine logging soon
      </Button>
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

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.metric, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
      <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.micro, { color: colors.textMuted }]}>{label}</Text>
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
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  progress: {
    height: 6,
    borderRadius: 999,
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
