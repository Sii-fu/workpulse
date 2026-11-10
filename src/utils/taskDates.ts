import type { BacklogTask } from '../types';
import { isPendingTask } from './taskLogging';
import { isRunningTask } from './timerStore';
import { dayLabelLong } from './taskSections';
import { addDays } from './dates';

/** Sets dueDate = day on the pending listed tasks that are dated elsewhere. Same array when nothing changes. */
export function moveTasksToDay(backlog: BacklogTask[], ids: string[], day: string): BacklogTask[] {
  const wanted = new Set(ids);
  let changed = false;
  const next = backlog.map((t) => {
    if (!wanted.has(t.id) || !isPendingTask(t) || t.dueDate === day) return t;
    changed = true;
    return { ...t, dueDate: day };
  });
  return changed ? next : backlog;
}

/** A running timer belongs to the day it is running on: moves running tasks to `day`. */
export function moveRunningToDay(backlog: BacklogTask[], day: string): BacklogTask[] {
  let changed = false;
  const next = backlog.map((t) => {
    if (!isRunningTask(t) || t.dueDate === day) return t;
    changed = true;
    return { ...t, dueDate: day };
  });
  return changed ? next : backlog;
}

/** "Today", "Tomorrow", "Yesterday", otherwise "Mon 9 Nov". */
export function dayHeading(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return dayLabelLong(date);
}
