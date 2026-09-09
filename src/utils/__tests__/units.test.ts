import {
  displayLoad,
  inputToKg,
  kgToLb,
  lbToKg,
  roundToIncrement,
  smallestIncrementKg,
} from '../units';

describe('unit conversion', () => {
  it('converts kg to lb and back', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(225)).toBeCloseTo(102.058, 2);
    expect(lbToKg(kgToLb(60))).toBeCloseTo(60, 6);
  });

  it('displays loads rounded in the user unit', () => {
    expect(displayLoad(100, 'kg')).toBe(100);
    expect(displayLoad(100, 'lb')).toBe(220.5);
    expect(displayLoad(null, 'kg')).toBeNull();
  });

  it('parses user input back to kg', () => {
    expect(inputToKg(60, 'kg')).toBe(60);
    expect(inputToKg(135, 'lb')).toBeCloseTo(61.23, 1);
  });
});

describe('load increments', () => {
  it('uses the smallest increment across equipment options', () => {
    expect(smallestIncrementKg(['barbell'])).toBe(2.5);
    expect(smallestIncrementKg(['dumbbell', 'barbell'])).toBe(2);
    expect(smallestIncrementKg(['selectorized_machine'])).toBe(5);
    expect(smallestIncrementKg(['bodyweight'])).toBe(2.5); // fallback default
  });

  it('rounds to achievable loads', () => {
    expect(roundToIncrement(61.3, 2.5)).toBe(62.5);
    expect(roundToIncrement(61.2, 2)).toBe(62);
    expect(roundToIncrement(61.24, 0)).toBe(61.2);
  });
});
