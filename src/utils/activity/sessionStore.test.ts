import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ActivitySession,
  checkedToday,
  getActivitySession,
  invalidateActivitySessions,
  pendingCount,
  resetActivitySessions,
  setActivitySession,
  subscribeActivitySession,
} from './sessionStore';
import type { Suggestion } from './types';

const suggestion = (key: string): Suggestion =>
  ({ key, folder: 'E:/demo', projectId: 'p1', projectName: 'Demo', text: key, subtasks: [], minutes: 10, itemIds: [key], evidence: '1 commit', trackedMinutes: 0 });

const session = (keys: string[]): ActivitySession => ({
  result: { suggestions: keys.map(suggestion), status: { claude: { ok: true, count: 0 }, git: { ok: true, count: keys.length } } },
  rows: keys.map((k) => ({ suggestion: suggestion(k), checked: false, text: k, projectId: 'p1', minutes: '10', subtasks: '' })),
  addedCount: 0,
  checked: true,
});

describe('activity session store', () => {
  beforeEach(() => resetActivitySessions());

  it('is empty before any check', () => {
    expect(getActivitySession('2026-11-10')).toBeNull();
    expect(pendingCount('2026-11-10')).toBe(0);
    expect(checkedToday('2026-11-10')).toBe(false);
  });

  it('counts the suggestions not added yet and marks the day checked', () => {
    setActivitySession('2026-11-10', session(['a', 'b', 'c']));
    expect(pendingCount('2026-11-10')).toBe(3);
    expect(checkedToday('2026-11-10')).toBe(true);
  });

  it('a check with nothing found still counts as checked', () => {
    setActivitySession('2026-11-10', session([]));
    expect(pendingCount('2026-11-10')).toBe(0);
    expect(checkedToday('2026-11-10')).toBe(true);
  });

  it('keeps each date separate', () => {
    setActivitySession('2026-11-09', session(['a']));
    expect(getActivitySession('2026-11-10')).toBeNull();
    expect(checkedToday('2026-11-10')).toBe(false);
    expect(pendingCount('2026-11-10')).toBe(0);
    setActivitySession('2026-11-10', session(['x', 'y']));
    expect(pendingCount('2026-11-09')).toBe(1);
    expect(pendingCount('2026-11-10')).toBe(2);
  });

  it('tells subscribers about every write, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const off = subscribeActivitySession(listener);
    setActivitySession('2026-11-10', session(['a']));
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    setActivitySession('2026-11-10', session([]));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns the same object until the next write (stable for useSyncExternalStore)', () => {
    const s = session(['a']);
    setActivitySession('2026-11-10', s);
    expect(getActivitySession('2026-11-10')).toBe(s);
    expect(getActivitySession('2026-11-10')).toBe(getActivitySession('2026-11-10'));
  });
});

describe('invalidateActivitySessions', () => {
  it('forgets every kept check and tells listeners, and does nothing when empty', () => {
    resetActivitySessions();
    let calls = 0;
    const off = subscribeActivitySession(() => {
      calls++;
    });
    invalidateActivitySessions();
    expect(calls).toBe(0);
    setActivitySession('2026-11-10', { result: { suggestions: [], status: {} } as never, rows: [], addedCount: 0, checked: true });
    calls = 0;
    invalidateActivitySessions();
    expect(checkedToday('2026-11-10')).toBe(false);
    expect(calls).toBe(1);
    off();
  });
});
