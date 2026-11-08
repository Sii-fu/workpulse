import { describe, it, expect } from 'vitest';
import { advanceClock } from './timer';

describe('advanceClock', () => {
  it('adds one second per normal 1 s tick', () => {
    expect(advanceClock(10_000, 11_000)).toEqual({ seconds: 1, nextMs: 11_000 });
  });
  it('keeps the sub-second remainder so no time is lost or gained', () => {
    const a = advanceClock(0, 1_400);
    expect(a).toEqual({ seconds: 1, nextMs: 1_000 });
    expect(advanceClock(a.nextMs, 2_300)).toEqual({ seconds: 1, nextMs: 2_000 });
  });
  it('counts the whole gap when a hidden tab is throttled to one tick per minute (B1)', () => {
    expect(advanceClock(0, 60_000)).toEqual({ seconds: 60, nextMs: 60_000 });
  });
  it('does not count a long gap (sleep, closed laptop) as work', () => {
    expect(advanceClock(0, 10 * 60_000)).toEqual({ seconds: 0, nextMs: 10 * 60_000 });
  });
  it('ignores a clock that went backwards', () => {
    expect(advanceClock(5_000, 4_000)).toEqual({ seconds: 0, nextMs: 4_000 });
  });
});
