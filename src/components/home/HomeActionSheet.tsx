import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { ElementRef, RefObject } from 'react';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { useTheme } from '@/theme';

export type HomeSheet = 'swap' | 'streak';

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
  const { colors, radius, spacing, typography } = useTheme();
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView
        style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.x3l, gap: spacing.md }}
      >
        {activeSheet === 'swap' && (
          <>
            <Text style={[typography.title, { color: colors.textPrimary }]}>
              Switch to {swapLabel}?
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Only today changes. {currentDayName} stays in your week, so use this when equipment is
              taken or something is sore.
            </Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Button mode="contained" onPress={onConfirmSwap} contentStyle={{ minHeight: 52 }}>
                Switch to {swapLabel}
              </Button>
              <Button mode="text" onPress={() => modalRef.current?.dismiss()}>
                Keep {currentDayName}
              </Button>
            </View>
          </>
        )}
        {activeSheet === 'streak' && (
          <>
            <Text style={[typography.jumbo, { color: colors.textPrimary }]}>{streakDays}</Text>
            <Text style={[typography.title, { color: colors.textPrimary }]}>day streak</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Your streak stays alive while your last completed workout was today or yesterday.
            </Text>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
