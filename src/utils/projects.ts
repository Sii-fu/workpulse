import { Project } from '../types';

// Archived projects are hidden from pickers; a log must never default to one (B13).
export const activeProjectsOf = (projects: Project[]): Project[] => projects.filter((p) => !p.isArchived);

// First non-archived project, or (if every project is archived) the first one.
export const defaultProject = (projects: Project[]): Project | undefined =>
  projects.find((p) => !p.isArchived) || projects[0];

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
