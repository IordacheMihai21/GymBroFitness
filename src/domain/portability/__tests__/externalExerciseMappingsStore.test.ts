import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  externalMappingKey,
  loadExternalExerciseMappings,
  saveExternalExerciseMapping,
} from '../externalExerciseMappingsStore';

describe('external exercise mappings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists source-specific canonical mappings', async () => {
    await saveExternalExerciseMapping('hevy', 'Mystery Press', 'barbell-bench-press');
    await saveExternalExerciseMapping('strong', 'Mystery Press', 'overhead-press');

    await expect(loadExternalExerciseMappings()).resolves.toMatchObject({
      mappings: {
        [externalMappingKey('hevy', 'Mystery Press')]: 'barbell-bench-press',
        [externalMappingKey('strong', 'Mystery Press')]: 'overhead-press',
      },
    });
  });

  it('rejects unknown catalog IDs and preserves corrupt storage', async () => {
    await expect(saveExternalExerciseMapping('hevy', 'Mystery Press', 'not-real')).rejects.toThrow(
      'valid catalog exercise',
    );

    const key = '@GymBroFitness/external-exercise-mappings/v1';
    await AsyncStorage.setItem(key, '{bad');
    await expect(loadExternalExerciseMappings()).resolves.toMatchObject({ mappings: {} });
    await expect(AsyncStorage.getItem(`${key}/recovery`)).resolves.toBe('{bad');
  });
});
