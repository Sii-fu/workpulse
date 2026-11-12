import type { Project } from '../types';
import type { ActivityFolder } from './activity/types';
import { addActivityFolder, isFullFolderPath, sameFolderKey } from './activity/settings';
import { nextSwatchColor } from './projectCompletion';

/** The project name for a folder: its last path segment, or "<letter> drive" for a drive root such as C:\. */
export function folderProjectName(path: string): string {
  const t = path.trim();
  const drive = /^([A-Za-z]):[\\/]*$/.exec(t);
  if (drive) return `${drive[1].toUpperCase()} drive`;
  const parts = t.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? 'Root folder';
}

export type FolderProjectPlan =
  | {
      ok: true;
      projects: Project[];
      folders: ActivityFolder[];
      project: Project;
      created: boolean;
      /** The reused project was archived or in the Trash and is active again. */
      revived?: 'archived' | 'trashed';
    }
  | { ok: false; message: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const linkedMessage = (projects: Project[], linked: ActivityFolder): string => {
  const owner = projects.find((p) => p.id === linked.projectId);
  return owner ? `That folder is already linked to "${owner.name}".` : 'That folder is already linked to a project.';
};

/**
 * What the "New project" form does, without touching storage: reuse the project with this name
 * (case-insensitive; an archived or trashed one comes back) or create one, and link the folder to it
 * when there is one. The name falls back to the folder's last segment, the colour to the next unused
 * swatch. A folder that is already linked changes nothing and names its project.
 */
export function planProjectWithFolder(
  projects: Project[],
  folders: ActivityFolder[],
  input: { name?: string; color?: string; path?: string },
  newId: string,
): FolderProjectPlan {
  const path = input.path?.trim() ? input.path.trim() : undefined;
  if (path) {
    if (!isFullFolderPath(path)) return { ok: false, message: 'Enter the full folder path, like E:\\projects\\app.' };
    const linked = folders.find((f) => sameFolderKey(f.path) === sameFolderKey(path));
    if (linked) return { ok: false, message: linkedMessage(projects, linked) };
  }

  const name = input.name?.trim() || (path ? folderProjectName(path) : '');
  if (!name) return { ok: false, message: 'Give the project a name, or choose its folder.' };

  const existing = projects.find((p) => sameName(p.name, name));
  let project: Project;
  let next = projects;
  let revived: 'archived' | 'trashed' | undefined;
  if (existing) {
    if (!path && !existing.isArchived && !existing.trashedAt) {
      return { ok: false, message: `A project named "${existing.name}" already exists.` };
    }
    revived = existing.trashedAt ? 'trashed' : existing.isArchived ? 'archived' : undefined;
    if (revived) {
      const { trashedAt: _gone, ...rest } = existing;
      project = { ...rest, isArchived: false };
      next = projects.map((p) => (p.id === existing.id ? project : p));
    } else {
      project = existing;
    }
  } else {
    project = { id: newId, name, color: input.color ?? nextSwatchColor(projects), isArchived: false };
    next = [...projects, project];
  }

  if (!path) return { ok: true, projects: next, folders, project, created: !existing, revived };
  const added = addActivityFolder(folders, path, project.id);
  if (!added.ok) return { ok: false, message: added.error };
  return { ok: true, projects: next, folders: added.folders, project, created: !existing, revived };
}

export type RelinkResult = { ok: true; folders: ActivityFolder[] } | { ok: false; message: string };

/**
 * Points a project at a folder: it replaces `oldPath` (Change) or is added (no `oldPath`). A folder
 * linked to another project changes nothing and names that project.
 */
export function relinkFolder(
  projects: Project[],
  folders: ActivityFolder[],
  projectId: string,
  oldPath: string | undefined,
  newPath: string,
): RelinkResult {
  if (!isFullFolderPath(newPath)) return { ok: false, message: 'Enter the full folder path, like E:\\projects\\app.' };
  const linked = folders.find((f) => sameFolderKey(f.path) === sameFolderKey(newPath));
  if (linked) {
    const same = linked.projectId === projectId;
    if (same && oldPath !== undefined && sameFolderKey(oldPath) === sameFolderKey(newPath)) return { ok: true, folders };
    return { ok: false, message: same ? 'That folder is already linked to this project.' : linkedMessage(projects, linked) };
  }
  const base =
    oldPath === undefined ? folders : folders.filter((f) => !(f.projectId === projectId && sameFolderKey(f.path) === sameFolderKey(oldPath)));
  const added = addActivityFolder(base, newPath, projectId);
  return added.ok ? { ok: true, folders: added.folders } : { ok: false, message: added.error };
}

/** The folder links of one project. */
export const foldersOfProject = (folders: ActivityFolder[], projectId: string): ActivityFolder[] =>
  folders.filter((f) => f.projectId === projectId);

/** Drops one folder link. */
export const unlinkFolder = (folders: ActivityFolder[], path: string): ActivityFolder[] =>
  folders.filter((f) => sameFolderKey(f.path) !== sameFolderKey(path));
