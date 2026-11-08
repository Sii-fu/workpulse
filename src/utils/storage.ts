import { WorkLog, BacklogTask, Project, AppSettings } from '../types';
import { getInitialSeedData, DEFAULT_SETTINGS } from '../data/seedData';

const KEYS = {
  LOGS: 'workpulse_logs',
  BACKLOG: 'workpulse_backlog',
  PROJECTS: 'workpulse_projects',
  TAGS: 'workpulse_tags',
  SETTINGS: 'workpulse_settings',
  ACTIVE_DRAFT: 'workpulse_active_draft',
  SCHEMA_VERSION: 'workpulse_schema_version',
};

export interface ActiveDraft {
  description: string;
  projectId: string;
  status: 'completed' | 'in_progress' | 'blocked';
  tags: string[];
  linkUrl: string;
  durationMinutes: number;
  energyRating: number;
  date: string;
}

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
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...(storedSettings || {}) };

  // Apply auto-rollover logic: if a task's dueDate is in the past and it is not completed, roll it over to today!
  const todayStr = new Date().toISOString().split('T')[0];
  let updatedBacklog = false;

  backlog = backlog.map((task) => {
    const normalizedStage = task.stage || (task.completed ? 'done' : 'planned');
    const isDone = normalizedStage === 'done' || task.completed;

    if (!isDone && task.dueDate < todayStr) {
      updatedBacklog = true;
      return {
        ...task,
        stage: normalizedStage,
        completed: false,
        dueDate: todayStr,
        isRolledOver: true,
        elapsedSeconds: task.elapsedSeconds ?? 0,
        isRunning: normalizedStage === 'in_progress',
      };
    }
    return {
      ...task,
      stage: normalizedStage,
      completed: isDone,
      elapsedSeconds: task.elapsedSeconds ?? 0,
      isRunning: normalizedStage === 'in_progress',
    };
  });

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

  return { logs, backlog, projects, tags, settings, warnings };
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

export function saveActiveDraft(draft: ActiveDraft) {
  try {
    localStorage.setItem(KEYS.ACTIVE_DRAFT, JSON.stringify(draft));
  } catch (e) {
    console.error('Error saving draft:', e);
  }
}

export function loadActiveDraft(): Partial<ActiveDraft> | null {
  try {
    const raw = localStorage.getItem(KEYS.ACTIVE_DRAFT);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearActiveDraft() {
  try {
    localStorage.removeItem(KEYS.ACTIVE_DRAFT);
  } catch (e) {
    console.error('Error clearing draft:', e);
  }
}
