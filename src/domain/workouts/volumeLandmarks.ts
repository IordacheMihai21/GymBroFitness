import type { MuscleGroup } from '@/types';

/**
 * Weekly hard-set volume landmarks (MV/MEV/MAV/MRV) per muscle group, in the
 * style popularized by Renaissance Periodization: the minimum to maintain
 * size, the minimum effective dose to grow, the zone that produces the best
 * return, and the recoverable ceiling before junk volume. Ranges below are
 * commonly published approximations for an intermediate/advanced natural
 * lifter — they are a starting point for autoregulation, not a hard rule,
 * which is why the classifier always returns a zone alongside the raw
 * landmark numbers rather than a pass/fail verdict.
 */
export type VolumeLandmarks = {
  /** Maintenance volume: enough to keep the muscle, not enough to grow it. */
  mv: number;
  /** Minimum effective volume: the floor for new growth. */
  mev: number;
  /** Maximum adaptive volume: the top of the best-return zone. */
  mav: number;
  /** Maximum recoverable volume: the recoverable ceiling. */
  mrv: number;
};

export const VOLUME_LANDMARKS: Record<MuscleGroup, VolumeLandmarks> = {
  chest: { mv: 4, mev: 8, mav: 18, mrv: 22 },
  back: { mv: 6, mev: 10, mav: 20, mrv: 28 },
  shoulders: { mv: 6, mev: 8, mav: 20, mrv: 26 },
  biceps: { mv: 4, mev: 6, mav: 18, mrv: 26 },
  triceps: { mv: 4, mev: 6, mav: 12, mrv: 18 },
  forearms: { mv: 0, mev: 2, mav: 12, mrv: 20 },
  quadriceps: { mv: 6, mev: 8, mav: 16, mrv: 20 },
  hamstrings: { mv: 4, mev: 6, mav: 14, mrv: 20 },
  glutes: { mv: 0, mev: 4, mav: 10, mrv: 16 },
  calves: { mv: 6, mev: 8, mav: 14, mrv: 20 },
  abs: { mv: 0, mev: 6, mav: 18, mrv: 25 },
  lower_back: { mv: 0, mev: 4, mav: 8, mrv: 12 },
};

export type VolumeZone = 'below_mv' | 'maintenance' | 'growth' | 'frontier' | 'excessive';

export type VolumeClassification = {
  muscle: MuscleGroup;
  weeklySets: number;
  landmarks: VolumeLandmarks;
  zone: VolumeZone;
  /** 0-1+ position of weeklySets between mev (0) and mrv (1), clamped for a gauge UI. */
  gaugeFraction: number;
};

const ZONE_LABELS: Record<VolumeZone, string> = {
  below_mv: 'Below maintenance',
  maintenance: 'Maintaining, not growing',
  growth: 'Growth zone',
  frontier: 'Frontier — watch recovery',
  excessive: 'Excessive — likely junk volume',
};

export function volumeZoneLabel(zone: VolumeZone): string {
  return ZONE_LABELS[zone];
}

export function classifyWeeklyVolume(muscle: MuscleGroup, weeklySets: number): VolumeClassification {
  const landmarks = VOLUME_LANDMARKS[muscle];
  let zone: VolumeZone;
  if (weeklySets < landmarks.mv) zone = 'below_mv';
  else if (weeklySets < landmarks.mev) zone = 'maintenance';
  else if (weeklySets <= landmarks.mav) zone = 'growth';
  else if (weeklySets <= landmarks.mrv) zone = 'frontier';
  else zone = 'excessive';

  const span = Math.max(1, landmarks.mrv - landmarks.mev);
  const gaugeFraction = Math.max(0, (weeklySets - landmarks.mev) / span);

  return { muscle, weeklySets, landmarks, zone, gaugeFraction };
}

export function classifyWeeklyVolumeByMuscle(
  setsByMuscle: Partial<Record<MuscleGroup, number>>,
): VolumeClassification[] {
  return (Object.entries(setsByMuscle) as [MuscleGroup, number][])
    .map(([muscle, weeklySets]) => classifyWeeklyVolume(muscle, weeklySets))
    .sort((a, b) => b.gaugeFraction - a.gaugeFraction);
}
