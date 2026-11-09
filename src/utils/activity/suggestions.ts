import { localTimeStr } from '../dates';
import { minutesFromSeconds } from '../duration';
import { unloggedSeconds } from '../taskLogging';
import { clip } from './sanitize';
import { estimateMinutes } from './time';
import type { BacklogTask, Project, WorkLog } from '../../types';
import type { ActivityFolder, ActivityItem, AiTask, Suggestion } from './types';

const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

/** Every activity item id already used by a saved log. */
export function consumedIds(logs: WorkLog[]): Set<string> {
  const ids = new Set<string>();
  for (const l of logs) for (const id of l.sourceIds ?? []) ids.add(id);
  return ids;
}

export function dropConsumed(items: ActivityItem[], consumed: Set<string>): ActivityItem[] {
  return items.filter((i) => !consumed.has(i.id));
}

/**
 * Minutes already on record for a project on a date: logged durations plus tracked timer time
 * not yet written into a log. Time already written into a log is counted once, through the log.
 */
export function trackedMinutesFor(date: string, projectId: string, logs: WorkLog[], backlog: BacklogTask[]): number {
  let total = 0;
  for (const l of logs) if (l.date === date && l.projectId === projectId) total += l.durationMinutes ?? 0;
  for (const t of backlog) {
    if (t.projectId === projectId && t.dueDate === date) total += minutesFromSeconds(unloggedSeconds(t));
  }
  return total;
}

function evidenceOf(items: ActivityItem[]): string {
  const commits = items.filter((i) => i.source === 'git').length;
  const sessions = new Set(items.filter((i) => i.source === 'claude').map((i) => i.id.split(':')[1])).size;
  const parts: string[] = [];
  if (commits > 0) parts.push(`${commits} commit${commits === 1 ? '' : 's'}`);
  if (sessions > 0) parts.push(`${sessions} Claude session${sessions === 1 ? '' : 's'}`);
  return parts.join(', ') || 'activity';
}

/**
 * Turns tasks (text + item ids) into suggestions. A task that spans several projects is split into
 * one suggestion per project, and folders that map to the same project end up together. Minutes,
 * project and evidence always come from the items themselves, never from the AI.
 */
export function buildSuggestions(
  tasks: AiTask[],
  items: ActivityItem[],
  args: { date: string; folders: ActivityFolder[]; projects: Project[]; logs: WorkLog[]; backlog: BacklogTask[] },
): Suggestion[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const projectOfFolder = (folder: string) => args.folders.find((f) => f.path === folder)?.projectId ?? '';
  const out: Suggestion[] = [];

  for (const task of tasks) {
    const byProject = new Map<string, ActivityItem[]>();
    for (const id of task.itemIds) {
      const it = byId.get(id);
      if (!it) continue;
      const projectId = projectOfFolder(it.folder);
      byProject.set(projectId, [...(byProject.get(projectId) ?? []), it]);
    }
    for (const [projectId, group] of byProject) {
      const sorted = [...group].sort((a, b) => a.time.localeCompare(b.time));
      out.push({
        key: sorted[0].id,
        folder: sorted[0].folder,
        projectId,
        projectName: args.projects.find((p) => p.id === projectId)?.name ?? 'Unassigned',
        text: task.text,
        minutes: estimateMinutes(sorted.map((i) => i.time)),
        itemIds: sorted.map((i) => i.id),
        evidence: evidenceOf(sorted),
        trackedMinutes: trackedMinutesFor(args.date, projectId, args.logs, args.backlog),
      });
    }
  }
  return out;
}

/** The no-AI fallback: one task per folder, worded from commit subjects or the user's prompts. */
export function templateTasks(items: ActivityItem[]): AiTask[] {
  const byFolder = new Map<string, ActivityItem[]>();
  for (const it of items) byFolder.set(it.folder, [...(byFolder.get(it.folder) ?? []), it]);

  const distinct = (list: string[]) => [...new Set(list)];
  return [...byFolder].map(([folder, list]) => {
    const commits = distinct(list.filter((i) => i.source === 'git').map((i) => i.text));
    const prompts = distinct(
      list.filter((i) => i.source === 'claude' && !i.text.startsWith('Session: ') && !i.text.startsWith('Edited ')).map((i) => i.text),
    ).slice(0, 3);
    const text = commits.length > 0
      ? `Committed: ${commits.join('; ')}`
      : prompts.length > 0
        ? `Worked on: ${prompts.join('; ')}`
        : `Worked in ${baseName(folder)}`;
    return { text: clip(text, 400), itemIds: list.map((i) => i.id) };
  });
}

/** The log to save for one ticked suggestion, with whatever the user edited in the dialog. */
export function suggestionToLogData(
  s: Suggestion,
  date: string,
  minutes: number,
  text: string,
  projectId: string,
  projectName: string,
): Omit<WorkLog, 'id' | 'createdAt'> {
  return {
    date,
    time: localTimeStr(),
    projectId,
    projectName,
    description: text,
    status: 'completed',
    tags: [],
    durationMinutes: minutes > 0 ? minutes : undefined,
    sourceIds: [...s.itemIds],
  };
}
