import { Project } from '../types';

// Archived projects are hidden from pickers; a log must never default to one (B13).
export const activeProjectsOf = (projects: Project[]): Project[] => projects.filter((p) => !p.isArchived);

// First non-archived project, or (if every project is archived) the first one.
export const defaultProject = (projects: Project[]): Project | undefined =>
  projects.find((p) => !p.isArchived) || projects[0];
