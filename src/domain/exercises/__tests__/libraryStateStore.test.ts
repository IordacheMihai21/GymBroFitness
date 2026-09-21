import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EMPTY_EXERCISE_LIBRARY_STATE,
  loadExerciseLibraryState,
  recordRecentExercise,
  toggleExerciseFavorite,
} from '../libraryStateStore';

describe('exercise library state', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists favorites and keeps recent items unique and newest first', async () => {
    await toggleExerciseFavorite('Barbell_Squat');
    await recordRecentExercise('Barbell_Squat');
    await recordRecentExercise('Plank');
    await recordRecentExercise('Barbell_Squat');

    await expect(loadExerciseLibraryState()).resolves.toMatchObject({
      favoriteIds: ['Barbell_Squat'],
      recentIds: ['Barbell_Squat', 'Plank'],
    });
  });

  it('preserves an invalid payload for recovery', async () => {
    const raw = '{"version":1,"favoriteIds":"bad"}';
    await AsyncStorage.setItem('@GymBroFitness/exercise-library-state/v1', raw);

    await expect(loadExerciseLibraryState()).resolves.toEqual(EMPTY_EXERCISE_LIBRARY_STATE);
    await expect(
      AsyncStorage.getItem('@GymBroFitness/exercise-library-state/v1/recovery'),
    ).resolves.toBe(raw);
  });
});
