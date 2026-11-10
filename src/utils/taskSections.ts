import type { BacklogTask } from '../types';
import { getTaskStage } from '../components/tasks/helpers';
import { isRunningTask } from './timerStore';
import { isPendingTask } from './taskLogging';
import { lastNDays, localDateOfIso, parseLocalDate } from './dates';

export interface DayGroup {
  date: string;
  tasks: BacklogTask[];
}

/** The Tasks screen's sections. Every task is in at most one. */
export interface TaskSections {
  /** Pending tasks due today, plus anything running (a running task belongs to today). */
  today: BacklogTask[];
  /** Pending tasks due before today, one group per date, newest date first. Blocked tasks stay in their date. */
  earlier: DayGroup[];
  /** Pending tasks due after today, one group per date, oldest first. */
  upcoming: DayGroup[];
  /** Done in the last 7 local days (today included), newest first. */
  doneRecently: BacklogTask[];
}

const DONE_WINDOW_DAYS = 7;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 9 Nov" for a local YYYY-MM-DD. */
export function dayLabelLong(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Running first, then paused / not-started in-progress, then planned; list order within a group.
const rank = (t: BacklogTask): number => {
  if (isRunningTask(t)) return 0;
  return getTaskStage(t) === 'planned' ? 2 : 1;
};
const byRank = (list: BacklogTask[]): BacklogTask[] =>
  list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map(({ t }) => t);

const isEarlier = (t: BacklogTask, today: string): boolean =>
  isPendingTask(t) && !isRunningTask(t) && t.dueDate < today;

/** Pending tasks due before today (not running), grouped by date, newest first. */
export function earlierGroups(backlog: BacklogTask[], today: string): DayGroup[] {
  const byDate = new Map<string, BacklogTask[]>();
  for (const t of backlog) if (isEarlier(t, today)) byDate.set(t.dueDate, [...(byDate.get(t.dueDate) ?? []), t]);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, tasks]) => ({ date, tasks: byRank(tasks) }));
}

/** Splits the backlog into the Tasks screen's sections for a local date. */
export function groupTasks(backlog: BacklogTask[], today: string): TaskSections {
  const todays: BacklogTask[] = [];
  const byDate = new Map<string, BacklogTask[]>();
  const recent: { t: BacklogTask; at: string }[] = [];
  const windowStart = lastNDays(today, DONE_WINDOW_DAYS)[0];

  for (const t of backlog) {
    if (!isPendingTask(t)) {
      const at = t.completedAt ?? t.dueDate;
      const day = t.completedAt ? localDateOfIso(t.completedAt) : t.dueDate;
      if (day >= windowStart && day <= today) recent.push({ t, at });
      continue;
    }
    if (isRunningTask(t) || t.dueDate === today) {
      todays.push(t);
    } else if (t.dueDate > today) {
      byDate.set(t.dueDate, [...(byDate.get(t.dueDate) ?? []), t]);
    }
  }

  return {
    today: byRank(todays),
    earlier: earlierGroups(backlog, today),
    upcoming: [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, tasks]) => ({ date, tasks: byRank(tasks) })),
    // ISO timestamps and YYYY-MM-DD strings both sort as text; newest first.
    doneRecently: recent.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map(({ t }) => t),
  };
}

/** The projects with at least one task on the screen. */
export function sectionProjectIds(s: TaskSections): string[] {
  const all = [
    ...s.today,
    ...s.earlier.flatMap((d) => d.tasks),
    ...s.upcoming.flatMap((d) => d.tasks),
    ...s.doneRecently,
  ];
  return [...new Set(all.map((t) => t.projectId))];
}

/** Only one project's tasks (null = all). Date groups left empty are dropped. */
export function filterByProject(s: TaskSections, projectId: string | null): TaskSections {
  if (!projectId) return s;
  const keep = (list: BacklogTask[]) => list.filter((t) => t.projectId === projectId);
  const keepGroups = (groups: DayGroup[]) =>
    groups.map((d) => ({ date: d.date, tasks: keep(d.tasks) })).filter((d) => d.tasks.length > 0);
  return {
    today: keep(s.today),
    earlier: keepGroups(s.earlier),
    upcoming: keepGroups(s.upcoming),
    doneRecently: keep(s.doneRecently),
  };
}
