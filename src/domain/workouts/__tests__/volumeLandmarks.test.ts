import { classifyWeeklyVolume, classifyWeeklyVolumeByMuscle } from '../volumeLandmarks';

describe('classifyWeeklyVolume', () => {
  it('flags below-maintenance volume', () => {
    expect(classifyWeeklyVolume('chest', 2).zone).toBe('below_mv');
  });

  it('flags maintenance-only volume', () => {
    expect(classifyWeeklyVolume('chest', 6).zone).toBe('maintenance');
  });

  it('flags the growth zone between MEV and MAV', () => {
    expect(classifyWeeklyVolume('chest', 12).zone).toBe('growth');
  });

  it('flags the frontier zone between MAV and MRV', () => {
    expect(classifyWeeklyVolume('chest', 20).zone).toBe('frontier');
  });

  it('flags excessive volume past MRV', () => {
    expect(classifyWeeklyVolume('chest', 30).zone).toBe('excessive');
  });

  it('keeps gaugeFraction non-negative even under MEV', () => {
    expect(classifyWeeklyVolume('chest', 0).gaugeFraction).toBe(0);
  });
});

describe('classifyWeeklyVolumeByMuscle', () => {
  it('classifies every muscle present and sorts by fullest gauge first', () => {
    const result = classifyWeeklyVolumeByMuscle({ chest: 20, biceps: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].muscle).toBe('chest');
    expect(result[1].muscle).toBe('biceps');
  });
});
