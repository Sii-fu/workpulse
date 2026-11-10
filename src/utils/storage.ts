import { WorkLog, BacklogTask, Project, AppSettings, BackupData, Workdays } from '../types';
import { localDateStr } from './dates';
import { isWorkdays, validWorkdayHours } from './workday';
import { ensureOpenSegment } from './segments';
import { normalizeTheme } from './theme';
import { getInitialSeedData, DEFAULT_SETTINGS } from '../data/seedData';

const KEYS = {
  LOGS: 'workpulse_logs',
  BACKLOG: 'workpulse_backlog',
  PROJECTS: 'workpulse_projects',
  TAGS: 'workpulse_tags',
  SETTINGS: 'workpulse_settings',
  WORKDAYS: 'workpulse_workdays',
  SCHEMA_VERSION: 'workpulse_schema_version',
};

export const CURRENT_SCHEMA_VERSION = 1;

export type SaveResult = { ok: true } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isObjectArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((i) => isObj(i) && typeof i.id === 'string');

export const isLogArray = (v: unknown): v is WorkLog[] => isObjectArray(v);
export const isBacklogArray = (v: unknown): v is BacklogTask[] => isObjectArray(v);
export const isProjectArray = (v: unknown): v is Project[] => isObjectArray(v);
export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((i) => typeof i === 'string');
export const isSettingsObject = (v: unknown): v is Partial<AppSettings> => isObj(v);

// Reads one key. Absent -> absentFallback (first run). Unreadable or wrong shape ->
// the raw value is copied to "<key>_corrupt_<timestamp>" so nothing is lost, a warning is
// recorded, and corruptFallback is returned (never demo data).
function readKey<T>(
  key: string,
  guard: (v: unknown) => v is T,
  absentFallback: T,
  corruptFallback: T,
  warnings: string[],
): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    warnings.push(`Could not read "${key}" from browser storage.`);
    return corruptFallback;
  }
  if (raw === null) return absentFallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (guard(parsed)) return parsed;
  } catch {
    // fall through to quarantine
  }
  const backupKey = `${key}_corrupt_${Date.now()}`;
  try {
    localStorage.setItem(backupKey, raw);
    warnings.push(`"${key}" was unreadable. A copy was kept as "${backupKey}"; the app started with an empty list.`);
  } catch {
    warnings.push(`"${key}" was unreadable and could not be backed up (storage full).`);
  }
  return corruptFallback;
}

// Hook for future schema changes (B1, B2, U2 ...). Runs once when the stored version is older.
function runMigrations(_storedVersion: number): void {
  // No migrations yet: version 1 is the current shape.
}

// Normalises tasks and moves unfinished past-due tasks to todayStr. Also runs while the app stays
// open across midnight (App.tsx), not only at load.
export function rollOverTasks(
  backlog: BacklogTask[],
  todayStr: string,
  nowIso: string = new Date().toISOString(),
): { tasks: BacklogTask[]; changed: boolean } {
  let changed = false;
  const tasks = backlog.map((task) => {
    // `stage` and `completed` can disagree in old, imported or hand-edited data. Either one saying
    // "done" wins, then `completed` is derived from the stage so they always agree afterwards (C3).
    const isDone = task.stage === 'done' || task.completed === true;
    const normalizedStage = isDone ? 'done' : task.stage || 'planned';

    let next: BacklogTask;
    if (!isDone && task.dueDate < todayStr) {
      changed = true;
      next = {
        ...task,
        stage: normalizedStage,
        completed: false,
        dueDate: todayStr,
        isRolledOver: true,
        elapsedSeconds: task.elapsedSeconds ?? 0,
        isRunning: normalizedStage === 'in_progress',
      };
    } else {
      next = {
        ...task,
        stage: normalizedStage,
        completed: isDone,
        elapsedSeconds: task.elapsedSeconds ?? 0,
        isRunning: normalizedStage === 'in_progress',
      };
    }
    // A clock that ran before segments existed gets an open one, so the overs strip can show it.
    if (next.isRunning) {
      const withSegment = ensureOpenSegment(next, nowIso);
      if (withSegment !== next) changed = true;
      next = withSegment;
    }
    return next;
  });
  return { tasks, changed };
}

export function loadStoredData() {
  const seed = getInitialSeedData();
  const warnings: string[] = [];

  const logs = readKey<WorkLog[]>(KEYS.LOGS, isLogArray, seed.logs, [], warnings);
  let backlog = readKey<BacklogTask[]>(KEYS.BACKLOG, isBacklogArray, seed.backlog, [], warnings);
  const projects = readKey<Project[]>(KEYS.PROJECTS, isProjectArray, seed.projects, [], warnings);
  const tags = readKey<string[]>(KEYS.TAGS, isStringArray, seed.tags, [], warnings);
  const storedSettings = readKey<Partial<AppSettings> | null>(
    KEYS.SETTINGS,
    (v): v is Partial<AppSettings> | null => isSettingsObject(v),
    null,
    null,
    warnings,
  );
  const merged: AppSettings = { ...DEFAULT_SETTINGS, ...(storedSettings || {}) };
  // Old theme ids (modern, compact, minimalist, matrix) load as their v2 theme.
  const settings: AppSettings = {
    ...merged,
    theme: normalizeTheme(merged.theme),
    workdayHours: validWorkdayHours(merged.workdayHours),
  };
  const workdays = readKey<Workdays>(KEYS.WORKDAYS, isWorkdays, {}, {}, warnings);

  // Auto-rollover: unfinished tasks whose due date has passed move to today (local date).
  const rolled = rollOverTasks(backlog, localDateStr());
  backlog = rolled.tasks;
  const updatedBacklog = rolled.changed;

  try {
    if (updatedBacklog) {
      localStorage.setItem(KEYS.BACKLOG, JSON.stringify(backlog));
    }
    const storedVersion = Number(localStorage.getItem(KEYS.SCHEMA_VERSION) || 0);
    if (storedVersion < CURRENT_SCHEMA_VERSION) {
      runMigrations(storedVersion);
      localStorage.setItem(KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
    }
  } catch (e) {
    console.error('Failed to write storage metadata:', e);
  }

  return { logs, backlog, projects, tags, settings, workdays, warnings };
}

function saveKey(key: string, value: unknown, what: string): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    console.error(`Error saving ${what}:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const saveLogs = (logs: WorkLog[]) => saveKey(KEYS.LOGS, logs, 'logs');
export const saveBacklog = (backlog: BacklogTask[]) => saveKey(KEYS.BACKLOG, backlog, 'backlog');
export const saveProjects = (projects: Project[]) => saveKey(KEYS.PROJECTS, projects, 'projects');
export const saveTags = (tags: string[]) => saveKey(KEYS.TAGS, tags, 'tags');
export const saveSettings = (settings: AppSettings) => saveKey(KEYS.SETTINGS, settings, 'settings');
export const saveWorkdays = (workdays: Workdays) => saveKey(KEYS.WORKDAYS, workdays, 'workdays');

// Replaces all data keys at once (backup import). Workdays are written only when the backup has
// them; an older backup leaves the stored workdays alone. If any write fails, every key is
// restored to its previous value so a failed import cannot leave a half-written state.
export function replaceAllData(d: BackupData): SaveResult {
  const entries: [string, unknown][] = [
    [KEYS.LOGS, d.logs],
    [KEYS.BACKLOG, d.backlog],
    [KEYS.PROJECTS, d.projects],
    [KEYS.TAGS, d.tags],
    [KEYS.SETTINGS, d.settings],
  ];
  if (d.workdays !== undefined) entries.push([KEYS.WORKDAYS, d.workdays]);
  const previous = entries.map(([k]) => [k, localStorage.getItem(k)] as const);
  try {
    for (const [k, v] of entries) localStorage.setItem(k, JSON.stringify(v));
    return { ok: true };
  } catch (e) {
    for (const [k, v] of previous) {
      try {
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch {
        // best effort
      }
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
