import { describe, it, expect } from 'vitest';
import type { BacklogTask, Project } from '../types';
import { buildWidgetSnapshot, snapshotSignature, widgetConfig } from './widgets';

const TODAY = '2026-11-15';
const task = (o: Partial<BacklogTask> = {}): BacklogTask => ({
  id: 't', title: 'T', projectId: 'p1', dueDate: TODAY, completed: false, stage: 'planned',
  originalDate: TODAY, isRolledOver: false, elapsedSeconds: 0, ...o,
});
const projects: Project[] = [
  { id: 'p1', name: 'Alpha', color: '#2e86de', isArchived: false },
  { id: 'p2', name: 'Gone', color: '#d6455d', isArchived: false, trashedAt: '2026-11-01T00:00:00.000Z' },
];
const build = (backlog: BacklogTask[], extra: Partial<Parameters<typeof buildWidgetSnapshot>[0]> = {}) =>
  buildWidgetSnapshot({ theme: 'chase', backlog, projects, workdays: {}, workdayHours: undefined, today: TODAY, nowMs: 1000, ...extra });

describe('widgetConfig', () => {
  it('is off by default and on top once on', () => {
    expect(widgetConfig(undefined)).toEqual({ time: { on: false, top: true }, tasks: { on: false, top: true } });
    expect(widgetConfig({ tasks: { on: true, top: false } }).tasks).toEqual({ on: true, top: false });
  });
});

describe('buildWidgetSnapshot', () => {
  it('lists running first, then paused, blocked and planned; skips done and upcoming', () => {
    const snap = build([
      task({ id: 'a', stage: 'planned' }),
      task({ id: 'b', stage: 'blocked' }),
      task({ id: 'c', stage: 'paused', isRunning: false, dueDate: '2026-11-10' }),
      task({ id: 'd', stage: 'in_progress', isRunning: true }),
      task({ id: 'e', stage: 'done', completed: true }),
      task({ id: 'f', stage: 'planned', dueDate: '2026-11-20' }),
      task({ id: 'g', stage: 'planned', dueDate: '2026-11-10' }),
    ]);
    expect(snap.tasks.map((t) => t.id)).toEqual(['d', 'c', 'b', 'a', 'g']);
    expect(snap.tasks.map((t) => t.state)).toEqual(['running', 'paused', 'blocked', 'planned', 'planned']);
  });
  it('hides a trashed project and defaults the workday to 8 hours with no clock-in', () => {
    const snap = build([task({ projectId: 'p2' })]);
    expect(snap.tasks[0].project).toBe('');
    expect(snap.hours).toBe(8);
    expect(snap.clockIn).toBeNull();
  });
  it('uses the open workday record', () => {
    const snap = build([], { workdays: { [TODAY]: { clockIn: '2026-11-15T03:00:00.000Z' } }, workdayHours: 6 });
    expect(snap.clockIn).toBe('2026-11-15T03:00:00.000Z');
    expect(snap.hours).toBe(6);
  });
});

describe('snapshotSignature', () => {
  it('ignores ticking time but not a change of state', () => {
    const run = (s: number) => build([task({ stage: 'in_progress', isRunning: true, elapsedSeconds: s })]);
    expect(snapshotSignature(run(10))).toBe(snapshotSignature(run(11)));
    const paused = build([task({ stage: 'paused', isRunning: false, elapsedSeconds: 10 })]);
    expect(snapshotSignature(paused)).not.toBe(snapshotSignature(run(10)));
  });
});
