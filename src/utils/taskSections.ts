import type { BacklogTask } from '../types';
import { getTaskStage } from '../components/tasks/helpers';
import { isRunningTask } from './timerStore';
import { isPendingTask } from './taskLogging';
import { lastNDays, localDateOfIso, parseLocalDate } from './dates';

/** The Tasks screen's sections. Every task is in at most one. */
export interface TaskSections {
  /** Open tasks that rolled over from an earlier day (or are still dated before today). */
  overdue: BacklogTask[];
  /** Task id -> the local date an overdue task was added (its originalDate). */
  overdueAdded: Record<string, string>;
  today: BacklogTask[];
  /** Open tasks due after today, by date ascending. */
  upcoming: { date: string; tasks: BacklogTask[] }[];
  /** Open blocked tasks, whatever their date. */
  blocked: BacklogTask[];
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

/** Splits the backlog into the Tasks screen's sections for a local date. */
export function groupTasks(backlog: BacklogTask[], today: string): TaskSections {
  const overdue: BacklogTask[] = [];
  const overdueAdded: Record<string, string> = {};
  const todays: BacklogTask[] = [];
  const blocked: BacklogTask[] = [];
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
    if (getTaskStage(t) === 'blocked') {
      blocked.push(t);
    } else if (t.dueDate < today || (t.isRolledOver && t.dueDate === today)) {
      overdue.push(t);
      overdueAdded[t.id] = t.originalDate;
    } else if (t.dueDate === today || isRunningTask(t)) {
      todays.push(t);
    } else {
      byDate.set(t.dueDate, [...(byDate.get(t.dueDate) ?? []), t]);
    }
  }

  return {
    overdue: byRank(overdue),
    overdueAdded,
    today: byRank(todays),
    upcoming: [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, tasks]) => ({ date, tasks })),
    blocked,
    // ISO timestamps and YYYY-MM-DD strings both sort as text; newest first.
    doneRecently: recent.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map(({ t }) => t),
  };
}

/** The projects with at least one task on the screen. */
export function sectionProjectIds(s: TaskSections): string[] {
  const all = [...s.overdue, ...s.today, ...s.upcoming.flatMap((d) => d.tasks), ...s.blocked, ...s.doneRecently];
  return [...new Set(all.map((t) => t.projectId))];
}

/** Only one project's tasks (null = all). Date groups left empty are dropped. */
export function filterByProject(s: TaskSections, projectId: string | null): TaskSections {
  if (!projectId) return s;
  const keep = (list: BacklogTask[]) => list.filter((t) => t.projectId === projectId);
  return {
    overdue: keep(s.overdue),
    overdueAdded: s.overdueAdded,
    today: keep(s.today),
    upcoming: s.upcoming.map((d) => ({ date: d.date, tasks: keep(d.tasks) })).filter((d) => d.tasks.length > 0),
    blocked: keep(s.blocked),
    doneRecently: keep(s.doneRecently),
  };
}
