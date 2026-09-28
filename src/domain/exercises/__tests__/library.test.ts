import { getExercise } from '../catalog';
import {
  BROWSABLE_EXERCISE_LIBRARY,
  CATALOG_IMAGE_OVERRIDES,
  EXERCISE_LIBRARY,
  loggableExerciseForReference,
  referenceExerciseForCatalog,
  referenceImageUrl,
  REFERENCE_TO_CATALOG_ID,
  searchLibrary,
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
      (exercise) => REFERENCE_TO_CATALOG_ID[exercise.id] == null,
    );

    expect(referenceOnly).toBeDefined();
    expect(referenceOnly && loggableExerciseForReference(referenceOnly)).toBeNull();
  });

  it('resolves reviewed and exact-name visual references for catalog exercises', () => {
    const mapped = getExercise('barbell-back-squat');
    const exactName = getExercise('goblet-squat');
    const withoutReference = getExercise('nordic-curl');

    expect(mapped && referenceExerciseForCatalog(mapped)?.id).toBe('Barbell_Squat');
    expect(mapped && referenceExerciseForCatalog(mapped)?.images[0]).toContain(
      'a859101d633a01c4a1a920d6a8ce41dabba0705f',
    );
    expect(exactName && referenceExerciseForCatalog(exactName)?.id).toBe('Goblet_Squat');
    expect(withoutReference && referenceExerciseForCatalog(withoutReference)).toBeNull();
  });

  it('resolves a catalog-slug image override for variants with no reference entry of their own', () => {
    const deficitPushUp = getExercise('deficit-push-up');
    const machineHipThrust = getExercise('machine-hip-thrust');

    expect(deficitPushUp && referenceExerciseForCatalog(deficitPushUp)?.id).toBe('Pushups');
    expect(machineHipThrust && referenceExerciseForCatalog(machineHipThrust)?.id).toBe(
      'Barbell_Hip_Thrust',
    );
  });

  it('lets two different catalog exercises share one override reference image', () => {
    const hipThrust = getExercise('hip-thrust');
    const machineHipThrust = getExercise('machine-hip-thrust');

    expect(hipThrust && referenceExerciseForCatalog(hipThrust)?.id).toBe(
      machineHipThrust && referenceExerciseForCatalog(machineHipThrust)?.id,
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
});
