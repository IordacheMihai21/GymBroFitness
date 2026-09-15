import type { Slug } from 'react-native-body-highlighter';

import type { MuscleGroup } from '@/types';
import type { VolumeZone } from '@/domain/workouts/volumeLandmarks';

export type BodySide = 'front' | 'back';
export type RankTier = 'S' | 'A' | 'B' | 'C' | 'Unranked';
export type MuscleHeatKey = 'dormant' | 'ready' | 'growth' | 'loaded' | 'excessive';

export const DEFAULT_MUSCLE: MuscleGroup = 'chest';

export const MUSCLE_BODY_SLUGS: Record<MuscleGroup, Slug[]> = {
  chest: ['chest'],
  back: ['upper-back', 'trapezius'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  quadriceps: ['quadriceps', 'adductors'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'tibialis'],
  abs: ['abs', 'obliques'],
  lower_back: ['lower-back'],
};

export const PRIMARY_BODY_SLUG: Record<MuscleGroup, Slug> = {
  chest: 'chest',
  back: 'upper-back',
  shoulders: 'deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  abs: 'abs',
  lower_back: 'lower-back',
};

export const MUSCLE_BODY_SIDES: Record<MuscleGroup, BodySide[]> = {
  chest: ['front'],
  back: ['back'],
  shoulders: ['front', 'back'],
  biceps: ['front'],
  triceps: ['front', 'back'],
  forearms: ['front', 'back'],
  quadriceps: ['front'],
  hamstrings: ['back'],
  glutes: ['back'],
  calves: ['front', 'back'],
  abs: ['front'],
  lower_back: ['back'],
};

export const BODY_HEAT_COLORS: Record<MuscleHeatKey, string> = {
  dormant: '#354156',
  ready: '#38BDF8',
  growth: '#1F73FF',
  loaded: '#9B5CFF',
  excessive: '#FF4D7D',
};

export const BODY_HEAT_LEGEND: { key: MuscleHeatKey; color: string; label: string }[] = [
  { key: 'dormant', color: BODY_HEAT_COLORS.dormant, label: 'Low' },
  { key: 'ready', color: BODY_HEAT_COLORS.ready, label: 'Ready' },
  { key: 'growth', color: BODY_HEAT_COLORS.growth, label: 'Growth' },
  { key: 'loaded', color: BODY_HEAT_COLORS.loaded, label: 'Loaded' },
  { key: 'excessive', color: BODY_HEAT_COLORS.excessive, label: 'Overreach' },
];

export const RANK_TIER_COLORS: Record<RankTier, string> = {
  S: '#F7C948',
  A: '#9B5CFF',
  B: '#38BDF8',
  C: '#8B96AD',
  Unranked: '#626E88',
};

const SLUG_TO_MUSCLE = Object.entries(MUSCLE_BODY_SLUGS).reduce(
  (map, [muscle, slugs]) => {
    for (const slug of slugs) map[slug] = muscle as MuscleGroup;
    return map;
  },
  {} as Partial<Record<Slug, MuscleGroup>>,
);

export function bodySlugsForMuscle(muscle: MuscleGroup): Slug[] {
  return MUSCLE_BODY_SLUGS[muscle];
}

export function primaryBodySlugForMuscle(muscle: MuscleGroup): Slug {
  return PRIMARY_BODY_SLUG[muscle];
}

export function muscleFromBodySlug(slug: Slug): MuscleGroup | null {
  return SLUG_TO_MUSCLE[slug] ?? null;
}

export function bodySidesForMuscle(muscle: MuscleGroup): BodySide[] {
  return MUSCLE_BODY_SIDES[muscle];
}

export function defaultMuscleForBodySide(side: BodySide): MuscleGroup {
  return side === 'front' ? 'chest' : 'back';
}

export function heatKeyForVolumeZone(zone: VolumeZone): MuscleHeatKey {
  switch (zone) {
    case 'below_mv':
      return 'dormant';
    case 'maintenance':
      return 'ready';
    case 'growth':
      return 'growth';
    case 'frontier':
      return 'loaded';
    case 'excessive':
      return 'excessive';
  }
}

export function heatKeyForFatigue(score: number, zone: VolumeZone): MuscleHeatKey {
  if (zone === 'excessive' || score >= 84) return 'excessive';
  if (zone === 'frontier' || score >= 72) return 'loaded';
  if (zone === 'growth' || score >= 48) return 'growth';
  if (score >= 18 || zone === 'maintenance') return 'ready';
  return 'dormant';
}

export function heatColorForVolumeZone(zone: VolumeZone): string {
  return BODY_HEAT_COLORS[heatKeyForVolumeZone(zone)];
}

export function heatColorForFatigue(score: number, zone: VolumeZone): string {
  return BODY_HEAT_COLORS[heatKeyForFatigue(score, zone)];
}

export function bodyIntensityForFatigue({
  score,
  zone,
  hasSignal,
}: {
  score: number;
  zone: VolumeZone;
  hasSignal: boolean;
}): number {
  if (zone === 'excessive' || score >= 84) return 4;
  if (zone === 'frontier' || score >= 72) return 4;
  if (zone === 'growth' || score >= 48) return 3;
  if (score >= 18 || zone === 'maintenance') return 2;
  if (hasSignal) return 1;
  return 0;
}

export function shortVolumeZoneLabel(zone: VolumeZone): string {
  switch (zone) {
    case 'below_mv':
      return 'Below MV';
    case 'maintenance':
      return 'Maintenance';
    case 'growth':
      return 'Growth zone';
    case 'frontier':
      return 'Frontier';
    case 'excessive':
      return 'Excessive';
  }
}
