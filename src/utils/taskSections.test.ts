import { describe, it, expect } from 'vitest';
import { dayLabelLong, filterByProject, groupTasks, sectionProjectIds } from './taskSections';
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
  it('puts rolled-over and past-due open tasks in overdue, with the date they were added', () => {
    const g = groupTasks(
      [
        task('rolled', { isRolledOver: true, originalDate: '2026-11-09' }),
        task('stale', { dueDate: '2026-11-07', originalDate: '2026-11-05' }),
        task('fresh'),
      ],
      today,
    );
    expect(ids(g.overdue)).toEqual(['rolled', 'stale']);
    expect(ids(g.today)).toEqual(['fresh']);
    expect(g.overdueAdded.rolled).toBe('2026-11-09');
    // not rolled yet: still the day it was made, not the day it was due
    expect(g.overdueAdded.stale).toBe('2026-11-05');
  });

  it('groups upcoming tasks by date, earliest first, keeping list order within a date', () => {
    const g = groupTasks(
      [task('c', { dueDate: '2026-11-13' }), task('a', { dueDate: '2026-11-11' }), task('b', { dueDate: '2026-11-11' })],
      today,
    );
    expect(g.upcoming.map((d) => [d.date, ids(d.tasks)])).toEqual([
      ['2026-11-11', ['a', 'b']],
      ['2026-11-13', ['c']],
    ]);
  });

  it('shows every blocked open task in blocked, whatever its date, and nowhere else', () => {
    const g = groupTasks(
      [
        task('b1', { stage: 'blocked', blockReason: 'vendor key' }),
        task('b2', { stage: 'blocked', dueDate: '2026-11-15' }),
        task('b3', { stage: 'blocked', dueDate: '2026-11-08', isRolledOver: true }),
      ],
      today,
    );
    expect(ids(g.blocked)).toEqual(['b1', 'b2', 'b3']);
    expect(g.overdue).toEqual([]);
    expect(g.today).toEqual([]);
    expect(g.upcoming).toEqual([]);
  });

  it('keeps a running task under today even when it is due later, and orders running first', () => {
    const g = groupTasks(
      [
        task('plan'),
        task('paused', { stage: 'paused' }),
        task('run', { stage: 'in_progress', isRunning: true }),
        task('later', { dueDate: '2026-11-12', stage: 'in_progress', isRunning: true }),
      ],
      today,
    );
    expect(ids(g.today)).toEqual(['run', 'later', 'paused', 'plan']);
    expect(g.upcoming).toEqual([]);
  });

  it('lists done tasks of the last 7 local days, newest first', () => {
    const g = groupTasks(
      [
        done('old', '2026-11-03T10:00:00.000Z'), // 4 Nov-ish? 3 Nov 16:00 Dhaka: outside (window starts 4 Nov)
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
    task('c', { projectId: 'p2', stage: 'blocked' }),
    done('d', '2026-11-09T05:00:00.000Z', { projectId: 'p3' }),
  ];

  it('lists the projects that have something on the screen', () => {
    expect(sectionProjectIds(groupTasks(list, today)).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('keeps only one project in every section and drops emptied date groups', () => {
    const f = filterByProject(groupTasks(list, today), 'p2');
    expect(ids(f.today)).toEqual([]);
    expect(f.upcoming.map((d) => ids(d.tasks))).toEqual([['b']]);
    expect(ids(f.blocked)).toEqual(['c']);
    expect(f.doneRecently).toEqual([]);
    expect(filterByProject(groupTasks(list, today), null)).toEqual(groupTasks(list, today));
  });
});
