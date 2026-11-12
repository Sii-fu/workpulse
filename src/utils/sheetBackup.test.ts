import { describe, it, expect } from 'vitest';
import type { BackupData, BacklogTask } from '../types';
import { DEFAULT_SETTINGS } from '../data/seedData';
import {
  BACKUP_DEBOUNCE_MS,
  LOAD_BACKUP_AFTER_MS,
  RETRY_AFTER_FAILURE_MS,
  RUNNING_BACKUP_MS,
  backupCounts,
  backupSignature,
  hasRealData,
  buildSheetBackup,
  shouldBackup,
} from './sheetBackup';

const task = (over: Partial<BacklogTask> = {}): BacklogTask =>
  ({ id: 't1', title: 'Write', stage: 'planned', elapsedSeconds: 0, dueDate: '2026-11-11', ...over }) as BacklogTask;
const data = (over: Partial<BackupData> = {}): BackupData => ({
  logs: [{ id: 'l1', date: '2026-11-11', description: 'x', minutes: 5, imageBase64: 'data:image/png;base64,AAAA' } as any],
  backlog: [task()],
  projects: [{ id: 'p1', name: 'A', color: '#f00' } as any],
  tags: ['x'],
  settings: { ...DEFAULT_SETTINGS, geminiApiKey: 'KEY', phoneToken: 'TOKEN' },
  workdays: {},
  ...over,
});

describe('backupSignature', () => {
  it('ignores the ticking seconds and segment ends of a running timer', () => {
    const run = (s: number, end?: string) =>
      data({ backlog: [task({ stage: 'in_progress', isRunning: true, elapsedSeconds: s, segments: [{ start: '2026-11-11T03:00:00Z', end }] })] });
    expect(backupSignature(run(10))).toBe(backupSignature(run(4000, '2026-11-11T04:00:00Z')));
  });
  it('changes when a task is edited or a log is added', () => {
    const base = backupSignature(data());
    expect(backupSignature(data({ backlog: [task({ title: 'Other' })] }))).not.toBe(base);
    expect(backupSignature(data({ backlog: [task({ elapsedSeconds: 60 })] }))).not.toBe(base);
    expect(backupSignature(data({ logs: [] }))).not.toBe(base);
    expect(backupSignature(data({ tags: [] }))).not.toBe(base);
  });
  it('ignores device-only settings, including the Sheet copy status', () => {
    const d = data();
    const sig = backupSignature(d);
    expect(backupSignature({ ...d, settings: { ...d.settings, sheetBackupAt: 'x', sheetBackupError: 'y', phoneSyncAt: 'z', geminiApiKey: 'other' } })).toBe(sig);
    expect(backupSignature({ ...d, settings: { ...d.settings, workdayHours: 6 } })).not.toBe(sig);
  });
});

describe('buildSheetBackup', () => {
  it('is compact, has no screenshots and no secrets, and counts what it holds', () => {
    const d = data();
    const text = buildSheetBackup(d);
    expect(text).not.toContain('AAAA');
    expect(text).not.toContain('KEY');
    expect(text).not.toContain('TOKEN');
    expect(text).not.toContain('\n');
    expect(JSON.parse(text).logs[0].id).toBe('l1');
    expect(d.logs[0].imageBase64).toBeTruthy(); // the live data is untouched
    expect(backupCounts(d)).toEqual({ logs: 1, tasks: 1, projects: 1 });
  });
});

describe('shouldBackup', () => {
  const base = { signature: 'a', baseline: 'a', lastBackupAtMs: 1_000_000, lastFailureAtMs: null, nowMs: 1_000_000 + 1000, running: false };
  it('waits for a change (the hook adds the 30 s delay)', () => {
    expect(BACKUP_DEBOUNCE_MS).toBe(30_000);
    expect(shouldBackup(base)).toBe(false);
    expect(shouldBackup({ ...base, signature: 'b' })).toBe(true);
  });
  it('while a timer runs also every 10 minutes', () => {
    expect(shouldBackup({ ...base, running: true, nowMs: base.lastBackupAtMs + RUNNING_BACKUP_MS - 1 })).toBe(false);
    expect(shouldBackup({ ...base, running: true, nowMs: base.lastBackupAtMs + RUNNING_BACKUP_MS })).toBe(true);
    expect(shouldBackup({ ...base, running: false, nowMs: base.lastBackupAtMs + 5 * RUNNING_BACKUP_MS })).toBe(false);
  });
  it('at load only when the last copy is older than an hour or missing', () => {
    const load = { ...base, baseline: null };
    expect(shouldBackup({ ...load, signature: 'whatever' })).toBe(false);
    expect(shouldBackup({ ...load, nowMs: load.lastBackupAtMs + LOAD_BACKUP_AFTER_MS - 1 })).toBe(false);
    expect(shouldBackup({ ...load, nowMs: load.lastBackupAtMs + LOAD_BACKUP_AFTER_MS })).toBe(true);
    expect(shouldBackup({ ...load, lastBackupAtMs: null })).toBe(true);
  });
  it('waits a few minutes after a failure, then tries again', () => {
    const failed = { ...base, signature: 'b', lastFailureAtMs: 5_000_000, nowMs: 5_000_000 + 1000 };
    expect(shouldBackup(failed)).toBe(false);
    expect(shouldBackup({ ...failed, nowMs: 5_000_000 + RETRY_AFTER_FAILURE_MS })).toBe(true);
  });
});

describe('hasRealData', () => {
  it('is false for a profile that only has the demo data, true once anything real exists', () => {
    const demo = data({ logs: [{ id: 'log-1' } as any], backlog: [{ id: 'task-1' } as any], projects: [{ id: 'proj-1' } as any], workdays: {} });
    expect(hasRealData(demo)).toBe(false);
    expect(hasRealData({ ...demo, logs: [...demo.logs, { id: 'log-17000' } as any] })).toBe(true);
    expect(hasRealData({ ...demo, workdays: { '2026-11-11': { clockIn: '2026-11-11T03:00:00Z' } } })).toBe(true);
  });
});
