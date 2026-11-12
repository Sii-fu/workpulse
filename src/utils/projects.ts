import { BacklogTask, Project, WorkLog } from '../types';
import type { ActivityFolder } from './activity/types';

export const isTrashed = (p: Project): boolean => !!p.trashedAt;

// Trashed projects are gone from every list and picker (Settings > Trash lists them); App hands the screens this.
export const liveProjectsOf = (projects: Project[]): Project[] => projects.filter((p) => !p.trashedAt);
export const trashedProjectsOf = (projects: Project[]): Project[] => projects.filter((p) => !!p.trashedAt);

// Archived and trashed projects are hidden from pickers; a log must never default to one (B13).
export const activeProjectsOf = (projects: Project[]): Project[] => projects.filter((p) => !p.isArchived && !p.trashedAt);

// First active project, or (if every project is archived) the first one that is not trashed.
export const defaultProject = (projects: Project[]): Project | undefined =>
  projects.find((p) => !p.isArchived && !p.trashedAt) || projects.find((p) => !p.trashedAt);

/** Moves a project to the Trash. It keeps its tasks, logs and folder links. */
export const trashProject = (projects: Project[], id: string, nowIso: string): Project[] =>
  projects.map((p) => (p.id === id && !p.trashedAt ? { ...p, trashedAt: nowIso } : p));

/** Brings a project back from the Trash (an archived one is still archived). */
export const restoreProject = (projects: Project[], id: string): Project[] =>
  projects.map((p) => {
    if (p.id !== id || !p.trashedAt) return p;
    const { trashedAt: _gone, ...rest } = p;
    return rest;
  });

/** Removes the project record and its folder links. Tasks and logs are left as they are. */
export function deleteProjectForever(
  projects: Project[],
  folders: ActivityFolder[],
  id: string,
): { projects: Project[]; folders: ActivityFolder[] } {
  return { projects: projects.filter((p) => p.id !== id), folders: folders.filter((f) => f.projectId !== id) };
}

/** How many tasks and logs point at this project (for the "Delete forever" warning). */
export const projectUse = (
  id: string,
  backlog: Pick<BacklogTask, 'projectId'>[],
  logs: Pick<WorkLog, 'projectId'>[],
): { tasks: number; logs: number } => ({
  tasks: backlog.filter((t) => t.projectId === id).length,
  logs: logs.filter((l) => l.projectId === id).length,
});

/** The folder shortened to its last two segments ("...\work\HMIS"); the full path goes in a tooltip. */
export function shortFolder(path: string): string {
  const t = path.trim();
  const drive = /^([A-Za-z]:)[\\/]*$/.exec(t);
  if (drive) return `${drive[1]}\\`;
  const parts = t.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 2) return t;
  return `...\\${parts.slice(-2).join('\\')}`;
}

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * Quick-add inputs: a trailing "#word" picks a project by name prefix (case and spaces ignored,
 * archived projects skipped). A matched tag is removed from the text; with no match the text stays
 * whole and `project` is absent.
 */
export function splitProjectTag(input: string, projects: Project[]): { text: string; tag?: string; project?: Project } {
  const m = /(?:^|\s)#(\S+)\s*$/.exec(input);
  if (!m) return { text: input.trim() };
  const tag = m[1];
  const key = squash(tag);
  const active = activeProjectsOf(projects);
  // An exact name wins over an earlier prefix match ("#App" with "App Admin" listed before "App").
  const project = active.find((p) => squash(p.name) === key) ?? active.find((p) => squash(p.name).startsWith(key));
  // No match keeps the whole text: "#212" may be part of it ("Review PR #212").
  return project ? { text: input.slice(0, m.index).trim(), tag, project } : { text: input.trim(), tag };
}
