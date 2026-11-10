import type { WorkLog } from '../types';
import { addDays, startOfWeekStr } from './dates';

export interface DayTotal {
  date: string;
  total: number;
  byProject: { projectId: string; minutes: number }[];
}

// The 7 local dates, Monday to Sunday, of the week containing anyDate.
export function weekDays(anyDate: string): string[] {
  const monday = startOfWeekStr(anyDate);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Minutes logged per day (and per project within the day) for the given dates.
export function weekTotals(logs: WorkLog[], days: string[]): DayTotal[] {
  return days.map(date => {
    const perProject = new Map<string, number>();
    let total = 0;
    for (const log of logs) {
      if (log.date !== date) continue;
      const minutes = log.durationMinutes ?? 0;
      total += minutes;
      perProject.set(log.projectId, (perProject.get(log.projectId) ?? 0) + minutes);
    }
    const byProject = [...perProject]
      .map(([projectId, minutes]) => ({ projectId, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
    return { date, total, byProject };
  });
}
