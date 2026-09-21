import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import WheelPicker from '@quidone/react-native-wheel-picker';
import type { ElementRef, RefObject } from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from 'react-native-paper';

import { RIR_VALUES, formatRir } from '@/domain/workouts/rir';
import { useTheme } from '@/theme';

type RirPickerSheetProps = {
  modalRef: RefObject<ElementRef<typeof BottomSheetModal> | null>;
  /** RIR currently logged for the set being edited, or null if unset. */
  value: number | null;
  onConfirm: (value: number) => void;
  onClear: () => void;
  onDismiss: () => void;
};

export function RirPickerSheet({
  modalRef,
  value,
  onConfirm,
  onClear,
  onDismiss,
}: RirPickerSheetProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [draft, setDraft] = useState(value ?? 2);
  // Reset the draft whenever the target set's RIR changes (a different set was
  // selected, or it was cleared) — the React-recommended way to adjust state in
  // response to a prop change is during render, not inside a useEffect.
  const [trackedValue, setTrackedValue] = useState(value);
  if (value !== trackedValue) {
    setTrackedValue(value);
    setDraft(value ?? 2);
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.52} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={['38%']}
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView
        style={[styles.sheet, { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }]}
      >
        <Text style={[typography.subheading, { color: colors.textPrimary, textAlign: 'center' }]}>
          Reps in reserve
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
          0 = failure · 5 = very easy
        </Text>

        <WheelPicker
          data={RIR_VALUES.map((v) => ({ value: v, label: formatRir(v) }))}
          value={draft}
          onValueChanged={({ item }) => setDraft(item.value)}
          itemHeight={40}
          visibleItemCount={5}
          width="60%"
          itemTextStyle={[typography.heading, { color: colors.textPrimary }]}
          overlayItemStyle={[
            styles.overlayItem,
            { backgroundColor: colors.accentSoft, borderRadius: radius.md },
          ]}
        />

        <Button mode="contained" onPress={() => onConfirm(draft)} style={{ marginTop: spacing.sm }}>
          Set RIR {formatRir(draft)}
        </Button>
        <Button mode="text" onPress={onClear}>
          Not sure · leave RIR empty
        </Button>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  overlayItem: {
    marginHorizontal: 8,
  },
});
