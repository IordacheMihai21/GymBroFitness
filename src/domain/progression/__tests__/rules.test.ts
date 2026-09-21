import { PROGRESSION_RULES, PROGRESSION_RULE_VERSION, progressionRule } from '../rules';

describe('progression rule registry', () => {
  it('keeps every reason code versioned with inputs and a limitation', () => {
    const rules = Object.values(PROGRESSION_RULES);

    expect(rules).toHaveLength(15);
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.version).toBe(PROGRESSION_RULE_VERSION);
      expect(rule.requires.length).toBeGreaterThan(0);
      expect(rule.limitation.length).toBeGreaterThan(20);
    }
  });

  it('resolves a stable rule by the decision reason code', () => {
    expect(progressionRule('MISSING_RIR_HOLD')).toMatchObject({
      id: 'MISSING_RIR_HOLD',
      version: 2,
    });
  });
});
