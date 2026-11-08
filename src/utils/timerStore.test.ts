import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRunningTask, liveSecondsOf, publishTimers, sameTasksIgnoringLiveTime, subscribeTimers } from './timerStore';
import type { BacklogTask } from '../types';

const task = (o: Partial<BacklogTask> = {}): BacklogTask => ({
  id: 't1', title: 'T', projectId: 'p', dueDate: '2026-11-08', completed: false, stage: 'in_progress',
  originalDate: '2026-11-08', isRolledOver: false, elapsedSeconds: 10, ...o,
});

describe('isRunningTask', () => {
  it('is in progress and not explicitly stopped', () => {
    expect(isRunningTask(task())).toBe(true);
    expect(isRunningTask(task({ isRunning: false }))).toBe(false);
    expect(isRunningTask(task({ stage: 'paused' }))).toBe(false);
  });
});

describe('live seconds', () => {
  beforeEach(() => publishTimers([]));
  it('shows the published value while running and the saved value otherwise', () => {
    const t = task({ elapsedSeconds: 10 });
    publishTimers([{ ...t, elapsedSeconds: 42 }]);
    expect(liveSecondsOf(t)).toBe(42);
    expect(liveSecondsOf(task({ stage: 'paused', elapsedSeconds: 7 }))).toBe(7);
  });
  it('tells subscribers on every publish, and stops after unsubscribe', () => {
    const fn = vi.fn();
    const off = subscribeTimers(fn);
    publishTimers([task()]);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    publishTimers([task()]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sameTasksIgnoringLiveTime', () => {
  it('ignores a running task ticking forward', () => {
    const a = [task({ elapsedSeconds: 10, blockReason: 'x' }), task({ id: 'b', stage: 'planned', elapsedSeconds: 0 })];
    const b = [{ ...a[0], elapsedSeconds: 11 }, a[1]];
    expect(sameTasksIgnoringLiveTime(a, b)).toBe(true);
  });
  it('notices any other change, including stage and the clock first appearing', () => {
    const a = [task({ elapsedSeconds: 10 })];
    expect(sameTasksIgnoringLiveTime(a, [{ ...a[0], title: 'New' }])).toBe(false);
    expect(sameTasksIgnoringLiveTime(a, [{ ...a[0], stage: 'paused', elapsedSeconds: 11 }])).toBe(false);
    expect(sameTasksIgnoringLiveTime([task({ elapsedSeconds: 0 })], [task({ elapsedSeconds: 1 })])).toBe(false);
    expect(sameTasksIgnoringLiveTime(a, [])).toBe(false);
  });
  it('does not ignore time changes on a task that is not running', () => {
    const a = [task({ stage: 'paused', elapsedSeconds: 10 })];
    expect(sameTasksIgnoringLiveTime(a, [{ ...a[0], elapsedSeconds: 11 }])).toBe(false);
  });
});
