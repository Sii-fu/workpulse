import { describe, it, expect } from 'vitest';
import { dayLabelLong, earlierPlans, filterByProject, groupTasks, sectionProjectIds } from './taskSections';
import type { BacklogTask } from '../types';

process.env.TZ = 'Asia/Dhaka';

const today = '2026-11-10';
const task = (id: string, over: Partial<BacklogTask> = {}): BacklogTask => ({
  id,
  title: id,
  projectId: 'p',
  dueDate: today,
  completed: false,
  stage: 'planned',
  originalDate: today,
  isRolledOver: false,
  ...over,
});
const done = (id: string, completedAt: string, over: Partial<BacklogTask> = {}) =>
  task(id, { stage: 'done', completed: true, completedAt, ...over });
const ids = (list: BacklogTask[]) => list.map((t) => t.id);

describe('dayLabelLong', () => {
  it('writes weekday, day and month', () => {
    expect(dayLabelLong('2026-11-09')).toBe('Mon 9 Nov');
    expect(dayLabelLong('2026-12-01')).toBe('Tue 1 Dec');
  });
});

describe('groupTasks', () => {
  it('puts only planned tasks in the Plans column: today, earlier days newest first, upcoming oldest first', () => {
    const g = groupTasks(
      [
        task('two', { dueDate: '2026-11-08' }),
        task('y1', { dueDate: '2026-11-09' }),
        task('yb', { dueDate: '2026-11-09', stage: 'blocked', blockReason: 'vendor key' }),
        task('fresh'),
        task('tom2', { dueDate: '2026-11-12' }),
        task('tom', { dueDate: '2026-11-11' }),
        task('rolled', { dueDate: '2026-11-10', isRolledOver: true, originalDate: '2026-11-08' }),
      ],
      today,
    );
    expect(ids(g.plans.today)).toEqual(['fresh', 'rolled']);
    expect(g.plans.earlier.map((d) => [d.date, ids(d.tasks)])).toEqual([
      ['2026-11-09', ['y1']],
      ['2026-11-08', ['two']],
    ]);
    expect(g.plans.upcoming.map((d) => [d.date, ids(d.tasks)])).toEqual([
      ['2026-11-11', ['tom']],
      ['2026-11-12', ['tom2']],
    ]);
    // The blocked task is started work: left column, under its own date. Nothing is in both columns.
    expect(g.earlier.map((d) => [d.date, ids(d.tasks)])).toEqual([['2026-11-09', ['yb']]]);
    expect(g.today).toEqual([]);
    expect(g.upcoming).toEqual([]);
    expect(g.doneRecently).toEqual([]);
  });

  it('keeps paused and blocked tasks under their own date, earlier days newest first, later days oldest first', () => {
    const g = groupTasks(
      [
        task('p8', { dueDate: '2026-11-08', stage: 'paused' }),
        task('b9', { dueDate: '2026-11-09', stage: 'blocked' }),
        task('p9', { dueDate: '2026-11-09', stage: 'paused' }),
        task('pToday', { stage: 'paused' }),
        task('pLater2', { dueDate: '2026-11-13', stage: 'paused' }),
        task('pLater', { dueDate: '2026-11-11', stage: 'paused' }),
      ],
      today,
    );
    expect(g.earlier.map((d) => [d.date, ids(d.tasks)])).toEqual([
      ['2026-11-09', ['b9', 'p9']],
      ['2026-11-08', ['p8']],
    ]);
    expect(ids(g.today)).toEqual(['pToday']);
    expect(g.upcoming.map((d) => [d.date, ids(d.tasks)])).toEqual([
      ['2026-11-11', ['pLater']],
      ['2026-11-13', ['pLater2']],
    ]);
    expect(g.plans).toEqual({ today: [], earlier: [], upcoming: [] });
  });

  it('keeps a running task under today even when it is due later, running first, and no planned task there', () => {
    const g = groupTasks(
      [
        task('plan'),
        task('paused', { stage: 'paused' }),
        task('run', { stage: 'in_progress', isRunning: true }),
        task('later', { dueDate: '2026-11-12', stage: 'in_progress', isRunning: true }),
      ],
      today,
    );
    expect(ids(g.today)).toEqual(['run', 'later', 'paused']);
    expect(g.upcoming).toEqual([]);
    expect(ids(g.plans.today)).toEqual(['plan']);
  });

  it('lists done tasks of the last 7 local days, newest first', () => {
    const g = groupTasks(
      [
        done('old', '2026-11-03T10:00:00.000Z'), // 3 Nov 16:00 Dhaka: outside (window starts 4 Nov)
        done('edge', '2026-11-03T18:30:00.000Z'), // 4 Nov 00:30 Dhaka: inside
        done('early', '2026-11-09T20:00:00.000Z'), // 10 Nov 02:00 Dhaka
        done('mid', '2026-11-08T05:00:00.000Z'),
        done('future', '2026-11-12T05:00:00.000Z'), // clock skew: not recent
        task('open'),
      ],
      today,
    );
    expect(ids(g.doneRecently)).toEqual(['early', 'mid', 'edge']);
  });

  it('falls back to the due date for a done task with no completion time', () => {
    const g = groupTasks([task('nostamp', { stage: 'done', completed: true, dueDate: '2026-11-09' })], today);
    expect(ids(g.doneRecently)).toEqual(['nostamp']);
  });
});

describe('filterByProject and sectionProjectIds', () => {
  const list = [
    task('a', { projectId: 'p1' }),
    task('b', { projectId: 'p2', dueDate: '2026-11-11' }),
    task('c', { projectId: 'p2', stage: 'blocked', dueDate: '2026-11-09' }),
    task('e', { projectId: 'p1', dueDate: '2026-11-09' }),
    task('f', { projectId: 'p2', dueDate: '2026-11-09' }),
    done('d', '2026-11-09T05:00:00.000Z', { projectId: 'p3' }),
  ];

  it('lists the projects that have something on the screen', () => {
    expect(sectionProjectIds(groupTasks(list, today)).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('keeps only one project in both columns and drops emptied date groups', () => {
    const f = filterByProject(groupTasks(list, today), 'p2');
    expect(ids(f.today)).toEqual([]);
    expect(f.plans.upcoming.map((d) => ids(d.tasks))).toEqual([['b']]);
    expect(f.plans.earlier.map((d) => [d.date, ids(d.tasks)])).toEqual([['2026-11-09', ['f']]]);
    expect(f.earlier.map((d) => [d.date, ids(d.tasks)])).toEqual([['2026-11-09', ['c']]]);
    expect(f.doneRecently).toEqual([]);
    const p3 = filterByProject(groupTasks(list, today), 'p3');
    expect(p3.earlier).toEqual([]);
    expect(p3.plans.earlier).toEqual([]);
    expect(filterByProject(groupTasks(list, today), null)).toEqual(groupTasks(list, today));
  });
});

describe('earlierPlans', () => {
  it('groups planned tasks due before today, newest date first, leaving out started, done and running ones', () => {
    const g = earlierPlans(
      [
        task('a', { dueDate: '2026-11-08' }),
        task('b', { dueDate: '2026-11-09' }),
        task('c', { dueDate: '2026-11-09', stage: 'blocked' }),
        task('d', { dueDate: '2026-11-09', stage: 'done', completed: true }),
        task('r', { dueDate: '2026-11-09', stage: 'in_progress', isRunning: true }),
        task('e'),
      ],
      today,
    );
    expect(g.map((x) => [x.date, ids(x.tasks)])).toEqual([
      ['2026-11-09', ['b']],
      ['2026-11-08', ['a']],
    ]);
  });
});
