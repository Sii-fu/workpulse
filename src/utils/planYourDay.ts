import type { BacklogTask, Project } from '../types';
import { earlierGroups } from './taskSections';
import { moveTasksToDay } from './taskDates';
import { defaultProject, splitProjectTag } from './projects';

/**
 * Plan your day: the pending tasks left on earlier days (newest date first; running tasks already
 * belong to today). All are ticked to carry except blocked ones.
 */
export function planCandidates(
  backlog: BacklogTask[],
  today: string,
): { carry: BacklogTask[]; defaultCheckedIds: string[] } {
  const carry = earlierGroups(backlog, today).flatMap((g) => g.tasks);
  return { carry, defaultCheckedIds: carry.filter((t) => t.stage !== 'blocked').map((t) => t.id) };
}

/** Carries the chosen tasks to today. */
export function applyPlan(backlog: BacklogTask[], carryIds: string[], today: string): BacklogTask[] {
  return moveTasksToDay(backlog, carryIds, today);
}

/** Each non-empty line is a task; a trailing #project picks the project, else the first active one. */
export function parsePlanLines(text: string, projects: Project[]): { title: string; projectId: string }[] {
  const fallback = defaultProject(projects)?.id ?? 'default';
  return text
    .split(/\r?\n/)
    .map((line) => splitProjectTag(line, projects))
    .filter((p) => p.text.length > 0)
    .map((p) => ({ title: p.text, projectId: p.project?.id ?? fallback }));
}
