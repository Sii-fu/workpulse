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
  isSynthesized?: boolean;
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
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface BackupData {
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  tags: string[];
  settings: AppSettings;
}
