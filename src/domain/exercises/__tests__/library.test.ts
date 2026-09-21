import { getExercise } from '../catalog';
import {
  EXERCISE_LIBRARY,
  loggableExerciseForReference,
  REFERENCE_TO_CATALOG_ID,
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

  it('keeps an unmapped reference entry explicitly reference-only', () => {
    const referenceOnly = EXERCISE_LIBRARY.find(
      (exercise) => REFERENCE_TO_CATALOG_ID[exercise.id] == null,
    );

    expect(referenceOnly).toBeDefined();
    expect(referenceOnly && loggableExerciseForReference(referenceOnly)).toBeNull();
  });
});
