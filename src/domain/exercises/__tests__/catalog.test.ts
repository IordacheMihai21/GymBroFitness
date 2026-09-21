import type { Exercise } from '@/types';

import {
  availableExercises,
  canonicalExerciseId,
  EXERCISE_CATALOG,
  getExercise,
  isExerciseAvailable,
} from '../catalog';

describe('exercise catalog integrity', () => {
  it('contains 80–120 exercises', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(80);
    expect(EXERCISE_CATALOG.length).toBeLessThanOrEqual(120);
  });

  it('has unique slugs and ids', () => {
    const slugs = EXERCISE_CATALOG.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every alternative slug references a real exercise', () => {
    const slugs = new Set(EXERCISE_CATALOG.map((e) => e.slug));
    for (const e of EXERCISE_CATALOG) {
      const refs = [...e.easierAlternatives, ...e.harderAlternatives, ...e.equivalentAlternatives];
      for (const ref of refs) {
        expect({ exercise: e.slug, ref, exists: slugs.has(ref) }).toEqual({
          exercise: e.slug,
          ref,
          exists: true,
        });
      }
    }
  });

  it('every exercise has complete coaching content', () => {
    for (const e of EXERCISE_CATALOG) {
      expect(e.instructions.length).toBeGreaterThanOrEqual(1);
      expect(e.commonMistakes.length).toBeGreaterThanOrEqual(1);
      expect(e.scienceExplanation.length).toBeGreaterThan(20);
      expect(e.progressionInstructions.length).toBeGreaterThan(10);
      expect(e.primaryMuscles.length).toBeGreaterThanOrEqual(1);
      expect(e.equipment.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('covers all major movement patterns', () => {
    const patterns = new Set(EXERCISE_CATALOG.map((e) => e.movementPattern));
    for (const pattern of [
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
      'squat',
      'hip_hinge',
      'knee_flexion',
      'elbow_flexion',
      'elbow_extension',
      'shoulder_abduction',
      'calf_raise',
      'ab_flexion',
      'anti_extension',
      'lunge',
    ]) {
      expect(patterns.has(pattern as Exercise['movementPattern'])).toBe(true);
    }
  });

  it('resolves stable ids, slugs, names, and unambiguous legacy aliases canonically', () => {
    expect(canonicalExerciseId('barbell-bench-press')).toBe('barbell-bench-press');
    expect(canonicalExerciseId('Barbell Bench Press')).toBe('barbell-bench-press');
    expect(canonicalExerciseId('Flat Bench Press')).toBe('barbell-bench-press');
    expect(getExercise('flat_bench_press')?.name).toBe('Barbell Bench Press');
    expect(canonicalExerciseId('not-a-real-exercise')).toBeNull();
  });
});

describe('equipment filtering', () => {
  it('bodyweight-only users get only band/bodyweight exercises', () => {
    const pool = availableExercises(['bodyweight', 'resistance_band']);
    expect(pool.length).toBeGreaterThan(10);
    for (const e of pool) {
      expect(e.equipment.some((eq) => eq === 'bodyweight' || eq === 'resistance_band')).toBe(true);
    }
    expect(pool.some((e) => e.slug === 'barbell-bench-press')).toBe(false);
  });

  it('requires supporting equipment (bench, rack) in addition to the implement', () => {
    const benchPress = EXERCISE_CATALOG.find((e) => e.slug === 'barbell-bench-press')!;
    expect(isExerciseAvailable(benchPress, ['barbell'])).toBe(false);
    expect(isExerciseAvailable(benchPress, ['barbell', 'bench', 'squat_rack'])).toBe(true);
  });

  it('adjustable dumbbells satisfy dumbbell requirements', () => {
    const dbPress = EXERCISE_CATALOG.find((e) => e.slug === 'dumbbell-bench-press')!;
    expect(isExerciseAvailable(dbPress, ['adjustable_dumbbell', 'bench'])).toBe(true);
  });

  it('excluded slugs never appear', () => {
    const pool = availableExercises(
      ['barbell', 'bench', 'squat_rack', 'dumbbell', 'bodyweight'],
      ['barbell-bench-press', 'push-up'],
    );
    expect(pool.some((e) => e.slug === 'barbell-bench-press')).toBe(false);
    expect(pool.some((e) => e.slug === 'push-up')).toBe(false);
  });
});
