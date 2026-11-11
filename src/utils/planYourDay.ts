import type { BacklogTask, Project } from '../types';
import { earlierPlans } from './taskSections';
import { moveTasksToDay } from './taskDates';
import { defaultProject, splitProjectTag } from './projects';

/**
 * Plan your day: the not-started (planned) tasks left on earlier days, newest date first. Running, paused
 * and blocked tasks already show on Today in their own group, so they are not offered. All are ticked to carry.
 */
export function planCandidates(
  backlog: BacklogTask[],
  today: string,
): { carry: BacklogTask[]; defaultCheckedIds: string[] } {
  const carry = earlierPlans(backlog, today).flatMap((g) => g.tasks);
  return { carry, defaultCheckedIds: carry.map((t) => t.id) };
}

/** Carries the chosen tasks to today. */
export function applyPlan(backlog: BacklogTask[], carryIds: string[], today: string): BacklogTask[] {
  return moveTasksToDay(backlog, carryIds, today);
}

/** Each non-empty line is a task; a trailing #project picks the project, else `defaultProjectId` (the selector), else the first active one. */
export function parsePlanLines(text: string, projects: Project[], defaultProjectId?: string): { title: string; projectId: string }[] {
  const fallback = defaultProjectId ?? defaultProject(projects)?.id ?? 'default';
  return text
    .split(/\r?\n/)
    .map((line) => splitProjectTag(line, projects))
    .filter((p) => p.text.length > 0)
    .map((p) => ({ title: p.text, projectId: p.project?.id ?? fallback }));
}

/** The toast after "Start the day": counts the tasks that really moved (one done or deleted meanwhile is not counted). */
export function planSummary(before: BacklogTask[], after: BacklogTask[], added: number): string {
  const carried = after.filter((t, i) => t !== before[i]).length;
  const parts = [carried > 0 ? `${carried} carried to today` : '', added > 0 ? `${added} added` : ''].filter(Boolean);
  return parts.length > 0 ? `Day planned: ${parts.join(', ')}.` : 'Day started.';
}
