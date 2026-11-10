import type { ActivityAi, ActivityFolder } from './utils/activity/types';

export type TaskStatus = 'completed' | 'in_progress' | 'blocked';

export interface WorkLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24-hour)
  projectId: string;
  projectName: string;
  description: string;
  status: TaskStatus;
  tags: string[];
  linkUrl?: string;
  imageBase64?: string;
  durationMinutes?: number;
  energyRating?: number; // 1 to 5
  createdAt: string;
  // When this log was confirmed written to the Google Sheet (undefined = not synced yet).
  syncedAt?: string;
  // When the user last edited this log; a log edited after its last sync needs sending again.
  editedAt?: string;
  isSynthesized?: boolean;
  // Activity item ids this log was suggested from; they are not suggested again. Never sent to the Sheet.
  sourceIds?: string[];
  underlyingTasks?: {
    id: string;
    title: string;
    stage: TaskStage;
    elapsedSeconds: number;
  }[];
}

export type TaskStage = 'planned' | 'in_progress' | 'paused' | 'blocked' | 'done';

export interface BacklogTask {
  id: string;
  title: string;
  projectId: string;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  stage?: TaskStage;
  originalDate: string; // Date when first created
  isRolledOver: boolean;
  startedAt?: string;
  completedAt?: string;
  blockReason?: string;
  elapsedSeconds?: number;
  isRunning?: boolean;
  isSynthesized?: boolean;
  synthesizedAt?: string;
  // Seconds of this task's tracked time already written into a log (undefined = nothing yet).
  loggedSeconds?: number;
  // Each stretch the timer ran (ISO UTC). The last one is open (no `end`) while the task runs.
  segments?: { start: string; end?: string }[];
}

export interface Project {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
}

export type ThemeId = 'minimalist' | 'modern' | 'compact' | 'matrix';

export type ReportFormat = 'whatsapp' | 'slack' | 'executive';

export type ReportTone = 'casual' | 'corporate' | 'bullet' | 'client';

export type ColorMode = 'light' | 'dark';

export type AppNavTab = 'feed' | 'backlog' | 'analytics' | 'settings';

export interface AppSettings {
  theme: ThemeId;
  colorMode: ColorMode;
  googleScriptUrl: string;
  geminiApiKey: string;
  defaultTone: ReportTone;
  defaultRecipientName?: string;
  lastDismissedReminderDate?: string;
  // Logs created before this moment are assumed to be handled already and are never auto-sent.
  syncTrackingSince?: string;
  // Matrix theme only: draw the CRT scanline overlay. Absent means off.
  crtEffect?: boolean;
  // When a backup file was last downloaded from Settings or the reminder (ISO). Absent means never.
  // Device-specific: not written into backup files and not replaced by an import.
  lastBackupAt?: string;
  // Folders scanned for activity suggestions, each linked to a project. Device-specific: not in backups.
  activityFolders?: ActivityFolder[];
  // Activity sources. Claude Code prompts are opt-in (absent = off); git commits are on unless set to false.
  activityUseClaude?: boolean;
  activityUseGit?: boolean;
  // Which AI groups the activity into suggestions. Absent = Claude Code.
  activityAi?: ActivityAi;
  // Length of the workday in hours, for the office clock. Absent = 8.
  workdayHours?: number;
}

// One day at the office. ISO timestamps (UTC).
export interface WorkdayRecord {
  clockIn: string;
  clockOut?: string;
}

// Keyed by the local YYYY-MM-DD of clockIn.
export type Workdays = Record<string, WorkdayRecord>;

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
  /** How long it stays before going away on its own. Hovering or focusing it pauses the clock. */
  durationMs?: number;
}

export interface BackupData {
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  tags: string[];
  settings: AppSettings;
  // Absent in backups made before the office clock existed.
  workdays?: Workdays;
}
