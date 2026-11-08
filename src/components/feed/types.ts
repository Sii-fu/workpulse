import { WorkLog, Project, BacklogTask } from '../../types';

// What every theme's timeline needs to list logs. A theme that cannot offer something has to
// leave it out of its own props on purpose, not by forgetting to pass it.
export interface LogListProps {
  logs: WorkLog[];
  projects: Project[];
  onEditLog: (log: WorkLog) => void;
  onDeleteLog: (id: string) => void;
  onDuplicateLog: (log: WorkLog) => void;
  onOpenImage: (base64: string) => void;
  onCopyText: (text: string) => void;
  selectedLogIds: string[];
  onToggleSelectLog: (id: string) => void;
  onSelectAllVisible: (ids: string[]) => void;
  onClearSelection: () => void;
  onOpenAiStandupWithSelected: () => void;
  onOpenEodSynthesizer?: () => void;
  /** Log picked in the search palette: scroll to it and flash it. */
  focusLogId?: string | null;
  onFocusLogHandled?: () => void;
  /** The log written a moment ago: its row animates in once. */
  justAddedLogId?: string | null;
}

/** The one-line quick-log input of the Minimalist, Compact and Matrix timelines. */
export interface QuickLogProps {
  availableTags: string[];
  onAddLog: (log: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  /** Open the full editor, pre-filled with what is typed so far. */
  onOpenDetails: (draft: { description: string; projectId: string; status: WorkLog['status'] }) => void;
}

/** Themes that also show the task queue next to the logs. */
export interface TaskQueueProps {
  backlog: BacklogTask[];
  onToggleTask: (taskId: string) => void;
  onConvertTaskToLog?: (task: BacklogTask) => void;
}
