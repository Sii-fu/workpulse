import React from 'react';
import { Project, WorkLog, ThemeId, TaskStatus } from '../../types';
import { DailyLogger } from '../DailyLogger';
import { X } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { IconButton } from '../ui/IconButton';

interface LogEditorDialogProps {
  projects: Project[];
  availableTags: string[];
  activeTheme: ThemeId;
  editingLog: WorkLog | null;
  prefill: { description: string; projectId: string; status?: TaskStatus } | null;
  onAddLog: (log: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onUpdateLog: (id: string, data: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onAddProject: (name: string, color: string) => void;
  onAddTag: (tag: string) => void;
  onClose: () => void;
}

// The full log form (tags, link, screenshot, duration, focus, date) in a dialog, for the themes
// whose timeline has only a one-line input. Used to edit a log and to "log with details".
export const LogEditorDialog: React.FC<LogEditorDialogProps> = ({
  projects,
  availableTags,
  activeTheme,
  editingLog,
  prefill,
  onAddLog,
  onUpdateLog,
  onAddProject,
  onAddTag,
  onClose,
}) => (
  <ModalShell
    onClose={onClose}
    labelledBy="log-editor-title"
    backdropClassName="p-3 sm:p-6 overflow-y-auto"
    className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] shadow-2xl"
  >
    <div className="flex items-center justify-between px-4 pt-3">
      <h2 id="log-editor-title" className="text-sm font-bold text-[var(--text-main)]">
        {editingLog ? 'Edit work log' : 'Log with details'}
      </h2>
      <IconButton label="Close" onClick={onClose}>
        <X className="w-4 h-4" />
      </IconButton>
    </div>
    <DailyLogger
      hidePrefillBanner
      projects={projects}
      availableTags={availableTags}
      activeTheme={activeTheme}
      prefillData={prefill}
      editingLog={editingLog}
      onUpdateLog={(id, data) => {
        onUpdateLog(id, data);
        onClose();
      }}
      onCancelEdit={onClose}
      onAddLog={(data) => {
        onAddLog(data);
        onClose();
      }}
      onAddProject={onAddProject}
      onAddTag={onAddTag}
    />
  </ModalShell>
);
