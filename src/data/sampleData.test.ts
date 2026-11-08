import { describe, expect, it } from 'vitest';
import { isSampleLog, isSampleProject, isSampleTask, sampleCounts, withoutSampleData } from './sampleData';
import { getInitialSeedData } from './seedData';
import { unsyncedLogs } from '../utils/syncStatus';
import type { WorkLog, BacklogTask, Project } from '../types';

const seed = getInitialSeedData();
const general = (): Project => ({ id: 'proj-1735689600000', name: 'General', color: '#6366f1', isArchived: false });
const realLog = (over: Partial<WorkLog> = {}): WorkLog => ({
  ...seed.logs[0], id: 'log-1735689600000-ab12', isSynthesized: false, underlyingTasks: undefined, ...over,
});

describe('recognising sample data', () => {
  it('knows every seed item and nothing else', () => {
    expect(seed.logs.every(isSampleLog)).toBe(true);
    expect(seed.backlog.every(isSampleTask)).toBe(true);
    expect(seed.projects.every(isSampleProject)).toBe(true);
    expect(isSampleLog(realLog())).toBe(false);
    expect(isSampleTask({ id: 'task-1735689600000-zz99' })).toBe(false);
    expect(isSampleProject({ id: 'proj-1735689600000' })).toBe(false);
  });
  it('real ids are built with a timestamp, so they cannot equal a sample id', () => {
    // the shapes the app generates (App.tsx): log-<ms>-<rand>, log-<ms>, task-<ms>-<rand>, proj-<ms>
    for (const id of [`log-${Date.now()}-ab12`, `log-${Date.now()}`, `task-${Date.now()}-ab12`, `proj-${Date.now()}`, `log-eod-${Date.now()}-ab12`]) {
      expect(isSampleLog({ id }) || isSampleTask({ id }) || isSampleProject({ id })).toBe(false);
    }
  });
  it('counts what is still on screen', () => {
    expect(sampleCounts([...seed.logs, realLog()], seed.backlog)).toEqual({ logs: 6, tasks: 5, total: 11 });
    expect(sampleCounts([realLog()], []).total).toBe(0);
  });
});

describe('withoutSampleData', () => {
  it('removes the demo logs and tasks and keeps real work', () => {
    const mine = realLog({ projectId: 'proj-1735689600000', projectName: 'Mine' });
    const myProject: Project = { id: 'proj-1735689600000', name: 'Mine', color: '#000', isArchived: false };
    const out = withoutSampleData([mine, ...seed.logs], seed.backlog, [...seed.projects, myProject], general);
    expect(out.logs).toEqual([mine]);
    expect(out.backlog).toEqual([]);
    expect(out.projects).toEqual([myProject]);
  });
  it('keeps a demo project that real work still uses', () => {
    const mine = realLog({ projectId: 'proj-2', projectName: 'Frontend & Design System' });
    const out = withoutSampleData([mine, ...seed.logs], seed.backlog, seed.projects, general);
    expect(out.projects.map((p) => p.id)).toEqual(['proj-2']);
  });
  it('adds a General project when none is left', () => {
    const out = withoutSampleData(seed.logs, seed.backlog, seed.projects, general);
    expect(out.projects).toEqual([general()]);
    expect(out.logs).toEqual([]);
  });
  it('keeps a real task on a demo project', () => {
    const task = { ...(seed.backlog[0] as BacklogTask), id: 'task-1735689600000-zz99', projectId: 'proj-3' };
    const out = withoutSampleData([], [task, ...seed.backlog], seed.projects, general);
    expect(out.backlog).toEqual([task]);
    expect(out.projects.map((p) => p.id)).toEqual(['proj-3']);
  });
});

describe('sample logs and the Sheet', () => {
  it('are never offered for sync, even edited or newer than the tracking date', () => {
    const edited = { ...seed.logs[0], editedAt: '2999-01-01T00:00:00.000Z' };
    const mine = realLog({ createdAt: '2999-01-01T00:00:00.000Z' });
    const out = unsyncedLogs([edited, ...seed.logs, mine], '2000-01-01T00:00:00.000Z');
    expect(out).toEqual([mine]);
  });
});
