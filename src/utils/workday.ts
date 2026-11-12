import { WorkdayRecord, Workdays } from '../types';
import { localDateOfIso } from './dates';

export const DEFAULT_WORKDAY_HOURS = 8;

export type ClockPhase = 'off' | 'calm' | 'near' | 'due' | 'over' | 'out';

export interface ClockState {
  phase: ClockPhase;
  workedSec: number;
  leftSec: number;
  overSec: number;
  leaveAtMs: number | null;
  clockInMs: number | null;
}

// Where the office clock stands. `off` = no record, `out` = clocked out. Otherwise the phase
// follows the time left to the leave time: calm > 1 h, near > 15 min, due > 0, then over.
export function clockState(rec: WorkdayRecord | undefined, hours: number, nowMs: number): ClockState {
  if (!rec) return { phase: 'off', workedSec: 0, leftSec: 0, overSec: 0, leaveAtMs: null, clockInMs: null };
  const clockInMs = Date.parse(rec.clockIn);
  const leaveAtMs = clockInMs + hours * 3600_000;
  if (rec.clockOut) {
    const workedSec = Math.max(0, Math.floor((Date.parse(rec.clockOut) - clockInMs) / 1000));
    return { phase: 'out', workedSec, leftSec: 0, overSec: 0, leaveAtMs, clockInMs };
  }
  const workedSec = Math.max(0, Math.floor((nowMs - clockInMs) / 1000));
  const leftSec = hours * 3600 - workedSec;
  const overSec = Math.max(0, -leftSec);
  const phase: ClockPhase = leftSec > 3600 ? 'calm' : leftSec > 900 ? 'near' : leftSec > 0 ? 'due' : 'over';
  return { phase, workedSec, leftSec, overSec, leaveAtMs, clockInMs };
}

// The latest date before `today` that was clocked in but never clocked out (a forgotten clock-out).
export function openWorkdayBefore(
  workdays: Workdays,
  today: string,
): { date: string; rec: WorkdayRecord } | null {
  const dates = Object.keys(workdays)
    .filter((d) => d < today && !workdays[d].clockOut)
    .sort();
  const date = dates[dates.length - 1];
  return date ? { date, rec: workdays[date] } : null;
}

// The workday End my day and the next action work on: today's record (open or clocked out), else an
// earlier day still open (someone working past midnight, or a forgotten clock-out).
export function currentWorkday(
  workdays: Workdays,
  today: string,
): { date: string; rec: WorkdayRecord } | null {
  const rec = workdays[today];
  return rec ? { date: today, rec } : openWorkdayBefore(workdays, today);
}

// "I came in at HH:MM": today at that time, or yesterday when that time has not come yet today
// (an entry made after midnight for a late start). Null when the text is not HH:MM.
export function chosenClockIn(hhmm: string, nowMs: number): { atIso: string; yesterday: boolean } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const at = new Date(nowMs);
  at.setHours(Number(match[1]), Number(match[2]), 0, 0);
  const yesterday = at.getTime() > nowMs;
  if (yesterday) at.setDate(at.getDate() - 1);
  return { atIso: at.toISOString(), yesterday };
}

// Starts the day for the local date of `atIso`. An existing record for that date is kept as it is.
export function clockIn(workdays: Workdays, atIso: string): Workdays {
  const date = localDateOfIso(atIso);
  if (workdays[date]) return workdays;
  return { ...workdays, [date]: { clockIn: atIso } };
}

export function clockOut(workdays: Workdays, date: string, atIso: string): Workdays {
  const rec = workdays[date];
  if (!rec) return workdays;
  return { ...workdays, [date]: { ...rec, clockOut: atIso } };
}

// Undo a clock-out: the day is open again.
export function resumeWorkday(workdays: Workdays, date: string): Workdays {
  const rec = workdays[date];
  if (!rec) return workdays;
  const { clockOut: _omit, ...open } = rec;
  return { ...workdays, [date]: open };
}

// A stored or imported workday length: a finite number of hours from 1 to 16 (as Settings allows),
// else undefined, which means the default.
export function validWorkdayHours(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 16 ? v : undefined;
}

// 20280 -> "5:38". Negative counts as 0.
export function formatHm(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

// 8411 -> "2:20:11". Negative counts as 0.
export function formatHms(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const s = total % 60;
  return `${formatHm(total)}:${String(s).padStart(2, '0')}`;
}

// A moment as local 24-hour "HH:MM:SS".
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

const DATE_KEY =/^\d{4}-\d{2}-\d{2}$/;

export function isWorkdays(v: unknown): v is Workdays {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.entries(v as Record<string, unknown>).every(([date, rec]) => {
    if (!DATE_KEY.test(date)) return false;
    if (typeof rec !== 'object' || rec === null || Array.isArray(rec)) return false;
    const r = rec as Record<string, unknown>;
    const isTime = (x: unknown) => typeof x === 'string' && Number.isFinite(Date.parse(x));
    return isTime(r.clockIn) && (r.clockOut === undefined || isTime(r.clockOut));
  });
}
