import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pill } from '@/components/ui/Pill';
import {
  deleteBodyMeasurement,
  deleteProgressPhoto,
  listBodyMeasurements,
  listProgressPhotos,
  saveBodyMeasurement,
  saveProgressPhoto,
} from '@/domain/body/bodyTrackingStore';
import {
  createBodyMeasurementEntry,
  latestMeasurementDeltas,
  MEASUREMENT_SITES,
  MEASUREMENT_SITE_LABELS,
  sortMeasurementsByDateDesc,
  type BodyMeasurementEntry,
  type MeasurementSite,
} from '@/domain/body/measurements';
import {
  createProgressPhoto,
  PHOTO_POSES,
  PHOTO_POSE_LABELS,
  sortPhotosByDateDesc,
  type PhotoPose,
  type ProgressPhoto,
} from '@/domain/body/progressPhotos';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import {
  captureProgressPhoto,
  deleteStoredProgressPhoto,
  pickProgressPhotoFromLibrary,
} from '@/services/media/progressPhotoStorage';
import { inputTheme, useTheme } from '@/theme';
import { formatDate, toDateOnly } from '@/utils/dates';
import { displayLoad, loadInputToKg, parseDecimalInput, unitLabel } from '@/utils/units';

/** Today in the phone's time zone; a weigh-in at 01:00 belongs to today, not to UTC's yesterday. */
function todayDate(): string {
  return toDateOnly(new Date());
}

export default function BodyLogScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, preferences } = useTrainingProfile();

  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightText, setWeightText] = useState('');
  const [measurementTexts, setMeasurementTexts] = useState<
    Partial<Record<MeasurementSite, string>>
  >({});
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [poseDialog, setPoseDialog] = useState<{ localUri: string } | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextEntries, nextPhotos] = await Promise.all([
      listBodyMeasurements(),
      listProgressPhotos(),
    ]);
    setEntries(sortMeasurementsByDateDesc(nextEntries));
    setPhotos(sortPhotosByDateDesc(nextPhotos));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const deltas = latestMeasurementDeltas(entries);

  async function saveEntry() {
    setSaving(true);
    setError(null);
    try {
      const bodyWeightKg =
        weightText.trim().length > 0 ? loadInputToKg(weightText, preferences.units) : null;
      const measurementsCm: Partial<Record<MeasurementSite, number>> = {};
      for (const site of MEASUREMENT_SITES) {
        const value = parseDecimalInput(measurementTexts[site] ?? '');
        if (value != null) measurementsCm[site] = value;
      }
      if (bodyWeightKg == null && Object.keys(measurementsCm).length === 0) {
        setError('Enter a weight or at least one measurement.');
        return;
      }

      const entry = createBodyMeasurementEntry({
        userId: user.id,
        date: todayDate(),
        bodyWeightKg,
        measurementsCm,
      });
      await saveBodyMeasurement(entry);
      setWeightText('');
      setMeasurementTexts({});
      setShowMeasurements(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteEntry() {
    if (!deleteEntryId) return;
    await deleteBodyMeasurement(deleteEntryId);
    setDeleteEntryId(null);
    await load();
  }

  async function addPhoto(source: 'library' | 'camera') {
    setPhotoMenuVisible(false);
    const result =
      source === 'library' ? await pickProgressPhotoFromLibrary() : await captureProgressPhoto();
    if (!result.ok) {
      if (result.reason === 'permission_denied') {
        setError(
          source === 'library'
            ? 'Photo library permission was denied.'
            : 'Camera permission was denied.',
        );
      }
      return;
    }
    setPoseDialog({ localUri: result.localUri });
  }

  async function confirmPose(pose: PhotoPose | null) {
    if (!poseDialog) return;
    const photo = createProgressPhoto({
      userId: user.id,
      takenAt: todayDate(),
      localUri: poseDialog.localUri,
      pose,
    });
    await saveProgressPhoto(photo);
    setPoseDialog(null);
    await load();
  }

  async function confirmDeletePhoto() {
    if (!deletePhotoId) return;
    const photo = photos.find((p) => p.id === deletePhotoId);
    await deleteProgressPhoto(deletePhotoId);
    if (photo) deleteStoredProgressPhoto(photo.localUri);
    setDeletePhotoId(null);
    await load();
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: spacing.lg,
        paddingBottom: insets.bottom + spacing.xxl,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Saved only on this device. Photos never leave your phone.
      </Text>

      <View style={{ gap: spacing.md }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Log today</Text>

        <TextInput
          theme={inputTheme}
          mode="outlined"
          label={`Weight (${unitLabel(preferences.units)})`}
          value={weightText}
          onChangeText={setWeightText}
          keyboardType="decimal-pad"
          textColor={colors.textPrimary}
          outlineColor={colors.border}
          activeOutlineColor={colors.accent}
          style={{ backgroundColor: colors.background }}
        />

        <Button
          mode="text"
          icon={showMeasurements ? 'chevron-up' : 'chevron-down'}
          onPress={() => setShowMeasurements((v) => !v)}
        >
          {showMeasurements ? 'Hide measurements' : 'Add measurements (cm)'}
        </Button>

        {showMeasurements ? (
          <View style={styles.measurementGrid}>
            {MEASUREMENT_SITES.map((site) => (
              <TextInput
                theme={inputTheme}
                key={site}
                mode="outlined"
                dense
                label={MEASUREMENT_SITE_LABELS[site]}
                value={measurementTexts[site] ?? ''}
                onChangeText={(text) => setMeasurementTexts((prev) => ({ ...prev, [site]: text }))}
                keyboardType="decimal-pad"
                textColor={colors.textPrimary}
                outlineColor={colors.border}
                activeOutlineColor={colors.accent}
                style={[styles.measurementInput, { backgroundColor: colors.background }]}
              />
            ))}
          </View>
        ) : null}

        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}

        <Button mode="contained" loading={saving} disabled={saving} onPress={saveEntry}>
          Save entry
        </Button>
      </View>

      {deltas.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Since last entry</Text>
          {deltas.map((delta) => (
            <View key={delta.site} style={styles.deltaRow}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {delta.site === 'bodyWeight' ? 'Weight' : MEASUREMENT_SITE_LABELS[delta.site]}
              </Text>
              <Text
                style={[
                  typography.numeric,
                  { color: delta.deltaValue === 0 ? colors.textMuted : colors.textPrimary },
                ]}
              >
                {delta.deltaValue > 0 ? '+' : ''}
                {delta.deltaValue.toFixed(1)}
                {delta.site === 'bodyWeight' ? ` ${unitLabel(preferences.units)}` : ' cm'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Progress photos</Text>
          <Menu
            visible={photoMenuVisible}
            onDismiss={() => setPhotoMenuVisible(false)}
            anchor={
              <Button compact mode="text" onPress={() => setPhotoMenuVisible(true)}>
                Add photo
              </Button>
            }
          >
            <Menu.Item title="Choose from library" onPress={() => void addPhoto('library')} />
            <Menu.Item title="Take a photo" onPress={() => void addPhoto('camera')} />
          </Menu>
        </View>

        {photos.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No progress photos yet.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {photos.map((photo) => (
                <View key={photo.id} style={{ alignItems: 'center', gap: 4 }}>
                  <Image
                    source={{ uri: photo.localUri }}
                    style={[styles.photoThumb, { borderRadius: radius.md }]}
                    contentFit="cover"
                  />
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {formatDate(photo.takenAt)}
                    {photo.pose ? `, ${PHOTO_POSE_LABELS[photo.pose]}` : ''}
                  </Text>
                  <IconButton
                    icon="delete-outline"
                    size={18}
                    iconColor={colors.textMuted}
                    accessibilityLabel="Delete photo"
                    onPress={() => setDeletePhotoId(photo.id)}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>History</Text>
        {!loading && entries.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            No entries yet. Log your first one above.
          </Text>
        ) : (
          entries.map((entry) => (
            <List.Item
              key={entry.id}
              title={formatDate(entry.date)}
              description={
                entry.bodyWeightKg != null
                  ? `${displayLoad(entry.bodyWeightKg, preferences.units)} ${unitLabel(preferences.units)}`
                  : `${Object.keys(entry.measurementsCm).length} measurement(s)`
              }
              titleStyle={[typography.bodyBold, { color: colors.textPrimary }]}
              descriptionStyle={[typography.caption, { color: colors.textMuted }]}
              style={[styles.entryRow, { borderBottomColor: colors.border }]}
              right={(props) => (
                <IconButton
                  {...props}
                  icon="delete-outline"
                  iconColor={colors.textMuted}
                  accessibilityLabel={`Delete entry from ${formatDate(entry.date)}`}
                  onPress={() => setDeleteEntryId(entry.id)}
                />
              )}
            />
          ))
        )}
      </View>

      <Portal>
        <Dialog visible={poseDialog != null} onDismiss={() => setPoseDialog(null)}>
          <Dialog.Title>Which angle is this?</Dialog.Title>
          <Dialog.Content style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PHOTO_POSES.map((pose) => (
              <Pill
                key={pose}
                label={PHOTO_POSE_LABELS[pose]}
                onPress={() => void confirmPose(pose)}
              />
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => void confirmPose(null)}>Skip</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteEntryId != null} onDismiss={() => setDeleteEntryId(null)}>
          <Dialog.Title>Delete this entry?</Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setDeleteEntryId(null)}>Cancel</Button>
            <Button textColor={colors.danger} onPress={() => void confirmDeleteEntry()}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deletePhotoId != null} onDismiss={() => setDeletePhotoId(null)}>
          <Dialog.Title>Delete this photo?</Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setDeletePhotoId(null)}>Cancel</Button>
            <Button textColor={colors.danger} onPress={() => void confirmDeletePhoto()}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  entryRow: {
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  measurementInput: {
    flexBasis: '47%',
  },
  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoThumb: {
    width: 90,
    height: 120,
  },
});
