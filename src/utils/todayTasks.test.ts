import { describe, it, expect } from 'vitest';
import { todayStateGroups } from './todayTasks';
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
const ids = (list: BacklogTask[]) => list.map((t) => t.id);

describe('todayStateGroups', () => {
  it('splits into running, paused, blocked, up next and done, keeping list order within a group', () => {
    const g = todayStateGroups(
      [
        task('done', { stage: 'done', completed: true, completedAt: '2026-11-10T04:00:00.000Z' }),
        task('plan1'),
        task('blocked', { stage: 'blocked', blockReason: 'vendor key' }),
        task('run', { stage: 'in_progress', isRunning: true }),
        task('plan2'),
        task('paused', { stage: 'paused' }),
      ],
      today,
    );
    expect(ids(g.running)).toEqual(['run']);
    expect(ids(g.paused)).toEqual(['paused']);
    expect(ids(g.blocked)).toEqual(['blocked']);
    expect(ids(g.upNext)).toEqual(['plan1', 'plan2']);
    expect(ids(g.done)).toEqual(['done']);
    expect(g.earlierPlans).toBe(0);
  });

  it('includes running, paused and blocked tasks of any date', () => {
    const g = todayStateGroups(
      [
        task('runOld', { dueDate: '2026-11-08', stage: 'in_progress', isRunning: true }),
        task('runLater', { dueDate: '2026-11-12', stage: 'in_progress', isRunning: true }),
        task('pausedOld', { dueDate: '2026-11-09', stage: 'paused' }),
        task('blockedOld', { dueDate: '2026-11-07', stage: 'blocked' }),
        task('idle', { dueDate: '2026-11-09', stage: 'in_progress', isRunning: false }),
      ],
      today,
    );
    expect(ids(g.running)).toEqual(['runOld', 'runLater']);
    expect(ids(g.paused)).toEqual(['pausedOld', 'idle']);
    expect(ids(g.blocked)).toEqual(['blockedOld']);
  });

  it('puts only planned tasks due today in up next and counts the earlier ones', () => {
    const g = todayStateGroups(
      [
        task('now'),
        task('late', { dueDate: '2026-11-08' }),
        task('late2', { dueDate: '2026-11-09' }),
        task('future', { dueDate: '2026-11-11' }),
      ],
      today,
    );
    expect(ids(g.upNext)).toEqual(['now']);
    expect(g.earlierPlans).toBe(2);
  });

  it('shows done tasks finished today in local time only', () => {
    const g = todayStateGroups(
      [
        // 2026-11-09 20:00 UTC is 02:00 on the 10th in Dhaka: today
        task('earlyToday', { stage: 'done', completed: true, completedAt: '2026-11-09T20:00:00.000Z' }),
        // 2026-11-09 17:00 UTC is 23:00 on the 9th in Dhaka: yesterday
        task('yesterday', { stage: 'done', completed: true, completedAt: '2026-11-09T17:00:00.000Z' }),
        task('noStamp', { stage: 'done', completed: true }),
        task('noStampOld', { stage: 'done', completed: true, dueDate: '2026-11-08' }),
      ],
      today,
    );
    expect(ids(g.done)).toEqual(['earlyToday', 'noStamp']);
  });
});
