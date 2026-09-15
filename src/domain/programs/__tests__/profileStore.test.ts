import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_PREFERENCES } from '../demoPreferences';
import {
  DEFAULT_TRAINING_PROFILE,
  loadTrainingProfile,
  resetTrainingProfile,
  saveTrainingProfile,
  updateTrainingProfile,
} from '../profileStore';

describe('profileStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('falls back to the demo training profile when no local profile exists', async () => {
    await expect(loadTrainingProfile()).resolves.toEqual(DEFAULT_TRAINING_PROFILE);
  });

  it('saves and reloads a local profile', async () => {
    const saved = await saveTrainingProfile({
      user: {
        id: 'local-user',
        displayName: 'Mihai',
        createdAt: '2026-09-15T00:00:00.000Z',
        onboardingCompleted: true,
      },
      preferences: {
        ...DEMO_PREFERENCES,
        daysPerWeek: 5,
        sessionMinutes: 75,
        coachingTone: 'science',
      },
    });

    expect(saved.source).toBe('local');
    await expect(loadTrainingProfile()).resolves.toMatchObject({
      source: 'local',
      user: { id: 'local-user', displayName: 'Mihai' },
      preferences: { daysPerWeek: 5, sessionMinutes: 75, coachingTone: 'science' },
    });
  });

  it('updates profile fields without replacing the whole object', async () => {
    const updated = await updateTrainingProfile({
      user: { displayName: 'Alex Pro' },
      preferences: { units: 'lb', musclePriorities: ['chest', 'shoulders', 'biceps'] },
    });

    expect(updated.user.displayName).toBe('Alex Pro');
    expect(updated.preferences.units).toBe('lb');
    expect(updated.preferences.daysPerWeek).toBe(DEMO_PREFERENCES.daysPerWeek);
    expect(updated.preferences.musclePriorities).toEqual(['chest', 'shoulders', 'biceps']);
  });

  it('clears corrupt local payloads and returns fallback', async () => {
    await AsyncStorage.setItem('@GymBroFitness/training-profile/v1', '{"version":1,"user":null}');
    await expect(loadTrainingProfile()).resolves.toEqual(DEFAULT_TRAINING_PROFILE);
    await expect(AsyncStorage.getItem('@GymBroFitness/training-profile/v1')).resolves.toBeNull();
  });

  it('can reset to fallback explicitly', async () => {
    await updateTrainingProfile({ user: { displayName: 'Temporary' } });
    await expect(resetTrainingProfile()).resolves.toEqual(DEFAULT_TRAINING_PROFILE);
    await expect(loadTrainingProfile()).resolves.toEqual(DEFAULT_TRAINING_PROFILE);
  });
});
