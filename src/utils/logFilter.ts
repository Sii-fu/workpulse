import { WorkLog } from '../types';
import { DateRange, rangeStart } from './dates';

// One definition of "which logs are visible", shared by every theme's timeline.

export interface LogFilters {
  query: string;
  range: DateRange;
  projectId: string; // 'all' or a project id
  status: string; // 'all' or a TaskStatus
  tag: string; // 'all' or a tag
}

export const NO_FILTERS: LogFilters = { query: '', range: 'all', projectId: 'all', status: 'all', tag: 'all' };

export function hasActiveFilters(f: LogFilters): boolean {
  return f.query.trim() !== '' || f.range !== 'all' || f.projectId !== 'all' || f.status !== 'all' || f.tag !== 'all';
}

export function filterLogs(logs: WorkLog[], f: LogFilters, todayStr: string): WorkLog[] {
  const from = rangeStart(f.range, todayStr);
  const q = f.query.trim().toLowerCase();
  return logs.filter((log) => {
    if (q) {
      const hit =
        log.description.toLowerCase().includes(q) ||
        log.projectName.toLowerCase().includes(q) ||
        log.tags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (f.projectId !== 'all' && log.projectId !== f.projectId) return false;
    if (f.status !== 'all' && log.status !== f.status) return false;
    if (f.tag !== 'all' && !log.tags.includes(f.tag)) return false;
    if (f.range === 'today') return log.date === todayStr;
    return from === null || log.date >= from;
  });
}

/** Tags that appear on at least one log, in first-seen order. */
export function tagsInUse(logs: WorkLog[]): string[] {
  const seen = new Set<string>();
  logs.forEach((l) => l.tags.forEach((t) => seen.add(t)));
  return Array.from(seen);
}
