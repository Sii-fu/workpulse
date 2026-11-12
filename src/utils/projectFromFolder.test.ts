import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { SWATCHES } from '../components/v2/ProjectSwatches';
import { folderProjectName, planProjectWithFolder } from './projectFromFolder';

const proj = (id: string, name: string, color: string, isArchived = false): Project => ({ id, name, color, isArchived });
const planProjectFromFolder = (projects: Project[], folders: { path: string; projectId: string }[], path: string, id: string) =>
  planProjectWithFolder(projects, folders, { path }, id);

describe('folderProjectName', () => {
  it('uses the last path segment', () => {
    expect(folderProjectName('C:\\work\\HMIS')).toBe('HMIS');
    expect(folderProjectName('C:\\work\\HMIS\\')).toBe('HMIS');
    expect(folderProjectName('/home/me/app/')).toBe('app');
    expect(folderProjectName('E:/a/b c')).toBe('b c');
  });
  it('names a drive root "<letter> drive"', () => {
    expect(folderProjectName('C:\\')).toBe('C drive');
    expect(folderProjectName('d:/')).toBe('D drive');
  });
});

describe('planProjectFromFolder', () => {
  it('creates a project with the next unused swatch and links the folder', () => {
    const existing = [proj('p1', 'General', SWATCHES[0].hex)];
    const plan = planProjectFromFolder(existing, [], 'C:\\work\\HMIS', 'proj-9');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.created).toBe(true);
    expect(plan.project).toEqual({ id: 'proj-9', name: 'HMIS', color: SWATCHES[1].hex, isArchived: false });
    expect(plan.projects).toHaveLength(2);
    expect(plan.folders).toEqual([{ path: 'C:\\work\\HMIS', projectId: 'proj-9' }]);
  });

  it('reuses a project with the same name, ignoring case', () => {
    const existing = [proj('p1', 'hmis', SWATCHES[0].hex)];
    const plan = planProjectFromFolder(existing, [], 'C:\\work\\HMIS', 'proj-9');
    expect(plan.ok && plan.created).toBe(false);
    if (!plan.ok) return;
    expect(plan.projects).toBe(existing);
    expect(plan.folders[0].projectId).toBe('p1');
  });

  it('un-archives a reused archived project', () => {
    const existing = [proj('p1', 'HMIS', SWATCHES[0].hex, true), proj('p2', 'General', SWATCHES[1].hex)];
    const plan = planProjectFromFolder(existing, [], 'C:\\work\\HMIS', 'proj-9');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.revived).toBe('archived');
    expect(plan.projects.find((p) => p.id === 'p1')?.isArchived).toBe(false);
  });

  it('does nothing and names the owner when the folder is already linked', () => {
    const existing = [proj('p1', 'HMIS', SWATCHES[0].hex)];
    const plan = planProjectFromFolder(existing, [{ path: 'C:\\work\\HMIS', projectId: 'p1' }], 'c:/work/hmis/', 'proj-9');
    expect(plan).toEqual({ ok: false, message: 'That folder is already linked to "HMIS".' });
  });

  it('rejects a path that is not a full path', () => {
    const plan = planProjectFromFolder([], [], 'HMIS', 'proj-9');
    expect(plan.ok).toBe(false);
  });
});
