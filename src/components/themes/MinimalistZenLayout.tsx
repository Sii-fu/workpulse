import React, { useState } from 'react';
import { defaultProject, activeProjectsOf } from '../../utils/projects';
import { localDateStr, localTimeStr } from '../../utils/dates';
import { WorkLog, Project, TaskStatus } from '../../types';
import {
  Check,
  Clock,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Image as ImageIcon,
} from 'lucide-react';

interface MinimalistZenLayoutProps {
  logs: WorkLog[];
  projects: Project[];
  availableTags: string[];
  onAddLog: (log: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onDeleteLog: (id: string) => void;
  onDuplicateLog: (log: WorkLog) => void;
  onOpenImage: (base64: string) => void;
  onCopyText: (text: string) => void;
}

export const MinimalistZenLayout: React.FC<MinimalistZenLayoutProps> = ({
  logs,
  projects,
  availableTags,
  onAddLog,
  onDeleteLog,
  onDuplicateLog,
  onOpenImage,
  onCopyText,
}) => {
  const todayStr = localDateStr();
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProject(projects)?.id || '');
  const [status, setStatus] = useState<TaskStatus>('completed');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  const activeProject = projects.find((p) => p.id === projectId) || defaultProject(projects);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!description.trim()) return;

    onAddLog({
      date: todayStr,
      time: localTimeStr(),
      projectId: activeProject?.id || 'default',
      projectName: activeProject?.name || 'General',
      description: description.trim(),
      status,
      tags: selectedTag ? [selectedTag] : [],
      linkUrl: linkUrl.trim() || undefined,
      durationMinutes: undefined,
      energyRating: 4,
    });

    setDescription('');
    setLinkUrl('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-4 font-sans">
      
      {/* 1. Zen Inline Editor (Notion-inspired distraction-free writing) */}
      <div className="space-y-4 border-b border-[var(--border-app)] pb-8">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span className="font-medium tracking-tight">Today's Daily Log — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <span className="font-mono text-[11px]">⌘ + Enter to log</span>
        </div>

        {/* Borderless Title-Like Textarea */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="What you worked on today"
          placeholder="Type what you worked on today... (No distractions, just write)"
          rows={3}
          className="w-full bg-transparent border-0 focus:ring-0 text-base sm:text-lg text-[var(--text-main)] placeholder-[var(--text-subtle)] p-0 resize-none leading-relaxed tracking-tight"
          autoFocus
        />

        {/* Minimal Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
          <div className="flex items-center gap-3">
            {/* Project Inline Select */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-transparent text-[var(--text-main)] font-semibold text-xs border-b border-[var(--border-control)] pb-0.5 cursor-pointer"
            >
              {activeProjectsOf(projects).map((p) => (
                <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
                  {p.name}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="bg-transparent text-[var(--text-muted)] text-xs cursor-pointer"
            >
              <option value="completed" className="bg-[var(--bg-surface)]">Done</option>
              <option value="in_progress" className="bg-[var(--bg-surface)]">In Progress</option>
              <option value="blocked" className="bg-[var(--bg-surface)]">Blocked</option>
            </select>

            {/* Tag Select */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-transparent text-[var(--text-muted)] text-xs cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-surface)]">Add Tag...</option>
              {availableTags.map((t) => (
                <option key={t} value={t} className="bg-[var(--bg-surface)]">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={!description.trim()}
            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-[var(--text-main)] text-[var(--bg-app)] hover:opacity-90 disabled:opacity-30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* 2. Narrative Timeline (Quiet, Editorial Prose) */}
      <div className="space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Work Log Chronicle
        </h2>

        <div className="divide-y divide-[var(--border-app)]">
          {logs.map((log) => {
            const project = projects.find((p) => p.id === log.projectId);

            return (
              <div key={log.id} className="py-4 space-y-1.5 group">
                {/* Unboxed Metadata Line with Middots */}
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-main)]">
                      {log.projectName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[11px]">{log.date}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{log.status.replace('_', ' ')}</span>
                    {log.durationMinutes && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{log.durationMinutes}m</span>
                      </>
                    )}
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <button
                      onClick={() => onCopyText(`[${log.projectName}] ${log.description}`)}
                      className="p-1 hover:text-[var(--text-main)] cursor-pointer"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="p-1 hover:text-danger cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prose Body */}
                <div className="space-y-1">
                  {log.isSynthesized && (
                    <span className="text-[10px] font-mono text-warning font-semibold block">
                      ✨ Synthesized EOD Log
                    </span>
                  )}
                  <p className="text-sm text-[var(--text-main)] leading-relaxed font-normal">
                    {log.description}
                  </p>
                  {log.underlyingTasks && log.underlyingTasks.length > 0 && (
                    <details className="text-xs text-[var(--text-muted)] pt-1">
                      <summary className="cursor-pointer hover:underline">
                        View Underlying Micro-Tasks ({log.underlyingTasks.length})
                      </summary>
                      <div className="mt-1 pl-3 border-l-2 border-[var(--border-app)] space-y-1 py-1">
                        {log.underlyingTasks.map((t) => (
                          <div key={t.id} className="flex justify-between text-[11px]">
                            <span>• {t.title}</span>
                            <span className="font-mono">
                              {t.elapsedSeconds ? `${Math.floor(t.elapsedSeconds / 60)}m` : '0m'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                {/* Quiet Footer Links */}
                {(log.linkUrl || log.tags.length > 0 || log.imageBase64) && (
                  <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-muted)] pt-0.5">
                    {log.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                    {log.linkUrl && (
                      <a
                        href={log.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent-text)] hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Link</span>
                      </a>
                    )}
                    {log.imageBase64 && (
                      <button
                        onClick={() => onOpenImage(log.imageBase64!)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>View Attachment</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
