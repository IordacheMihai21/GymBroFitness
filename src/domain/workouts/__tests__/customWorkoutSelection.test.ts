import { DEMO_PREFERENCES } from '@/domain/programs/demoPreferences';

import { validateCustomWorkoutSelection } from '../customWorkoutSelection';

describe('custom workout route selection', () => {
  it('accepts available catalog exercises once', () => {
    expect(
      validateCustomWorkoutSelection(
        ['barbell-back-squat', 'barbell-back-squat'],
        DEMO_PREFERENCES,
      ),
    ).toEqual({ ids: ['barbell-back-squat'], issue: null });
  });

  it('rejects discomfort and unavailable-equipment route additions', () => {
    const discomfort = validateCustomWorkoutSelection(['barbell-back-squat'], {
      ...DEMO_PREFERENCES,
      discomfortExerciseSlugs: ['barbell-back-squat'],
    });
    const unavailableEquipment = validateCustomWorkoutSelection(['barbell-back-squat'], {
      ...DEMO_PREFERENCES,
      equipment: ['bodyweight'],
    });

    expect(discomfort.ids).toEqual([]);
    expect(discomfort.issue).toContain('marked as uncomfortable');
    expect(unavailableEquipment.ids).toEqual([]);
    expect(unavailableEquipment.issue).toContain('requires equipment');
  });
});
