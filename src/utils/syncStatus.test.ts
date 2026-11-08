import { describe, it, expect } from 'vitest';
import { isUnsynced, unsyncedLogs } from './syncStatus';
import type { WorkLog } from '../types';

const log = (o: Partial<WorkLog>): WorkLog => ({
  id: 'l', date: '2026-11-08', time: '10:00', projectId: 'p', projectName: 'P', description: 'd',
  status: 'completed', tags: [], createdAt: '2026-11-08T10:00:00.000Z', ...o,
});

describe('isUnsynced (B2)', () => {
  it('a synced log is never sent again', () => {
    expect(isUnsynced(log({ syncedAt: '2026-11-08T10:01:00.000Z' }), '2026-01-01T00:00:00.000Z')).toBe(false);
  });
  it('a new log without syncedAt is sent', () => {
    expect(isUnsynced(log({}), '2026-11-01T00:00:00.000Z')).toBe(true);
  });
  it('a log from before tracking began is not re-sent (history may already be in the sheet)', () => {
    expect(isUnsynced(log({ createdAt: '2026-10-01T00:00:00.000Z' }), '2026-11-01T00:00:00.000Z')).toBe(false);
  });
  it('a log created in the same instant as the tracking start is not counted', () => {
    expect(isUnsynced(log({ createdAt: '2026-11-08T09:33:02.561Z' }), '2026-11-08T09:33:02.561Z')).toBe(false);
  });
  it('without a tracking date every unsynced log counts', () => {
    expect(isUnsynced(log({}), undefined)).toBe(true);
  });
  it('unsyncedLogs filters a list', () => {
    const list = [log({ id: 'a' }), log({ id: 'b', syncedAt: 'x' }), log({ id: 'c', createdAt: '2020-01-01T00:00:00.000Z' })];
    expect(unsyncedLogs(list, '2026-01-01T00:00:00.000Z').map((l) => l.id)).toEqual(['a']);
  });
});
