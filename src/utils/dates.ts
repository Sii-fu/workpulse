// Local-date helpers (B5). Dates are stored as "YYYY-MM-DD" strings in the user's LOCAL timezone,
// and times as local "HH:MM". Never build a date string with toISOString(): that is UTC and files
// work done between 00:00 and 06:00 (UTC+6) under yesterday.

const pad = (n: number) => String(n).padStart(2, '0');

export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTimeStr(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Parses "YYYY-MM-DD" as a LOCAL calendar date (new Date("YYYY-MM-DD") would be UTC midnight).
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

// Monday of the week containing dateStr.
export function startOfWeekStr(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0 = Sunday
  return addDays(dateStr, day === 0 ? -6 : 1 - day);
}

export function startOfMonthStr(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

// The last n calendar days ending today, oldest first.
export function lastNDays(todayStr: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(todayStr, i - (n - 1)));
}

// Local calendar date of an ISO timestamp such as task.completedAt.
export function localDateOfIso(iso: string): string {
  return localDateStr(new Date(iso));
}

// Short label like "Sun, 11/8" for a stored date string.
export function dayLabel(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

export type DateRange = 'all' | 'today' | 'week' | 'month';

// Inclusive start date for a filter range, or null for no limit.
export function rangeStart(range: DateRange, todayStr: string): string | null {
  if (range === 'today') return todayStr;
  if (range === 'week') return startOfWeekStr(todayStr);
  if (range === 'month') return startOfMonthStr(todayStr);
  return null;
}
