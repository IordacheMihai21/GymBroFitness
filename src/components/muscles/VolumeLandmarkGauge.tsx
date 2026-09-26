import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BODY_HEAT_COLORS, heatColorForVolumeZone } from '@/domain/muscles/muscleMap';
import type { VolumeLandmarks, VolumeZone } from '@/domain/workouts/volumeLandmarks';
import { useTheme } from '@/theme';

type GaugeSegment = { key: string; color: string; startPct: number; widthPct: number };

function buildVolumeGaugeSegments(landmarks: VolumeLandmarks, domainMax: number): GaugeSegment[] {
  const bounds: [number, number, string][] = [
    [0, landmarks.mv, BODY_HEAT_COLORS.dormant],
    [landmarks.mv, landmarks.mev, BODY_HEAT_COLORS.ready],
    [landmarks.mev, landmarks.mav, BODY_HEAT_COLORS.growth],
    [landmarks.mav, landmarks.mrv, BODY_HEAT_COLORS.loaded],
    [landmarks.mrv, domainMax, BODY_HEAT_COLORS.excessive],
  ];
  return bounds
    .filter(([start, end]) => end > start)
    .map(([start, end, color], index) => ({
      key: String(index),
      color,
      startPct: (start / domainMax) * 100,
      widthPct: ((end - start) / domainMax) * 100,
    }));
}

/**
 * Segmented MEV/MAV/MRV reference gauge with a marker at the current weekly
 * set count — shared by Body, Plan, and Progress so the same volume data
 * reads the same way everywhere, rather than each screen's own flat
 * single-color progress bar (which couldn't distinguish below-MV from
 * exactly-at-MEV, since both render as an empty bar).
 */
export function VolumeLandmarkGauge({
  landmarks,
  weeklySets,
  zone,
}: {
  landmarks: VolumeLandmarks;
  weeklySets: number;
  zone: VolumeZone;
}) {
  const { colors } = useTheme();
  const domainMax = Math.max(landmarks.mrv * 1.08, weeklySets * 1.05, 1);
  const segments = useMemo(
    () => buildVolumeGaugeSegments(landmarks, domainMax),
    [landmarks, domainMax],
  );
  const markerColor = heatColorForVolumeZone(zone);
  const markerPct = Math.min(98, Math.max(2, (weeklySets / domainMax) * 100));

  return (
    <View style={styles.gaugeWrap}>
      <View style={[styles.gaugeTrack, { backgroundColor: colors.surfacePressed }]}>
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.gaugeSegment,
              {
                left: `${segment.startPct}%`,
                width: `${segment.widthPct}%`,
                backgroundColor: withAlpha(segment.color, '38'),
              },
            ]}
          />
        ))}
      </View>
      <View
        style={[
          styles.gaugeMarker,
          { left: `${markerPct}%`, backgroundColor: markerColor, borderColor: colors.surface },
        ]}
      />
    </View>
  );
}

function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}

const styles = StyleSheet.create({
  gaugeWrap: {
    height: 18,
    justifyContent: 'center',
  },
  gaugeTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  gaugeSegment: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },
  gaugeMarker: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 18,
    borderRadius: 2,
    borderWidth: 1.5,
    transform: [{ translateX: -2 }],
  },
});
