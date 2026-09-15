import { MUSCLE_GROUPS } from '@/types';

import {
  bodySidesForMuscle,
  bodySlugsForMuscle,
  defaultMuscleForBodySide,
  heatKeyForFatigue,
  heatKeyForVolumeZone,
  muscleFromBodySlug,
  primaryBodySlugForMuscle,
  shortVolumeZoneLabel,
} from '../muscleMap';

describe('muscleMap', () => {
  it('maps every app muscle to at least one body-highlighter slug', () => {
    for (const muscle of MUSCLE_GROUPS) {
      expect(bodySlugsForMuscle(muscle).length).toBeGreaterThan(0);
      expect(bodySlugsForMuscle(muscle)).toContain(primaryBodySlugForMuscle(muscle));
    }
  });

  it('can reverse every configured body slug back to its app muscle', () => {
    for (const muscle of MUSCLE_GROUPS) {
      for (const slug of bodySlugsForMuscle(muscle)) {
        expect(muscleFromBodySlug(slug)).toBe(muscle);
      }
    }
  });

  it('keeps each muscle on at least one body side', () => {
    for (const muscle of MUSCLE_GROUPS) {
      expect(bodySidesForMuscle(muscle).length).toBeGreaterThan(0);
    }
    expect(defaultMuscleForBodySide('front')).toBe('chest');
    expect(defaultMuscleForBodySide('back')).toBe('back');
  });

  it('normalizes science zones into product heat states', () => {
    expect(heatKeyForVolumeZone('below_mv')).toBe('dormant');
    expect(heatKeyForVolumeZone('maintenance')).toBe('ready');
    expect(heatKeyForVolumeZone('growth')).toBe('growth');
    expect(heatKeyForVolumeZone('frontier')).toBe('loaded');
    expect(heatKeyForVolumeZone('excessive')).toBe('excessive');
  });

  it('lets fatigue override a low weekly volume zone', () => {
    expect(heatKeyForFatigue(12, 'below_mv')).toBe('dormant');
    expect(heatKeyForFatigue(52, 'below_mv')).toBe('growth');
    expect(heatKeyForFatigue(90, 'growth')).toBe('excessive');
  });

  it('uses compact labels for dense mobile UI', () => {
    expect(shortVolumeZoneLabel('below_mv')).toBe('Below MV');
    expect(shortVolumeZoneLabel('frontier')).toBe('Frontier');
  });
});
