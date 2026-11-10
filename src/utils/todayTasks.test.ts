import { describe, it, expect } from 'vitest';
import { todaysTasks } from './todayTasks';
import type { BacklogTask } from '../types';

process.env.TZ = 'Asia/Dhaka';

const task = (id: string, over: Partial<BacklogTask> = {}): BacklogTask => ({
  id,
  title: id,
  projectId: 'p',
  dueDate: '2026-11-10',
  completed: false,
  stage: 'planned',
  originalDate: '2026-11-10',
  isRolledOver: false,
  ...over,
});

describe('todaysTasks', () => {
  const today = '2026-11-10';

  it('orders running, then paused/blocked, then planned, then done, keeping list order within a group', () => {
    const list = [
      task('done', { stage: 'done', completed: true, completedAt: '2026-11-10T04:00:00.000Z' }),
      task('plan1'),
      task('blocked', { stage: 'blocked' }),
      task('run', { stage: 'in_progress', isRunning: true }),
      task('plan2'),
      task('paused', { stage: 'paused' }),
    ];
    expect(todaysTasks(list, today).map((t) => t.id)).toEqual(['run', 'blocked', 'paused', 'plan1', 'plan2', 'done']);
  });

  it('keeps open tasks due today or earlier and a running task from any day; drops future ones', () => {
    const list = [
      task('future', { dueDate: '2026-11-11' }),
      task('late', { dueDate: '2026-11-08' }),
      task('runFuture', { dueDate: '2026-11-12', stage: 'in_progress', isRunning: true }),
    ];
    expect(todaysTasks(list, today).map((t) => t.id)).toEqual(['runFuture', 'late']);
  });

  it('shows done tasks finished today in local time only', () => {
    const list = [
      // 2026-11-09 20:00 UTC is 02:00 on the 10th in Dhaka: today
      task('earlyToday', { stage: 'done', completed: true, completedAt: '2026-11-09T20:00:00.000Z' }),
      // 2026-11-09 17:00 UTC is 23:00 on the 9th in Dhaka: yesterday
      task('yesterday', { stage: 'done', completed: true, completedAt: '2026-11-09T17:00:00.000Z' }),
      task('noStamp', { stage: 'done', completed: true }),
    ];
    expect(todaysTasks(list, today).map((t) => t.id)).toEqual(['earlyToday', 'noStamp']);
  });
});
