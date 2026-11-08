import React, { useState } from 'react';
import { defaultProject, activeProjectsOf } from '../../utils/projects';
import { localDateStr, localTimeStr } from '../../utils/dates';
import { WorkLog, Project, TaskStatus, BacklogTask } from '../../types';
import {
  CornerDownLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Copy,
  Trash2,
  CopyCheck,
  ListTodo,
  Check,
  Zap,
} from 'lucide-react';

interface CompactConsoleLayoutProps {
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  availableTags: string[];
  onAddLog: (log: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onDeleteLog: (id: string) => void;
  onDuplicateLog: (log: WorkLog) => void;
  onOpenImage: (base64: string) => void;
  onCopyText: (text: string) => void;
  onToggleTask: (taskId: string) => void;
  onConvertTaskToLog?: (task: BacklogTask) => void;
}

export const CompactConsoleLayout: React.FC<CompactConsoleLayoutProps> = ({
  logs,
  backlog,
  projects,
  availableTags,
  onAddLog,
  onDeleteLog,
  onDuplicateLog,
  onOpenImage,
  onCopyText,
  onToggleTask,
  onConvertTaskToLog,
}) => {
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProject(projects)?.id || '');
  const [status, setStatus] = useState<TaskStatus>('completed');
  const [duration, setDuration] = useState('30');
  const [showBacklog, setShowBacklog] = useState(false);

  const activeProject = projects.find((p) => p.id === projectId) || defaultProject(projects);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onAddLog({
      date: localDateStr(),
      time: localTimeStr(),
      projectId: activeProject?.id || 'default',
      projectName: activeProject?.name || 'General',
      description: description.trim(),
      status,
      tags: [],
      durationMinutes: parseInt(duration) || undefined,
      energyRating: 4,
    });

    setDescription('');
  };

  const pendingTasks = backlog.filter((t) => !t.completed && t.stage !== 'done');

  return (
    <div className="space-y-3 font-mono text-xs">
      
      {/* 1. Horizontal Single-Line Command Bar (Zero Vertical Wastage) */}
      <form
        onSubmit={handleQuickSubmit}
        className="glass-panel p-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1.5 border border-[var(--border-app)] shadow-xs"
      >
        {/* Project selector */}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-8 px-2 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded text-xs font-semibold text-[var(--text-main)] cursor-pointer"
        >
          {activeProjectsOf(projects).map((p) => (
            <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
              {p.name}
            </option>
          ))}
        </select>

        {/* Inline input */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Quick log description"
          placeholder="Fast single-line log (e.g. Fixed caching race condition)..."
          className="flex-1 h-8 px-3 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:border-[var(--accent)] font-sans"
        />

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="h-8 px-2 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded text-xs text-[var(--text-main)] cursor-pointer"
        >
          <option value="completed" className="bg-[var(--bg-surface)]">DONE</option>
          <option value="in_progress" className="bg-[var(--bg-surface)]">IN_PROG</option>
          <option value="blocked" className="bg-[var(--bg-surface)]">BLOCKED</option>
        </select>

        {/* Duration */}
        <div className="flex items-center gap-1 h-8 px-2 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded">
          <input
            type="number"
            aria-label="Duration in minutes"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-8 text-center text-xs bg-transparent"
          />
          <span className="text-[10px] text-[var(--text-muted)]">m</span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="h-8 px-3 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
        >
          <span>LOG</span>
          <CornerDownLeft className="w-3 h-3 opacity-70" />
        </button>

        {/* Toggle Backlog Drawer */}
        <button
          type="button"
          onClick={() => setShowBacklog(!showBacklog)}
          className={`h-8 px-2.5 rounded border border-[var(--border-control)] text-xs flex items-center gap-1 cursor-pointer transition-colors ${
            showBacklog
              ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
          title="Toggle Tasks Drawer"
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>{pendingTasks.length}</span>
        </button>
      </form>

      {/* Optional Top Tasks Drawer if toggled */}
      {showBacklog && (
        <div className="glass-panel p-3 border border-[var(--border-app)] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
            <span>Pending Fast Backlog ({pendingTasks.length})</span>
            <button
              onClick={() => setShowBacklog(false)}
              className="hover:text-[var(--text-main)] text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                className="p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-app)] hover:border-[var(--accent)] flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleTask(t.id)}
                    className="hover:text-success text-[10px] text-[var(--text-muted)] cursor-pointer p-0.5 rounded"
                    title="Toggle completed"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <span className="truncate">{t.title}</span>
                </div>
                {onConvertTaskToLog && (
                  <button
                    type="button"
                    onClick={() => onConvertTaskToLog(t)}
                    className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-[10px] font-bold cursor-pointer shrink-0 flex items-center gap-1"
                    title="Log to Work Log and Sheet"
                  >
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>LOG</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Full-Width Dense Spreadsheet Feed (Locked to h-9/h-10) */}
      <div className="glass-panel overflow-x-auto border border-[var(--border-app)] shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] h-9">
              <th className="px-2.5 w-24">Date</th>
              <th className="px-2.5 w-32">Project</th>
              <th className="px-2.5">Work Description</th>
              <th className="px-2.5 w-24">Status</th>
              <th className="px-2.5 w-16 text-right">Mins</th>
              <th className="px-2.5 w-24 text-right">Hotkeys</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-app)]">
            {logs.map((log) => {
              const project = projects.find((p) => p.id === log.projectId);

              return (
                <tr
                  key={log.id}
                  className="h-9 hover:bg-[var(--bg-subtle-hover)] transition-colors group"
                >
                  <td className="px-2.5 text-[var(--text-muted)] whitespace-nowrap">
                    {log.date}
                  </td>
                  <td className="px-2.5 font-semibold text-[var(--text-main)] whitespace-nowrap truncate max-w-[130px]">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: project?.color || '#6366f1' }}
                      />
                      <span className="truncate" title={log.projectName}>
                        {log.projectName}
                      </span>
                    </span>
                  </td>
                  <td className="px-2.5 text-[var(--text-main)] font-sans truncate max-w-[420px]">
                    <span className="truncate">{log.description}</span>
                    {log.imageBase64 && (
                      <button
                        type="button"
                        onClick={() => onOpenImage(log.imageBase64 as string)}
                        className="ml-2 text-[10px] text-[var(--accent-text)] hover:underline cursor-pointer"
                        title="View screenshot"
                      >
                        [IMG]
                      </button>
                    )}
                    {log.linkUrl && (
                      <a
                        href={log.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-[10px] text-[var(--accent-text)] hover:underline"
                        title={log.linkUrl}
                      >
                        [LINK]
                      </a>
                    )}
                  </td>
                  <td className="px-2.5 whitespace-nowrap">
                    {log.status === 'completed' ? (
                      <span className="text-success font-bold text-[10px]">[DONE]</span>
                    ) : log.status === 'in_progress' ? (
                      <span className="text-info font-bold text-[10px]">[IN_PROG]</span>
                    ) : (
                      <span className="text-danger font-bold text-[10px]">[BLOCK]</span>
                    )}
                  </td>
                  <td className="px-2.5 text-right tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                    {log.durationMinutes ? `${log.durationMinutes}m` : '-'}
                  </td>
                  <td className="px-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onDuplicateLog(log)}
                        className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:text-[var(--accent-text)] text-[10px] cursor-pointer"
                        title="Duplicate"
                      >
                        DUP
                      </button>
                      <button
                        onClick={() => onDeleteLog(log.id)}
                        className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:text-danger text-[10px] cursor-pointer"
                        title="Delete"
                      >
                        DEL
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
