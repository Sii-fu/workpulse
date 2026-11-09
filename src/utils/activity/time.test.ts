process.env.TZ = 'Asia/Dhaka';

import { describe, it, expect } from 'vitest';
import { localDayToUtcRange, estimateMinutes, formatEstimate } from './time';

const inRange = (iso: string, r: { startIso: string; endIso: string }) => iso >= r.startIso && iso < r.endIso;

describe('localDayToUtcRange', () => {
  it('maps a local day in UTC+6 to the previous evening in UTC', () => {
    expect(localDayToUtcRange('2026-11-09')).toEqual({
      startIso: '2026-11-08T18:00:00.000Z',
      endIso: '2026-11-09T18:00:00.000Z',
    });
  });
  it('keeps 00:30 and 23:30 local on the same local day', () => {
    const r = localDayToUtcRange('2026-11-09');
    expect(inRange('2026-11-08T18:30:00.000Z', r)).toBe(true); // 00:30 local on the 9th
    expect(inRange('2026-11-09T17:30:00.000Z', r)).toBe(true); // 23:30 local on the 9th
    expect(inRange('2026-11-09T18:30:00.000Z', r)).toBe(false); // 00:30 local on the 10th
  });
});

describe('estimateMinutes', () => {
  const at = (hm: string) => `2026-11-09T${hm}:00.000Z`;
  it('is 0 for no activity', () => expect(estimateMinutes([])).toBe(0));
  it('floors a single timestamp at 5 minutes', () => expect(estimateMinutes([at('10:00')])).toBe(5));
  it('sums the span of one cluster', () =>
    expect(estimateMinutes([at('10:00'), at('10:20'), at('10:40')])).toBe(40));
  it('splits clusters on a gap over 30 minutes and floors each at 5', () =>
    expect(estimateMinutes([at('10:00'), at('10:10'), at('12:00'), at('12:03')])).toBe(15));
  it('does not split on a gap of exactly 30 minutes', () =>
    expect(estimateMinutes([at('10:00'), at('10:30')])).toBe(30));
  it('ignores input order', () =>
    expect(estimateMinutes([at('12:03'), at('10:10'), at('12:00'), at('10:00')])).toBe(15));
});

describe('formatEstimate', () => {
  it('formats hours and minutes', () => expect(formatEstimate(80)).toBe('~1h 20m (estimated)'));
  it('formats minutes only', () => expect(formatEstimate(45)).toBe('~45m (estimated)'));
  it('formats whole hours', () => expect(formatEstimate(120)).toBe('~2h (estimated)'));
  it('says no duration for 0', () => expect(formatEstimate(0)).toBe('no duration'));
});
