import type { BacklogTask } from '../types';
import { getTaskStage } from '../components/tasks/helpers';
import { isRunningTask } from './timerStore';
import { isPendingTask } from './taskLogging';
import { localDateOfIso } from './dates';

/** The Today screen's task groups, in the order they are shown. Every task is in at most one. */
export interface TodayStateGroups {
  /** Running tasks of any date. */
  running: BacklogTask[];
  /** Paused tasks of any date (an in-progress task whose timer is off counts as paused). */
  paused: BacklogTask[];
  /** Blocked tasks of any date. */
  blocked: BacklogTask[];
  /** Not-started (planned) tasks due today. */
  upNext: BacklogTask[];
  /** Done today (local date). */
  done: BacklogTask[];
  /** How many planned tasks are still dated before today (they live in the Tasks page's Plans list). */
  earlierPlans: number;
}

/**
 * Splits the backlog for the Today screen: running, paused and blocked work of any date (a task paused
 * yesterday is still paused work), today's not-started plans, and what was done today. List order within
 * a group.
 */
export function todayStateGroups(backlog: BacklogTask[], today: string): TodayStateGroups {
  const g: TodayStateGroups = { running: [], paused: [], blocked: [], upNext: [], done: [], earlierPlans: 0 };
  for (const t of backlog) {
    if (!isPendingTask(t)) {
      const day = t.completedAt ? localDateOfIso(t.completedAt) : t.dueDate;
      if (day === today) g.done.push(t);
    } else if (isRunningTask(t)) g.running.push(t);
    else if (getTaskStage(t) === 'blocked') g.blocked.push(t);
    else if (getTaskStage(t) === 'planned') {
      if (t.dueDate === today) g.upNext.push(t);
      else if (t.dueDate < today) g.earlierPlans++;
    } else g.paused.push(t);
  }
  return g;
}
