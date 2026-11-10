import { describe, it, expect } from 'vitest';
import { dayHeading, moveRunningToDay, moveTasksToDay } from './taskDates';
import type { BacklogTask } from '../types';

process.env.TZ = 'Asia/Dhaka';

const task = (id: string, over: Partial<BacklogTask> = {}): BacklogTask => ({
  id,
  title: id,
  projectId: 'p',
  dueDate: '2026-11-09',
  completed: false,
  stage: 'planned',
  originalDate: '2026-11-09',
  isRolledOver: false,
  ...over,
});
const today = '2026-11-10';

describe('moveTasksToDay', () => {
  it('moves only the listed pending tasks and leaves done ones', () => {
    const list = [
      task('a'),
      task('b'),
      task('c', { stage: 'done', completed: true }),
      task('d', { dueDate: today }),
    ];
    const out = moveTasksToDay(list, ['a', 'c', 'd'], today);
    expect(out.map((t) => [t.id, t.dueDate])).toEqual([
      ['a', today],
      ['b', '2026-11-09'],
      ['c', '2026-11-09'],
      ['d', today],
    ]);
  });

  it('returns the identical array when nothing changes', () => {
    const list = [task('a', { dueDate: today }), task('b', { stage: 'done', completed: true })];
    expect(moveTasksToDay(list, ['a', 'b', 'zzz'], today)).toBe(list);
  });
});

describe('moveRunningToDay', () => {
  it('moves a running task due yesterday and leaves a paused one', () => {
    const list = [task('run', { stage: 'in_progress', isRunning: true }), task('paused', { stage: 'paused' })];
    const out = moveRunningToDay(list, today);
    expect(out[0].dueDate).toBe(today);
    expect(out[1].dueDate).toBe('2026-11-09');
  });

  it('returns the identical array when no running task is dated elsewhere', () => {
    const list = [task('run', { dueDate: today, stage: 'in_progress', isRunning: true }), task('p')];
    expect(moveRunningToDay(list, today)).toBe(list);
  });
});

describe('dayHeading', () => {
  it('says Today, Tomorrow and Yesterday, else the long label', () => {
    expect(dayHeading('2026-11-10', today)).toBe('Today');
    expect(dayHeading('2026-11-09', today)).toBe('Yesterday');
    expect(dayHeading('2026-11-11', today)).toBe('Tomorrow');
    expect(dayHeading('2026-11-05', today)).toBe('Thu 5 Nov');
  });
});
