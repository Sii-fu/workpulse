import { describe, it, expect } from 'vitest';
import { minutesFromSeconds } from './duration';

describe('minutesFromSeconds', () => {
  it('rounds tracked time to minutes', () => {
    expect(minutesFromSeconds(3600)).toBe(60);
    expect(minutesFromSeconds(5400)).toBe(90);
    expect(minutesFromSeconds(89)).toBe(1);
  });
  it('shows at least 1 minute for any tracked time', () => {
    expect(minutesFromSeconds(10)).toBe(1);
  });
  it('is 0 with no tracked time (nothing is invented)', () => {
    expect(minutesFromSeconds(0)).toBe(0);
    expect(minutesFromSeconds(-5)).toBe(0);
    expect(minutesFromSeconds(NaN)).toBe(0);
  });
});
