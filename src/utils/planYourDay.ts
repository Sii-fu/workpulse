import type { BacklogTask, Project } from '../types';
import { earlierPlans } from './taskSections';
import { moveTasksToDay } from './taskDates';
import { activeProjectsOf } from './projects';

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

export interface PlanLineProblem {
  /** 1-based line number in the box. */
  line: number;
  kind: 'no-project' | 'no-task';
}

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const SEPARATOR = /^\s*[:-]?\s*/;

/** Where the project name `key` (spaces and case ignored) ends at the start of `line`, or -1. It must end at a word edge, ':' or '-'. */
function nameEnd(line: string, key: string): number {
  let seen = '';
  for (let i = 0; i < line.length; i++) {
    if (/\s/.test(line[i])) continue;
    seen += line[i].toLowerCase();
    if (seen.length === key.length) {
      const next = line[i + 1];
      return seen === key && (next === undefined || /[\s:-]/.test(next)) ? i + 1 : -1;
    }
    if (!key.startsWith(seen)) return -1;
  }
  return -1;
}

/**
 * Plan your day lines: one task per non-empty line, written `<project name> <task>`. The project is the active
 * project the line starts with (longest name wins; case and spacing ignored; an optional ':' or '-' may follow).
 * With no full name, the first word may be a prefix of exactly one project name. Lines with no project (or no
 * task after it) are reported in `problems` and not returned as tasks.
 */
export function parsePlanLines(text: string, projects: Project[]): { tasks: { title: string; projectId: string }[]; problems: PlanLineProblem[] } {
  const active = activeProjectsOf(projects).filter((p) => squash(p.name).length > 0);
  const tasks: { title: string; projectId: string }[] = [];
  const problems: PlanLineProblem[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let project: Project | undefined;
    let end = -1;
    for (const p of active) {
      const e = nameEnd(line, squash(p.name));
      if (e > end) {
        project = p;
        end = e;
      }
    }
    if (!project) {
      const first = /^[^\s:-]+/.exec(line)?.[0] ?? '';
      const prefixed = first ? active.filter((p) => squash(p.name).startsWith(squash(first))) : [];
      if (prefixed.length === 1) {
        project = prefixed[0];
        end = first.length;
      }
    }
    if (!project) {
      problems.push({ line: i + 1, kind: 'no-project' });
      return;
    }
    const title = line.slice(end).replace(SEPARATOR, '').trim();
    if (!title) problems.push({ line: i + 1, kind: 'no-task' });
    else tasks.push({ title, projectId: project.id });
  });
  return { tasks, problems };
}

/**
 * Completion in the box: while the caret is in the FIRST word of a line (`beforeCaret` is the text up to it),
 * the active projects whose names start with that word. Empty when the word is empty or the caret is past it.
 */
export function firstWordMatches(beforeCaret: string, projects: Project[]): Project[] {
  const word = beforeCaret.slice(beforeCaret.lastIndexOf('\n') + 1).replace(/^\s+/, '');
  if (!word || /\s/.test(word)) return [];
  const key = squash(word);
  return activeProjectsOf(projects).filter((p) => squash(p.name).startsWith(key));
}

/** Replaces the first word of the caret's line (`beforeCaret`) with the full project name and a space. */
export function completeFirstWord(beforeCaret: string, project: Project): string {
  const at = beforeCaret.lastIndexOf('\n') + 1;
  const lead = /^\s*/.exec(beforeCaret.slice(at))![0];
  return `${beforeCaret.slice(0, at)}${lead}${project.name} `;
}

/** The toast after "Start the day": counts the tasks that really moved (one done or deleted meanwhile is not counted). */
export function planSummary(before: BacklogTask[], after: BacklogTask[], added: number): string {
  const carried = after.filter((t, i) => t !== before[i]).length;
  const parts = [carried > 0 ? `${carried} carried to today` : '', added > 0 ? `${added} added` : ''].filter(Boolean);
  return parts.length > 0 ? `Day planned: ${parts.join(', ')}.` : 'Day started.';
}
