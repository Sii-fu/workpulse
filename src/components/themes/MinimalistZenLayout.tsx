import React from 'react';
import { activeProjectsOf } from '../../utils/projects';
import { useQuickLog } from '../../hooks/useQuickLog';
import { useLogFilters } from '../../hooks/useLogFilters';
import { useFocusLog, logRowId } from '../../hooks/useFocusLog';
import { LogListProps, QuickLogProps } from '../feed/types';
import { LogFilterBar } from '../feed/LogFilterBar';
import { SelectionBar } from '../feed/SelectionBar';
import { SelectBox } from '../feed/SelectBox';
import { LogActions } from '../feed/LogActions';
import { StatusBadge } from '../feed/StatusBadge';
import { MicroTasks } from '../feed/MicroTasks';
import { ExternalLink, Plus, Image as ImageIcon, SquarePen } from 'lucide-react';

type MinimalistZenLayoutProps = LogListProps & QuickLogProps;

export const MinimalistZenLayout: React.FC<MinimalistZenLayoutProps> = ({
  logs,
  projects,
  availableTags,
  onAddLog,
  onOpenDetails,
  onEditLog,
  onDeleteLog,
  onDuplicateLog,
  onOpenImage,
  onCopyText,
  selectedLogIds,
  onToggleSelectLog,
  onSelectAllVisible,
  onClearSelection,
  onOpenAiStandupWithSelected,
  onOpenEodSynthesizer,
  focusLogId,
  onFocusLogHandled,
}) => {
  const quick = useQuickLog(projects, onAddLog);
  const list = useLogFilters(logs);
  useFocusLog(focusLogId, list.reset, onFocusLogHandled);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      quick.submit();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-4 font-sans">
      {/* 1. Zen Inline Editor (Notion-inspired distraction-free writing) */}
      <div className="space-y-4 border-b border-[var(--border-app)] pb-8">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span className="font-medium tracking-tight">
            Today's Daily Log — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
          <span className="font-mono text-[11px]">Ctrl + Enter to log</span>
        </div>

        {/* Borderless Title-Like Textarea */}
        <textarea
          value={quick.description}
          onChange={(e) => quick.setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="What you worked on today"
          placeholder="Type what you worked on today... (No distractions, just write)"
          rows={3}
          className="w-full bg-transparent border-0 focus:ring-0 text-base sm:text-lg text-[var(--text-main)] p-0 resize-none leading-relaxed tracking-tight"
          autoFocus
        />

        {/* Minimal Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={quick.projectId}
              onChange={(e) => quick.setProjectId(e.target.value)}
              aria-label="Project"
              className="bg-transparent text-[var(--text-main)] font-semibold text-xs border-b border-[var(--border-control)] pb-0.5 cursor-pointer"
            >
              {activeProjectsOf(projects).map((p) => (
                <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={quick.status}
              onChange={(e) => quick.setStatus(e.target.value as typeof quick.status)}
              aria-label="Status"
              className="bg-transparent text-[var(--text-muted)] text-xs cursor-pointer"
            >
              <option value="completed" className="bg-[var(--bg-surface)]">Done</option>
              <option value="in_progress" className="bg-[var(--bg-surface)]">In Progress</option>
              <option value="blocked" className="bg-[var(--bg-surface)]">Blocked</option>
            </select>

            <select
              value={quick.tag}
              onChange={(e) => quick.setTag(e.target.value)}
              aria-label="Tag"
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDetails(quick.detailsDraft())}
              className="px-2.5 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer"
              title="Add a link, screenshot, duration, several tags or a date"
            >
              <SquarePen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add details</span>
            </button>
            <button
              type="button"
              onClick={() => quick.submit()}
              disabled={!quick.description.trim()}
              className="px-3.5 py-1.5 rounded text-xs font-semibold bg-[var(--text-main)] text-[var(--bg-app)] hover:opacity-90 disabled:opacity-30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Narrative Timeline (Quiet, Editorial Prose) */}
      <div className="space-y-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Work Log Chronicle</h2>

        <LogFilterBar
          {...list}
          projects={projects}
          shown={list.visible.length}
          total={logs.length}
        />

        <SelectionBar
          visibleIds={list.visible.map((l) => l.id)}
          selectedIds={selectedLogIds}
          onSelectAll={onSelectAllVisible}
          onClear={onClearSelection}
          onGenerateStandup={onOpenAiStandupWithSelected}
          onOpenEod={onOpenEodSynthesizer}
        />

        {list.visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">
            {logs.length === 0 ? 'Nothing logged yet. Write what you worked on above.' : 'No logs match these filters.'}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-app)]">
            {list.visible.map((log) => (
              <div
                key={log.id}
                id={logRowId(log.id)}
                tabIndex={-1}
                className="py-4 space-y-1.5 group scroll-mt-24"
              >
                {/* Unboxed Metadata Line with Middots */}
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <SelectBox checked={selectedLogIds.includes(log.id)} onChange={() => onToggleSelectLog(log.id)} />
                    <span className="font-semibold text-[var(--text-main)]">{log.projectName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[11px]">{log.date}</span>
                    <span aria-hidden="true">·</span>
                    <StatusBadge status={log.status} variant="text" />
                    {log.durationMinutes && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{log.durationMinutes}m</span>
                      </>
                    )}
                  </div>

                  <LogActions
                    log={log}
                    onCopyText={onCopyText}
                    onEdit={onEditLog}
                    onDuplicate={onDuplicateLog}
                    onDelete={onDeleteLog}
                    revealOnHover
                  />
                </div>

                {/* Prose Body */}
                <div className="space-y-1">
                  {log.isSynthesized && (
                    <span className="text-[10px] font-mono text-warning font-semibold block">Synthesized EOD log</span>
                  )}
                  <p className="text-sm text-[var(--text-main)] leading-relaxed font-normal whitespace-pre-line">
                    {log.description}
                  </p>
                  {log.underlyingTasks && <MicroTasks tasks={log.underlyingTasks} />}
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
                        className="text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 py-1 -my-1"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        <span>Link</span>
                      </a>
                    )}
                    {log.imageBase64 && (
                      <button
                        type="button"
                        onClick={() => onOpenImage(log.imageBase64!)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" aria-hidden="true" />
                        <span>View Attachment</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
