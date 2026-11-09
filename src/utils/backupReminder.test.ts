import { describe, it, expect } from 'vitest';
import { backupStatus, describeBackupAge, BACKUP_REMIND_AFTER_DAYS } from './backupReminder';
import { getInitialSeedData } from '../data/seedData';
import type { WorkLog } from '../types';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const seed = getInitialSeedData();
// Ids with a timestamp are real work (sample ids are fixed: log-1 ... log-6).
const realLog = { ...seed.logs[0], id: 'log-1735689600000-ab12' } as WorkLog;

describe('backupStatus', () => {
  it('is quiet right after a backup', () => {
    const s = backupStatus(daysAgo(0), [realLog], [], NOW);
    expect(s).toEqual({ days: 0, due: false });
  });

  it('is quiet below the limit and due from the limit on', () => {
    expect(backupStatus(daysAgo(BACKUP_REMIND_AFTER_DAYS - 1), [realLog], [], NOW).due).toBe(false);
    expect(backupStatus(daysAgo(BACKUP_REMIND_AFTER_DAYS), [realLog], [], NOW).due).toBe(true);
  });

  it('is due when real work exists and there has never been a backup', () => {
    expect(backupStatus(undefined, [realLog], [], NOW)).toEqual({ days: null, due: true });
  });

  it('does not nag about demo data only', () => {
    expect(backupStatus(undefined, seed.logs, seed.backlog, NOW).due).toBe(false);
  });

  it('treats an unreadable date as never backed up', () => {
    expect(backupStatus('not a date', [realLog], [], NOW)).toEqual({ days: null, due: true });
  });

  it('never reports negative days when the clock is behind', () => {
    expect(backupStatus(daysAgo(-3), [realLog], [], NOW).days).toBe(0);
  });
});

describe('describeBackupAge', () => {
  it('uses plain words', () => {
    expect(describeBackupAge(null)).toBe('No backup yet');
    expect(describeBackupAge(0)).toBe('Last backup today');
    expect(describeBackupAge(1)).toBe('Last backup yesterday');
    expect(describeBackupAge(9)).toBe('Last backup 9 days ago');
  });
});
