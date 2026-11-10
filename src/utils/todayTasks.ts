import type { BacklogTask } from '../types';
import { getTaskStage } from '../components/tasks/helpers';
import { isRunningTask } from './timerStore';
import { isPendingTask } from './taskLogging';
import { localDateOfIso } from './dates';

/**
 * The Today screen's tasks: open ones due today or earlier, anything running, and what was done
 * today (local date). Ordered running, paused/blocked, planned, done; list order within a group.
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
        ? isRunningTask(t) || t.dueDate <= today
        : t.completedAt
          ? localDateOfIso(t.completedAt) === today
          : t.dueDate === today,
    )
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map(({ t }) => t);
}
