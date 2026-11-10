import { BackupData, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/seedData';
import { CURRENT_SCHEMA_VERSION, isLogArray, isBacklogArray, isProjectArray, isStringArray, isSettingsObject } from './storage';
import { isWorkdays, validWorkdayHours } from './workday';

// JSON backup text. The Gemini API key is never written to a backup file (S4), and neither is
// lastBackupAt: that date belongs to this device, not to the data.
export function buildBackup(d: BackupData): string {
  const { geminiApiKey: _omit, lastBackupAt: _omitBackup, activityFolders: _omitFolders, ...settings } = d.settings;
  return JSON.stringify(
    {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      logs: d.logs,
      backlog: d.backlog,
      projects: d.projects,
      tags: d.tags,
      settings,
      workdays: d.workdays ?? {},
    },
    null,
    2,
  );
}

export type ParseBackupResult = { ok: true; data: BackupData } | { ok: false; error: string };

// Validates a backup file. Imported settings never carry an API key (the caller keeps the current one).
export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'This file is not a WorkPulse backup.' };
  }
  const o = parsed as Record<string, unknown>;
  if (!isLogArray(o.logs)) return { ok: false, error: 'Backup is missing a valid "logs" list.' };
  if (!isBacklogArray(o.backlog)) return { ok: false, error: 'Backup is missing a valid "backlog" list.' };
  if (!isProjectArray(o.projects)) return { ok: false, error: 'Backup is missing a valid "projects" list.' };
  if (!isStringArray(o.tags)) return { ok: false, error: 'Backup is missing a valid "tags" list.' };
  if (o.settings !== undefined && !isSettingsObject(o.settings)) {
    return { ok: false, error: 'Backup has invalid "settings".' };
  }
  if (o.workdays !== undefined && !isWorkdays(o.workdays)) {
    return { ok: false, error: 'Backup has invalid "workdays".' };
  }
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...((o.settings as object) || {}),
    geminiApiKey: '',
    lastBackupAt: undefined,
    activityFolders: undefined,
  };
  settings.workdayHours = validWorkdayHours(settings.workdayHours);
  return {
    ok: true,
    data: { logs: o.logs, backlog: o.backlog, projects: o.projects, tags: o.tags, settings, workdays: o.workdays },
  };
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
