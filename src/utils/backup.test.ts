import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import { replaceAllData } from './storage';
import { DEFAULT_SETTINGS } from '../data/seedData';
import type { BackupData } from '../types';

const data = (): BackupData => ({
  logs: [{ id: 'l1', date: '2026-01-01', time: '10:00', projectId: 'p', projectName: 'P', description: 'x', status: 'completed', tags: [], createdAt: 'c' }],
  backlog: [],
  projects: [{ id: 'p', name: 'P', color: '#fff', isArchived: false }],
  tags: ['a'],
  settings: { ...DEFAULT_SETTINGS, geminiApiKey: 'SECRET-KEY-123', googleScriptUrl: 'https://script.google.com/macros/s/x/exec' },
});

describe('backup', () => {
  it('buildBackup never contains the API key', () => {
    expect(buildBackup(data())).not.toContain('SECRET-KEY-123');
  });
  it('round trip keeps everything except the key', () => {
    const r = parseBackup(buildBackup(data()));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.logs).toEqual(data().logs);
      expect(r.data.projects).toEqual(data().projects);
      expect(r.data.settings.googleScriptUrl).toBe('https://script.google.com/macros/s/x/exec');
      expect(r.data.settings.geminiApiKey).toBe('');
    }
  });
  it('rejects malformed input with an error message', () => {
    for (const bad of ['{bad', '[]', '"x"', '{"logs":null}', JSON.stringify({ logs: [], backlog: [], tags: [] })]) {
      const r = parseBackup(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });
  it('the last-backup date stays on the device: never written, never imported', () => {
    const withDate = { ...data(), settings: { ...data().settings, lastBackupAt: '2026-11-01T00:00:00.000Z' } };
    expect(buildBackup(withDate)).not.toContain('lastBackupAt');
    const forged = parseBackup(JSON.stringify({ ...JSON.parse(buildBackup(data())), settings: { lastBackupAt: '2030-01-01T00:00:00.000Z' } }));
    expect(forged.ok && forged.data.settings.lastBackupAt).toBeUndefined();
  });
  it('an imported API key in the file is ignored', () => {
    const r = parseBackup(JSON.stringify({ ...JSON.parse(buildBackup(data())), settings: { geminiApiKey: 'EVIL' } }));
    expect(r.ok && r.data.settings.geminiApiKey).toBe('');
  });
});

describe('workdays in backups', () => {
  const workdays = { '2026-11-10': { clockIn: '2026-11-10T03:48:00.000Z' } };
  it('buildBackup includes workdays and a round trip keeps them', () => {
    const text = buildBackup({ ...data(), workdays });
    expect(JSON.parse(text).workdays).toEqual(workdays);
    const r = parseBackup(text);
    expect(r.ok && r.data.workdays).toEqual(workdays);
  });
  it('a backup file without workdays still imports, with workdays undefined', () => {
    const { workdays: _omit, ...old } = JSON.parse(buildBackup(data()));
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.workdays).toBeUndefined();
  });
  it('rejects invalid workdays', () => {
    const r = parseBackup(JSON.stringify({ ...JSON.parse(buildBackup(data())), workdays: [1] }));
    expect(r.ok).toBe(false);
  });
  it('replaceAllData writes workdays when present and leaves them alone when undefined', () => {
    expect(replaceAllData({ ...data(), workdays }).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('workpulse_workdays')!)).toEqual(workdays);
    expect(replaceAllData(data()).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('workpulse_workdays')!)).toEqual(workdays);
  });
});

describe('replaceAllData', () => {
  it('writes all keys', () => {
    expect(replaceAllData(data()).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('workpulse_tags')!)).toEqual(['a']);
  });
  it('rolls back every key when one write fails', () => {
    localStorage.setItem('workpulse_logs', '["old-logs"]');
    localStorage.setItem('workpulse_tags', '["old-tags"]');
    const real = localStorage.setItem.bind(localStorage);
    (localStorage as any).setItem = (k: string, v: string) => {
      if (k === 'workpulse_tags' && v !== '["old-tags"]') throw new Error('quota');
      real(k, v);
    };
    expect(replaceAllData(data()).ok).toBe(false);
    expect(localStorage.getItem('workpulse_logs')).toBe('["old-logs"]');
    expect(localStorage.getItem('workpulse_tags')).toBe('["old-tags"]');
  });
});

describe('activity folders stay on the device', () => {
  it('buildBackup never writes activityFolders and parseBackup never imports them', () => {
    const withFolders = { ...data(), settings: { ...data().settings, activityFolders: [{ path: 'E:/secret/proj', projectId: 'p' }] } };
    expect(buildBackup(withFolders)).not.toContain('activityFolders');
    expect(buildBackup(withFolders)).not.toContain('secret');
    const forged = parseBackup(JSON.stringify({ ...JSON.parse(buildBackup(data())), settings: { activityFolders: [{ path: 'E:/x', projectId: 'p' }] } }));
    expect(forged.ok && forged.data.settings.activityFolders).toBeUndefined();
  });
});
