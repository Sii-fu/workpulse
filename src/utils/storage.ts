import { WorkLog, BacklogTask, Project, AppSettings } from '../types';
import { getInitialSeedData, DEFAULT_SETTINGS } from '../data/seedData';

const KEYS = {
  LOGS: 'workpulse_logs',
  BACKLOG: 'workpulse_backlog',
  PROJECTS: 'workpulse_projects',
  TAGS: 'workpulse_tags',
  SETTINGS: 'workpulse_settings',
  ACTIVE_DRAFT: 'workpulse_active_draft',
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

export function loadStoredData() {
  const seed = getInitialSeedData();

  try {
    const rawLogs = localStorage.getItem(KEYS.LOGS);
    const logs: WorkLog[] = rawLogs ? JSON.parse(rawLogs) : seed.logs;

    const rawBacklog = localStorage.getItem(KEYS.BACKLOG);
    let backlog: BacklogTask[] = rawBacklog ? JSON.parse(rawBacklog) : seed.backlog;

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

    if (updatedBacklog) {
      localStorage.setItem(KEYS.BACKLOG, JSON.stringify(backlog));
    }

    const rawProjects = localStorage.getItem(KEYS.PROJECTS);
    const projects: Project[] = rawProjects ? JSON.parse(rawProjects) : seed.projects;

    const rawTags = localStorage.getItem(KEYS.TAGS);
    const tags: string[] = rawTags ? JSON.parse(rawTags) : seed.tags;

    const rawSettings = localStorage.getItem(KEYS.SETTINGS);
    const settings: AppSettings = rawSettings
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) }
      : DEFAULT_SETTINGS;

    return { logs, backlog, projects, tags, settings };
  } catch (e) {
    console.error('Failed to load from localStorage, using seeds:', e);
    return seed && { ...seed, settings: DEFAULT_SETTINGS };
  }
}

export function saveLogs(logs: WorkLog[]) {
  try {
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving logs:', e);
  }
}

export function saveBacklog(backlog: BacklogTask[]) {
  try {
    localStorage.setItem(KEYS.BACKLOG, JSON.stringify(backlog));
  } catch (e) {
    console.error('Error saving backlog:', e);
  }
}

export function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error('Error saving projects:', e);
  }
}

export function saveTags(tags: string[]) {
  try {
    localStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
  } catch (e) {
    console.error('Error saving tags:', e);
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

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
