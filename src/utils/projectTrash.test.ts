import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { SWATCHES } from '../components/v2/ProjectSwatches';
import { foldersOfProject, planProjectWithFolder, relinkFolder, unlinkFolder } from './projectFromFolder';
import {
  activeProjectsOf,
  defaultProject,
  deleteProjectForever,
  liveProjectsOf,
  projectUse,
  restoreProject,
  shortFolder,
  splitProjectTag,
  trashedProjectsOf,
  trashProject,
} from './projects';

const NOW = '2026-11-12T08:00:00.000Z';
const blue = SWATCHES[0].hex;
const proj = (id: string, name: string, isArchived = false): Project => ({ id, name, color: blue, isArchived });

describe('planProjectWithFolder', () => {
  it('creates a project with the chosen name and colour and its folder', () => {
    const plan = planProjectWithFolder([], [], { name: ' Billing ', color: SWATCHES[4].hex, path: 'E:\\code\\bill\\' }, 'proj-1');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.project).toEqual({ id: 'proj-1', name: 'Billing', color: SWATCHES[4].hex, isArchived: false });
    expect(plan.folders).toEqual([{ path: 'E:\\code\\bill', projectId: 'proj-1' }]);
  });

  it('works without a folder and leaves the links alone', () => {
    const folders = [{ path: 'C:\\a', projectId: 'p1' }];
    const plan = planProjectWithFolder([proj('p1', 'A')], folders, { name: 'Plain' }, 'proj-2');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.folders).toBe(folders);
    expect(plan.project.color).toBe(SWATCHES[1].hex);
  });

  it('takes the name from the folder when the name is empty', () => {
    const plan = planProjectWithFolder([], [], { name: '  ', path: 'C:\\work\\HMIS' }, 'proj-3');
    expect(plan.ok && plan.project.name).toBe('HMIS');
  });

  it('needs a name or a folder', () => {
    expect(planProjectWithFolder([], [], { name: ' ' }, 'x').ok).toBe(false);
  });

  it('refuses a name that is already active, but brings back an archived or trashed one', () => {
    const active = planProjectWithFolder([proj('p1', 'App')], [], { name: 'app' }, 'x');
    expect(active).toEqual({ ok: false, message: 'A project named "App" already exists.' });

    const trashed: Project = { ...proj('p1', 'App'), trashedAt: NOW };
    const back = planProjectWithFolder([trashed], [], { name: 'App', path: 'C:\\app' }, 'x');
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.revived).toBe('trashed');
    expect(back.projects[0]).toEqual({ id: 'p1', name: 'App', color: blue, isArchived: false });
    expect(back.folders).toEqual([{ path: 'C:\\app', projectId: 'p1' }]);
  });

  it('changes nothing and names the owner when the folder belongs to another project', () => {
    const plan = planProjectWithFolder(
      [proj('p1', 'HMIS')],
      [{ path: 'C:\\work\\HMIS', projectId: 'p1' }],
      { name: 'Other', path: 'c:/work/hmis' },
      'x',
    );
    expect(plan).toEqual({ ok: false, message: 'That folder is already linked to "HMIS".' });
  });
});

describe('folder links of a project', () => {
  const projects = [proj('p1', 'A'), proj('p2', 'B')];
  const folders = [
    { path: 'C:\\a', projectId: 'p1' },
    { path: 'C:\\b', projectId: 'p2' },
  ];

  it('Change replaces the old path and keeps the other links', () => {
    expect(relinkFolder(projects, folders, 'p1', 'C:\\a', 'C:\\a2')).toEqual({
      ok: true,
      folders: [
        { path: 'C:\\b', projectId: 'p2' },
        { path: 'C:\\a2', projectId: 'p1' },
      ],
    });
  });

  it('Add folder appends a link', () => {
    const res = relinkFolder(projects, folders, 'p1', undefined, 'C:\\c');
    expect(res.ok && res.folders).toHaveLength(3);
  });

  it('refuses a folder linked to another project, naming it, and a path that is not full', () => {
    expect(relinkFolder(projects, folders, 'p1', 'C:\\a', 'c:/b/')).toEqual({ ok: false, message: 'That folder is already linked to "B".' });
    expect(relinkFolder(projects, folders, 'p1', undefined, 'rel')).toMatchObject({ ok: false });
  });

  it('picking the folder it already has changes nothing', () => {
    expect(relinkFolder(projects, folders, 'p1', 'C:\\a', 'C:\\a')).toEqual({ ok: true, folders });
  });

  it("lists a project's folders and drops one link", () => {
    expect(foldersOfProject(folders, 'p2')).toEqual([{ path: 'C:\\b', projectId: 'p2' }]);
    expect(unlinkFolder(folders, 'c:/A/')).toEqual([{ path: 'C:\\b', projectId: 'p2' }]);
  });
});

describe('the Trash', () => {
  const list: Project[] = [proj('a', 'A'), proj('b', 'B', true), { ...proj('c', 'C'), trashedAt: NOW }];

  it('hides trashed (and archived) projects from pickers, lists and defaults', () => {
    expect(activeProjectsOf(list).map((x) => x.id)).toEqual(['a']);
    expect(liveProjectsOf(list).map((x) => x.id)).toEqual(['a', 'b']);
    expect(trashedProjectsOf(list).map((x) => x.id)).toEqual(['c']);
    expect(defaultProject(list)?.id).toBe('a');
    expect(defaultProject([list[2], list[1]])?.id).toBe('b');
    expect(defaultProject([list[2]])).toBeUndefined();
  });

  it('a #tag does not pick a trashed project', () => {
    expect(splitProjectTag('Do it #c', list)).toEqual({ text: 'Do it #c', tag: 'c' });
  });

  it('trash then restore gives back the same project; archived stays archived', () => {
    const trashed = trashProject(list.slice(0, 2), 'b', NOW);
    expect(trashed[1]).toEqual({ ...list[1], trashedAt: NOW });
    expect(trashed[0]).toBe(list[0]);
    const back = restoreProject(trashed, 'b');
    expect(back[1]).toEqual(list[1]);
    expect('trashedAt' in back[1]).toBe(false);
  });

  it('delete forever removes the record and its folder links, nothing else', () => {
    const folders = [
      { path: 'C:\\a', projectId: 'a' },
      { path: 'C:\\c', projectId: 'c' },
      { path: 'C:\\c2', projectId: 'c' },
    ];
    const out = deleteProjectForever(list, folders, 'c');
    expect(out.projects.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out.folders).toEqual([{ path: 'C:\\a', projectId: 'a' }]);
  });

  it('counts the tasks and logs that use a project', () => {
    expect(projectUse('c', [{ projectId: 'c' }, { projectId: 'a' }], [{ projectId: 'c' }, { projectId: 'c' }])).toEqual({ tasks: 1, logs: 2 });
  });
});

describe('shortFolder', () => {
  it('keeps the last two segments', () => {
    expect(shortFolder('C:\\work\\clients\\HMIS')).toBe('...\\clients\\HMIS');
    expect(shortFolder('E:\\code')).toBe('E:\\code');
    expect(shortFolder('C:\\')).toBe('C:\\');
    expect(shortFolder('/home/me/app/')).toBe('...\\me\\app');
  });
});
