import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_PREFERENCES, DEMO_USER_ID } from '../demoPreferences';
import {
  createGeneratedProgramSnapshot,
  loadActiveProgram,
  resetActiveProgram,
  saveActiveProgram,
} from '../programStore';

describe('programStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('generates a program when no local active program exists', async () => {
    const snapshot = await loadActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID);

    expect(snapshot.source).toBe('generated');
    expect(snapshot.program.userId).toBe(DEMO_USER_ID);
    expect(snapshot.program.days.length).toBeGreaterThan(0);
  });

  it('saves and reloads a local active program', async () => {
    const generated = createGeneratedProgramSnapshot(DEMO_PREFERENCES, DEMO_USER_ID).program;
    const renamed = { ...generated, name: 'Edited Plan' };

    await saveActiveProgram(renamed);
    await expect(loadActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID)).resolves.toMatchObject({
      source: 'local',
      program: { name: 'Edited Plan' },
    });
  });

  it('ignores local programs that belong to a different user', async () => {
    const generated = createGeneratedProgramSnapshot(DEMO_PREFERENCES, DEMO_USER_ID).program;
    await saveActiveProgram({ ...generated, userId: 'other-user' });

    const snapshot = await loadActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID);

    expect(snapshot.source).toBe('generated');
    expect(snapshot.program.userId).toBe(DEMO_USER_ID);
  });

  it('clears corrupt local program payloads', async () => {
    await AsyncStorage.setItem('@GymBroFitness/active-program/v1', '{"version":1,"program":null}');

    const snapshot = await loadActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID);

    expect(snapshot.source).toBe('generated');
    await expect(AsyncStorage.getItem('@GymBroFitness/active-program/v1')).resolves.toBeNull();
  });

  it('can reset to generated program explicitly', async () => {
    const generated = createGeneratedProgramSnapshot(DEMO_PREFERENCES, DEMO_USER_ID).program;
    await saveActiveProgram({ ...generated, name: 'Edited Plan' });

    const reset = await resetActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID);

    expect(reset.source).toBe('generated');
    expect(reset.program.name).not.toBe('Edited Plan');
    await expect(loadActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID)).resolves.toMatchObject({
      source: 'generated',
    });
  });
});
