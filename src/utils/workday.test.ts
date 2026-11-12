process.env.TZ = 'Asia/Dhaka';
import { describe, it, expect } from 'vitest';
import { clockState, openWorkdayBefore, currentWorkday, chosenClockIn, clockIn, clockOut, resumeWorkday, formatHm, formatHms, formatClock, isWorkdays } from './workday';

// 09:48 in Dhaka (UTC+6) is 03:48Z.
const IN = '2026-11-10T03:48:00.000Z';
const inMs = Date.parse(IN);
const leaveMs = inMs + 8 * 3600_000;

describe('clockState', () => {
  it('calm mid-day: 09:48 in, 8h, now 15:26', () => {
    const now = Date.parse('2026-11-10T09:26:00.000Z');
    const s = clockState({ clockIn: IN }, 8, now);
    expect(s).toMatchObject({ phase: 'calm', workedSec: 5 * 3600 + 38 * 60, leftSec: 2 * 3600 + 22 * 60 });
    expect(s.leaveAtMs).toBe(leaveMs);
    expect(s.clockInMs).toBe(inMs);
  });
  it('near, due and over phases', () => {
    expect(clockState({ clockIn: IN }, 8, leaveMs - 30 * 60_000).phase).toBe('near');
    expect(clockState({ clockIn: IN }, 8, leaveMs - 10 * 60_000).phase).toBe('due');
    const over = clockState({ clockIn: IN }, 8, leaveMs + 12 * 60_000);
    expect(over.phase).toBe('over');
    expect(over.overSec).toBe(720);
    expect(over.leftSec).toBeLessThanOrEqual(0);
  });
  it('phase boundaries', () => {
    expect(clockState({ clockIn: IN }, 8, leaveMs - 3601_000).phase).toBe('calm');
    expect(clockState({ clockIn: IN }, 8, leaveMs - 3600_000).phase).toBe('near');
    expect(clockState({ clockIn: IN }, 8, leaveMs - 900_000).phase).toBe('due');
    expect(clockState({ clockIn: IN }, 8, leaveMs).phase).toBe('over');
  });
  it('out when clockOut is set', () => {
    const outIso = '2026-11-10T11:00:00.000Z';
    const s = clockState({ clockIn: IN, clockOut: outIso }, 8, Date.parse('2026-11-10T20:00:00.000Z'));
    expect(s.phase).toBe('out');
    expect(s.workedSec).toBe((Date.parse(outIso) - inMs) / 1000);
  });
  it('off with no record', () => {
    const s = clockState(undefined, 8, Date.now());
    expect(s).toMatchObject({ phase: 'off', workedSec: 0, leaveAtMs: null, clockInMs: null });
  });
});

describe('openWorkdayBefore', () => {
  it('returns an earlier open record', () => {
    const rec = { clockIn: '2026-11-09T03:00:00.000Z' };
    expect(openWorkdayBefore({ '2026-11-09': rec }, '2026-11-10')).toEqual({ date: '2026-11-09', rec });
  });
  it('null when clocked out, or when only today is open', () => {
    expect(openWorkdayBefore({ '2026-11-09': { clockIn: 'a', clockOut: 'b' } }, '2026-11-10')).toBeNull();
    expect(openWorkdayBefore({ '2026-11-10': { clockIn: 'a' } }, '2026-11-10')).toBeNull();
  });
  it('returns the latest of several open days', () => {
    const w = { '2026-11-07': { clockIn: 'a' }, '2026-11-09': { clockIn: 'b' } };
    expect(openWorkdayBefore(w, '2026-11-10')?.date).toBe('2026-11-09');
  });
});

describe('clockIn / clockOut / resumeWorkday', () => {
  it('keys by the local date of the instant', () => {
    expect(Object.keys(clockIn({}, '2026-11-09T19:30:00Z'))).toEqual(['2026-11-10']);
  });
  it('a second clockIn the same day keeps the first', () => {
    const first = clockIn({}, '2026-11-10T03:48:00.000Z');
    const second = clockIn(first, '2026-11-10T07:00:00.000Z');
    expect(second['2026-11-10'].clockIn).toBe('2026-11-10T03:48:00.000Z');
  });
  it('clockOut sets and resumeWorkday removes clockOut, without mutating', () => {
    const w = clockIn({}, IN);
    const out = clockOut(w, '2026-11-10', '2026-11-10T11:00:00.000Z');
    expect(out['2026-11-10'].clockOut).toBe('2026-11-10T11:00:00.000Z');
    expect(w['2026-11-10'].clockOut).toBeUndefined();
    const back = resumeWorkday(out, '2026-11-10');
    expect('clockOut' in back['2026-11-10']).toBe(false);
    expect(back['2026-11-10'].clockIn).toBe(IN);
  });
  it('clockOut and resumeWorkday on a missing date change nothing', () => {
    expect(clockOut({}, '2026-11-10', IN)).toEqual({});
    expect(resumeWorkday({}, '2026-11-10')).toEqual({});
  });
});

describe('formatHm', () => {
  it('formats h:mm', () => {
    expect(formatHm(20280)).toBe('5:38');
    expect(formatHm(-5)).toBe('0:00');
    expect(formatHm(3600 * 12 + 60 * 5)).toBe('12:05');
  });
});

describe('formatHms', () => {
  it('formats h:mm:ss', () => {
    expect(formatHms(8411)).toBe('2:20:11');
    expect(formatHms(0)).toBe('0:00:00');
    expect(formatHms(-5)).toBe('0:00:00');
    expect(formatHms(59.9)).toBe('0:00:59');
    expect(formatHms(3600 * 12 + 5)).toBe('12:00:05');
  });
});

describe('formatClock', () => {
  it('formats local HH:MM:SS, 24 h, zero padded', () => {
    expect(formatClock(new Date(2026, 10, 12, 14, 5, 32).getTime())).toBe('14:05:32');
    expect(formatClock(new Date(2026, 10, 12, 0, 3, 9).getTime())).toBe('00:03:09');
  });
});

describe('isWorkdays', () => {
  it('accepts valid and rejects garbage', () => {
    expect(isWorkdays({})).toBe(true);
    expect(isWorkdays({ '2026-11-10': { clockIn: IN } })).toBe(true);
    expect(isWorkdays({ '2026-11-10': { clockIn: IN, clockOut: IN } })).toBe(true);
    expect(isWorkdays([])).toBe(false);
    expect(isWorkdays(null)).toBe(false);
    expect(isWorkdays({ x: { clockIn: IN } })).toBe(false);
    expect(isWorkdays({ '2026-11-10': {} })).toBe(false);
    expect(isWorkdays({ '2026-11-10': { clockIn: 5 } })).toBe(false);
    expect(isWorkdays({ '2026-11-10': { clockIn: IN, clockOut: 5 } })).toBe(false);
  });
  it('rejects clock times that do not parse as dates', () => {
    expect(isWorkdays({ '2026-11-10': { clockIn: 'a' } })).toBe(false);
    expect(isWorkdays({ '2026-11-10': { clockIn: IN, clockOut: 'later' } })).toBe(false);
  });
});

describe('currentWorkday', () => {
  it("today's record wins, open or clocked out", () => {
    const today = { clockIn: IN, clockOut: IN };
    const w = { '2026-11-09': { clockIn: 'a' }, '2026-11-10': today };
    expect(currentWorkday(w, '2026-11-10')).toEqual({ date: '2026-11-10', rec: today });
  });
  it('an earlier day still open when today has no record (past midnight)', () => {
    const mon = { clockIn: '2026-11-09T03:00:00.000Z' };
    expect(currentWorkday({ '2026-11-09': mon }, '2026-11-10')).toEqual({ date: '2026-11-09', rec: mon });
  });
  it('null when nothing is open and today has no record', () => {
    expect(currentWorkday({ '2026-11-09': { clockIn: 'a', clockOut: 'b' } }, '2026-11-10')).toBeNull();
  });
});

describe('chosenClockIn', () => {
  // 00:30 on 11-10 in Dhaka is 11-09T18:30Z.
  const now = Date.parse('2026-11-09T18:30:00.000Z');
  it('a time later than now is yesterday', () => {
    const c = chosenClockIn('22:00', now);
    expect(c).toEqual({ atIso: '2026-11-09T16:00:00.000Z', yesterday: true });
  });
  it('a time earlier than now is today', () => {
    expect(chosenClockIn('00:10', now)).toEqual({ atIso: '2026-11-09T18:10:00.000Z', yesterday: false });
  });
  it('null for an empty or bad time', () => {
    expect(chosenClockIn('', now)).toBeNull();
    expect(chosenClockIn('9:5', now)).toBeNull();
  });
});
