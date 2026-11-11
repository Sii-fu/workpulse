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
  | { ok: true; projects: Project[]; folders: ActivityFolder[]; project: Project; created: boolean; unarchived: boolean }
  | { ok: false; message: string };

/**
 * What "Add project from folder" does, without touching storage: reuse the project with this name
 * (case-insensitive, un-archived if needed) or create one with the next unused swatch, and link the
 * folder to it. A folder that is already linked changes nothing and names its project.
 */
export function planProjectFromFolder(
  projects: Project[],
  folders: ActivityFolder[],
  path: string,
  newId: string,
): FolderProjectPlan {
  if (!isFullFolderPath(path)) return { ok: false, message: 'Enter the full folder path, like E:\\projects\\app.' };

  const linked = folders.find((f) => sameFolderKey(f.path) === sameFolderKey(path));
  if (linked) {
    const owner = projects.find((p) => p.id === linked.projectId);
    return {
      ok: false,
      message: owner ? `That folder is already linked to "${owner.name}".` : 'That folder is already linked to a project.',
    };
  }

  const name = folderProjectName(path);
  const existing = projects.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
  let project: Project;
  let next = projects;
  let unarchived = false;
  if (existing) {
    unarchived = existing.isArchived === true;
    project = unarchived ? { ...existing, isArchived: false } : existing;
    if (unarchived) next = projects.map((p) => (p.id === existing.id ? project : p));
  } else {
    project = { id: newId, name, color: nextSwatchColor(projects), isArchived: false };
    next = [...projects, project];
  }

  const added = addActivityFolder(folders, path, project.id);
  if (!added.ok) return { ok: false, message: added.error };
  return { ok: true, projects: next, folders: added.folders, project, created: !existing, unarchived };
}
