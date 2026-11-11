import React, { useEffect, useId, useRef, useState } from 'react';
import { FolderOpen, Loader2, Plus, X } from 'lucide-react';
import type { Project } from '../../../types';
import { isFullFolderPath } from '../../../utils/activity/settings';
import { pickFolder } from '../../../utils/pickFolderClient';
import { IconButton } from '../../ui/IconButton';
import { SWATCHES, Swatches } from '../ProjectSwatches';

interface ProjectsSectionProps {
  projects: Project[];
  tags: string[];
  onUpdateProjects(p: Project[]): void;
  onUpdateTags(t: string[]): void;
  onAddProjectFromFolder(path: string): { ok: boolean; message: string };
}

const LABEL = 'block mb-1 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)]';
const FIELD = 'v2-input w-full h-11 px-3 text-[length:var(--fs-body)]';
const BTN = 'v2-btn inline-flex items-center justify-center gap-1.5 min-h-11 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const TEXT_BTN =
  'min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed';

interface ProjectRowProps {
  project: Project;
  canArchive: boolean;
  onRename(name: string): void;
  onColor(hex: string): void;
  onToggleArchive(): void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({ project, canArchive, onRename, onColor, onToggleArchive }) => {
  const [draft, setDraft] = useState(project.name);
  const [picking, setPicking] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => setDraft(project.name), [project.name]);

  const commit = () => {
    const name = draft.trim();
    if (cancelled.current || !name) setDraft(project.name);
    else if (name !== project.name) onRename(name);
    else setDraft(project.name);
    cancelled.current = false;
  };

  return (
    <li className="v2-row">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <IconButton
          label={`Change colour of ${project.name}`}
          aria-expanded={picking}
          onClick={() => setPicking((p) => !p)}
        >
          <span
            className="block h-5 w-5 rounded-[var(--radius-btn)] border border-[var(--border-control)]"
            style={{ backgroundColor: project.color }}
          />
        </IconButton>
        <input
          type="text"
          value={draft}
          aria-label={`Name of ${project.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') {
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
          className={`min-h-11 min-w-0 flex-1 basis-40 rounded-[var(--radius-btn)] border border-transparent bg-transparent px-2 text-[length:var(--fs-body)] font-semibold hover:border-[var(--border-app)] focus:border-[var(--border-focus)] ${
            project.isArchived ? 'text-[var(--text-muted)]' : 'text-[var(--text-main)]'
          }`}
        />
        {project.isArchived && <span className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Archived</span>}
        <button type="button" onClick={onToggleArchive} disabled={!project.isArchived && !canArchive} className={TEXT_BTN}>
          {project.isArchived ? 'Unarchive' : 'Archive'}
        </button>
      </div>
      {picking && (
        <div className="pt-2 pl-1">
          <Swatches value={project.color} label={`Colour of ${project.name}`} onPick={onColor} />
        </div>
      )}
    </li>
  );
};

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({
  projects,
  tags,
  onUpdateProjects,
  onUpdateTags,
  onAddProjectFromFolder,
}) => {
  const id = useId();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SWATCHES[0].hex);
  const [newTag, setNewTag] = useState('');

  const [picking, setPicking] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [folderNote, setFolderNote] = useState<{ ok: boolean; message: string } | null>(null);

  const activeCount = projects.filter((p) => !p.isArchived).length;

  const addFromDialog = async () => {
    setPicking(true);
    setFolderNote(null);
    const picked = await pickFolder();
    setPicking(false);
    if (picked.kind === 'cancelled') return;
    if (picked.kind === 'error') return setFolderNote({ ok: false, message: picked.message });
    setFolderNote(onAddProjectFromFolder(picked.path));
  };

  const addFromTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const path = folderPath.trim();
    if (!path) return;
    if (!isFullFolderPath(path)) {
      setFolderNote({ ok: false, message: 'Enter the full folder path, like E:\\projects\\app.' });
      return;
    }
    const result = onAddProjectFromFolder(path);
    setFolderNote(result);
    if (result.ok) setFolderPath('');
  };

  const patch = (pid: string, change: Partial<Project>) =>
    onUpdateProjects(projects.map((p) => (p.id === pid ? { ...p, ...change } : p)));

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onUpdateProjects([...projects, { id: `proj-${Date.now()}`, name, color: newColor, isArchived: false }]);
    setNewName('');
    // Move on to the next colour so two new projects do not start out alike.
    const i = SWATCHES.findIndex((s) => s.hex === newColor);
    setNewColor(SWATCHES[(i + 1) % SWATCHES.length].hex);
  };

  const addTag = (e: React.FormEvent) => {
    e.preventDefault();
    let tag = newTag.trim();
    if (!tag) return;
    if (!tag.startsWith('#')) tag = '#' + tag;
    if (!tags.includes(tag)) onUpdateTags([...tags, tag]);
    setNewTag('');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-[length:var(--fs-body)] font-bold text-[var(--text-main)]">Projects</h3>
        <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">
          Click a name to rename it, or the colour to change it. An archived project leaves the pickers but keeps its logs.
        </p>
        {projects.length > 0 && (
          <ul className="v2-panel">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                canArchive={activeCount > 1}
                onRename={(name) => patch(p.id, { name })}
                onColor={(color) => patch(p.id, { color })}
                onToggleArchive={() => patch(p.id, { isArchived: !p.isArchived })}
              />
            ))}
          </ul>
        )}
        {activeCount <= 1 && (
          <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Keep at least one active project.</p>
        )}

        <form onSubmit={addProject} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor={`${id}-name`} className={LABEL}>
                New project
              </label>
              <input
                id={`${id}-name`}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                autoComplete="off"
                className={FIELD}
              />
            </div>
            <button type="submit" disabled={!newName.trim()} className={`${BTN} v2-btn-strong`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add project
            </button>
          </div>
          <Swatches value={newColor} label="Colour of the new project" onPick={setNewColor} />
        </form>

        <div className="flex flex-col gap-3 border-t border-[var(--border-app)] pt-4">
          <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">
            Pick a folder to add a project named after it. The folder is also linked to that project for activity suggestions.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={addFromDialog} disabled={picking} className={BTN}>
              {picking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
              )}
              Add project from folder
            </button>
            {picking && (
              <span className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Choose the folder in the window that opened.</span>
            )}
          </div>
          <form onSubmit={addFromTyped} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor={`${id}-folder`} className={LABEL}>
                Or type the folder path
              </label>
              <input
                id={`${id}-folder`}
                type="text"
                value={folderPath}
                onChange={(e) => {
                  setFolderPath(e.target.value);
                  setFolderNote(null);
                }}
                placeholder="E:\projects\app"
                autoComplete="off"
                spellCheck={false}
                className={FIELD}
              />
            </div>
            <button type="submit" disabled={!folderPath.trim() || picking} className={BTN}>
              Add
            </button>
          </form>
          {folderNote && (
            <p role="status" className={`text-[length:var(--fs-small)] ${folderNote.ok ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
              {folderNote.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[length:var(--fs-body)] font-bold text-[var(--text-main)]">Tags</h3>
        <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Tags you can attach to a log. Removing one does not change logs that already have it.</p>
        {tags.length === 0 ? (
          <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">No tags yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-1 rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-subtle)] pl-3 text-[length:var(--fs-small)] text-[var(--text-main)]"
              >
                {t}
                <IconButton label={`Remove tag ${t}`} onClick={() => onUpdateTags(tags.filter((x) => x !== t))}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addTag} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor={`${id}-tag`} className={LABEL}>
              New tag
            </label>
            <input
              id={`${id}-tag`}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="#deep-work"
              autoComplete="off"
              className={FIELD}
            />
          </div>
          <button type="submit" disabled={!newTag.trim()} className={BTN}>
            Add tag
          </button>
        </form>
      </div>
    </div>
  );
};
