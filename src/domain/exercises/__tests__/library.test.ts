import { EXERCISE_CATALOG, getExercise } from '../catalog';
import {
  BROWSABLE_EXERCISE_LIBRARY,
  CATALOG_IMAGE_OVERRIDES,
  EXERCISE_LIBRARY,
  loggableExerciseForReference,
  referenceExerciseForCatalog,
  referenceImageUrl,
  REFERENCE_TO_CATALOG_ID,
  searchLibrary,
  workoutReadyLibrary,
} from '../library';

describe('reference library mapping', () => {
  it('maps only explicitly reviewed reference entries to valid canonical exercises', () => {
    for (const [referenceId, catalogId] of Object.entries(REFERENCE_TO_CATALOG_ID)) {
      const reference = EXERCISE_LIBRARY.find((exercise) => exercise.id === referenceId);
      expect(reference).toBeDefined();
      expect(getExercise(catalogId)?.id).toBe(catalogId);
      expect(reference && loggableExerciseForReference(reference)?.id).toBe(catalogId);
    }
  });

  it('points every catalog image override at a real catalog exercise and a real reference entry', () => {
    for (const [catalogId, referenceId] of Object.entries(CATALOG_IMAGE_OVERRIDES)) {
      expect(getExercise(catalogId)?.id).toBe(catalogId);
      expect(EXERCISE_LIBRARY.some((exercise) => exercise.id === referenceId)).toBe(true);
    }
  });

  it('keeps an unmapped reference entry explicitly reference-only', () => {
    const referenceOnly = EXERCISE_LIBRARY.find(
      (exercise) => loggableExerciseForReference(exercise) == null,
    );

    expect(referenceOnly).toBeDefined();
    expect(referenceOnly && loggableExerciseForReference(referenceOnly)).toBeNull();
  });

  it('prefers pinned RepDB visuals for reviewed catalog exercises', () => {
    const mapped = getExercise('barbell-back-squat');
    const exactName = getExercise('goblet-squat');

    expect(mapped && referenceExerciseForCatalog(mapped)?.id).toBe('catalog:barbell-back-squat');
    expect(mapped && referenceExerciseForCatalog(mapped)?.images[0]).toContain(
      '9ed9357f09c7566ea0256c57ebd6374ebb8b575e',
    );
    expect(exactName && referenceExerciseForCatalog(exactName)?.id).toBe('catalog:goblet-squat');
  });

  it('uses the weighted-dip demonstration for the loaded chest-dip variation', () => {
    const weightedDips = getExercise('Weighted Dips');
    expect(weightedDips && referenceExerciseForCatalog(weightedDips)?.images).toEqual(
      expect.arrayContaining([expect.stringContaining('weighted-dips-start.webp')]),
    );
  });

  it('pins every upstream image URL to the reviewed dataset commit', () => {
    expect(
      referenceImageUrl(
        'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg',
      ),
    ).toContain('a859101d633a01c4a1a920d6a8ce41dabba0705f');
  });

  it('finds reviewed catalog supplements and mapped aliases from the exercise library', () => {
    const bayesian = searchLibrary('Bayesian curls', null);
    const weightedDips = searchLibrary('weighted dips', null);

    expect(bayesian).toHaveLength(1);
    expect(loggableExerciseForReference(bayesian[0])?.id).toBe('bayesian-cable-curl');
    expect(bayesian[0].images).toEqual([]);
    expect(loggableExerciseForReference(weightedDips[0])?.id).toBe('dip');
    expect(BROWSABLE_EXERCISE_LIBRARY).toContainEqual(bayesian[0]);
  });

  it('represents every curated catalog exercise exactly once as a workout-ready library entry', () => {
    const workoutReady = workoutReadyLibrary(BROWSABLE_EXERCISE_LIBRARY);
    for (const catalogExercise of EXERCISE_CATALOG) {
      const matches = workoutReady.filter(
        (reference) => loggableExerciseForReference(reference)?.id === catalogExercise.id,
      );
      expect({ exercise: catalogExercise.id, matches: matches.length }).toEqual({
        exercise: catalogExercise.id,
        matches: 1,
      });
    }
  });
});
