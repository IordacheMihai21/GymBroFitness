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

  it('preserves corrupt local program payloads for recovery', async () => {
    const raw = '{"version":1,"program":null}';
    await AsyncStorage.setItem('@GymBroFitness/active-program/v1', raw);

    const snapshot = await loadActiveProgram(DEMO_PREFERENCES, DEMO_USER_ID);

    expect(snapshot.source).toBe('generated');
    await expect(AsyncStorage.getItem('@GymBroFitness/active-program/v1')).resolves.toBe(raw);
    await expect(AsyncStorage.getItem('@GymBroFitness/active-program/v1/recovery')).resolves.toBe(
      raw,
    );
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
