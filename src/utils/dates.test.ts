import { describe, it, expect, beforeAll } from 'vitest';
import {
  localDateStr,
  localTimeStr,
  addDays,
  startOfWeekStr,
  startOfMonthStr,
  lastNDays,
  rangeStart,
  localDateOfIso,
} from './dates';

// The user is in UTC+6. Between 00:00 and 06:00 local, the UTC date is still "yesterday".
beforeAll(() => {
  process.env.TZ = 'Asia/Dhaka';
});

// 2026-11-07T20:30:00Z is 02:30 on Nov 8 in Dhaka.
const NIGHT = new Date('2026-11-07T20:30:00Z');

describe('local date helpers (B5), TZ=Asia/Dhaka', () => {
  it('uses the local date, not the UTC date, at 02:30 local', () => {
    expect(NIGHT.toISOString().split('T')[0]).toBe('2026-11-07'); // the old, wrong way
    expect(localDateStr(NIGHT)).toBe('2026-11-08');
    expect(localTimeStr(NIGHT)).toBe('02:30');
  });
  it('maps an ISO timestamp to its local date', () => {
    expect(localDateOfIso('2026-11-07T20:30:00.000Z')).toBe('2026-11-08');
  });
  it('addDays crosses month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('ranges (B6, B7)', () => {
  it('week starts on Monday, including when Monday is in the previous month', () => {
    expect(startOfWeekStr('2026-12-03')).toBe('2026-11-30'); // Thursday
    expect(startOfWeekStr('2026-11-08')).toBe('2026-11-02'); // Sunday belongs to the week starting Monday
    expect(startOfWeekStr('2026-11-02')).toBe('2026-11-02'); // Monday itself
  });
  it('"This Month" starts on the 1st of the CURRENT month even when the week started last month (B6)', () => {
    expect(startOfWeekStr('2026-12-03') < startOfMonthStr('2026-12-03')).toBe(true);
    expect(rangeStart('month', '2026-12-03')).toBe('2026-12-01');
  });
  it('lastNDays(…, 7) is exactly 7 days ending today, oldest first (B7)', () => {
    const days = lastNDays('2026-11-08', 7);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-02');
    expect(days[6]).toBe('2026-11-08');
  });
  it('rangeStart: today / all', () => {
    expect(rangeStart('today', '2026-11-08')).toBe('2026-11-08');
    expect(rangeStart('all', '2026-11-08')).toBeNull();
  });
});
