import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { addActivityFolder } from '../../utils/activity/settings';
import type { Project } from '../../types';
import type { ActivityFolder, ActivitySources } from '../../utils/activity/types';

interface ActivityFoldersSettingsProps {
  folders: ActivityFolder[];
  sources: ActivitySources;
  projects: Project[];
  onChange: (folders: ActivityFolder[], sources: ActivitySources) => void;
}

const FIELD =
  'bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--border-focus)]';

export const ActivityFoldersSettings: React.FC<ActivityFoldersSettingsProps> = ({ folders, sources, projects, onChange }) => {
  const activeProjects = projects.filter((p) => !p.isArchived);
  const [newPath, setNewPath] = useState('');
  const [newProjectId, setNewProjectId] = useState(activeProjects[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Project removed';

  const handleAdd = () => {
    const result = addActivityFolder(folders, newPath, newProjectId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNewPath('');
    onChange(result.folders, sources);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[var(--text-main)]">Activity suggestions</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          At the end of the day WorkPulse can suggest logs from your work. Only the folders listed here are read.
          Press Save All Settings to keep your changes.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-[var(--text-main)]">What to read</legend>
        <label className="flex items-start gap-2.5 text-xs text-[var(--text-main)] cursor-pointer">
          <input
            type="checkbox"
            checked={sources.git}
            onChange={(e) => onChange(folders, { ...sources, git: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">Include git commits</span>
            <span className="block text-[var(--text-muted)]">
              Commits you made today in these folders. Their subjects are sent to Gemini to write the log text.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-xs text-[var(--text-main)] cursor-pointer">
          <input
            type="checkbox"
            checked={sources.claude}
            onChange={(e) => onChange(folders, { ...sources, claude: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">Include Claude Code prompts</span>
            <span className="block text-[var(--text-muted)]">
              Reads your Claude Code session history for these folders. The first line of your prompts, session titles
              and edited file names are sent to Gemini; file contents never are. Off until you turn it on.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-[var(--text-main)]">Folders</h4>
        {folders.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No folders yet. Add the folders you work in, below.</p>
        ) : (
          <ul className="space-y-2">
            {folders.map((f) => (
              <li
                key={f.path}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-[var(--radius-btn)] border border-[var(--border-control)] bg-[var(--bg-subtle)]"
              >
                <span className="flex-1 min-w-0 truncate text-xs font-mono text-[var(--text-main)]" title={f.path}>
                  {f.path}
                </span>
                <select
                  value={f.projectId}
                  aria-label={`Project for ${f.path}`}
                  onChange={(e) =>
                    onChange(folders.map((x) => (x.path === f.path ? { ...x, projectId: e.target.value } : x)), sources)
                  }
                  className={FIELD}
                >
                  {!activeProjects.some((p) => p.id === f.projectId) && (
                    <option value={f.projectId}>{projectName(f.projectId)}</option>
                  )}
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <IconButton
                  label={`Remove folder ${f.path}`}
                  onClick={() => onChange(folders.filter((x) => x.path !== f.path), sources)}
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <div className="flex-1 min-w-[12rem]">
            <input
              type="text"
              value={newPath}
              onChange={(e) => {
                setNewPath(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              aria-label="Folder path"
              placeholder="E:\projects\app"
              className={`w-full font-mono ${FIELD}`}
            />
          </div>
          <select
            value={newProjectId}
            onChange={(e) => setNewProjectId(e.target.value)}
            aria-label="Project for the new folder"
            className={FIELD}
          >
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-2 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-control)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add folder</span>
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          A folder covers itself, any git project one level below it, and Claude Code sessions started inside it.
        </p>
      </div>
    </div>
  );
};
