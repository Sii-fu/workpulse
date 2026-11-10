import type { BacklogTask } from '../types';
import { getTaskStage } from '../components/tasks/helpers';
import { isRunningTask } from './timerStore';
import { isPendingTask } from './taskLogging';
import { localDateOfIso } from './dates';
import { earlierGroups, type DayGroup } from './taskSections';

/**
 * The Today screen's tasks: open ones due today, anything running, and what was done today (local
 * date). Earlier pending tasks are not here: see earlierPending. Ordered running, paused/blocked, planned, done; list order within a group.
 */
export function todaysTasks(backlog: BacklogTask[], today: string): BacklogTask[] {
  const rank = (t: BacklogTask) => {
    if (isRunningTask(t)) return 0;
    const s = getTaskStage(t);
    if (s === 'paused' || s === 'blocked' || s === 'in_progress') return 1;
    if (s === 'planned') return 2;
    return 3;
  };
  return backlog
    .filter((t) =>
      isPendingTask(t)
        ? isRunningTask(t) || t.dueDate === today
        : t.completedAt
          ? localDateOfIso(t.completedAt) === today
          : t.dueDate === today,
    )
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map(({ t }) => t);
}

/** Pending tasks due before today, grouped by date, newest first (the same groups as the Tasks screen). */
export function earlierPending(backlog: BacklogTask[], today: string): DayGroup[] {
  return earlierGroups(backlog, today);
}
