import { WorkLog } from '../types';
import { localDateOfIso } from './dates';

export interface DateFix {
  id: string;
  description: string;
  from: string;
  to: string;
}

// Finds logs whose date was filled in automatically from the UTC date (the old behaviour), so
// work done between 00:00 and 06:00 local time was filed under the previous day. A log is only
// reported when its stored date equals the UTC date of its createdAt AND that differs from the
// local date. Logs the user dated by hand to some other day are never touched.
export function findMisdatedLogs(logs: WorkLog[]): DateFix[] {
  const fixes: DateFix[] = [];
  for (const l of logs) {
    if (!l.createdAt || Number.isNaN(Date.parse(l.createdAt))) continue;
    const utcDate = new Date(l.createdAt).toISOString().split('T')[0];
    const localDate = localDateOfIso(l.createdAt);
    if (l.date === utcDate && localDate !== utcDate) {
      fixes.push({ id: l.id, description: l.description, from: l.date, to: localDate });
    }
  }
  return fixes;
}

export function applyDateFixes(logs: WorkLog[], fixes: DateFix[]): WorkLog[] {
  const byId = new Map(fixes.map((f) => [f.id, f.to]));
  return logs.map((l) => (byId.has(l.id) ? { ...l, date: byId.get(l.id) as string } : l));
}
