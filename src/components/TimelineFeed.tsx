import React from 'react';
import { useLogFilters } from '../hooks/useLogFilters';
import { useFocusLog, logRowId } from '../hooks/useFocusLog';
import { LogListProps } from './feed/types';
import { LogFilterBar } from './feed/LogFilterBar';
import { SelectionBar } from './feed/SelectionBar';
import { SelectBox } from './feed/SelectBox';
import { LogActions } from './feed/LogActions';
import { StatusBadge } from './feed/StatusBadge';
import { MicroTasks } from './feed/MicroTasks';
import { Clock, ExternalLink, Image as ImageIcon, Flame } from 'lucide-react';

// The Modern theme's timeline: one card per log. The other themes draw the same data in their own
// layouts (src/components/themes) from the same hooks and feed/ components.
export const TimelineFeed: React.FC<LogListProps> = ({
  logs,
  projects,
  onEditLog,
  onDeleteLog,
  onDuplicateLog,
  onOpenImage,
  selectedLogIds,
  onToggleSelectLog,
  onSelectAllVisible,
  onClearSelection,
  onOpenAiStandupWithSelected,
  onCopyText,
  onOpenEodSynthesizer,
  focusLogId,
  onFocusLogHandled,
  justAddedLogId,
}) => {
  const list = useLogFilters(logs);
  useFocusLog(focusLogId, list.reset, onFocusLogHandled);

  return (
    <div className="space-y-4">
      <div className="glass-panel p-3.5">
        <LogFilterBar {...list} projects={projects} shown={list.visible.length} total={logs.length} />
      </div>

      <SelectionBar
        visibleIds={list.visible.map((l) => l.id)}
        selectedIds={selectedLogIds}
        onSelectAll={onSelectAllVisible}
        onClear={onClearSelection}
        onGenerateStandup={onOpenAiStandupWithSelected}
      />

      {list.visible.length === 0 ? (
        <div className="text-center py-12 glass-panel p-6">
          <p className="text-sm font-semibold text-[var(--text-main)] mb-1">
            {logs.length === 0 ? 'Nothing logged yet' : 'No logs match these filters'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {logs.length === 0
              ? 'Write what you worked on in the form above and press Commit Work Log.'
              : 'Widen the date range or clear the filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.visible.map((log) => {
            const isSelected = selectedLogIds.includes(log.id);
            const project = projects.find((p) => p.id === log.projectId);

            return (
              <div
                key={log.id}
                id={logRowId(log.id)}
                tabIndex={-1}
                className={`glass-panel p-4 sm:p-5 transition-all relative group scroll-mt-24 ${log.id === justAddedLogId ? 'log-enter' : ''} ${
                  isSelected ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/40' : 'hover:border-[var(--border-focus)]/50'
                }`}
              >
                {/* Top Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--border-app)] text-xs">
                  <div className="flex items-center gap-2.5">
                    <SelectBox checked={isSelected} onChange={() => onToggleSelectLog(log.id)} />

                    <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)] tracking-tight">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: project?.color || '#6366f1' }}
                        aria-hidden="true"
                      />
                      <span>{log.projectName}</span>
                    </div>

                    <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>

                    <span className="text-[var(--text-muted)] font-mono tabular-nums text-xs">
                      {log.date} at {log.time}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={log.status} />

                    {log.durationMinutes && (
                      <span className="text-xs font-mono tabular-nums text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span>{log.durationMinutes}m</span>
                      </span>
                    )}

                    {log.energyRating && log.energyRating > 0 && (
                      <span
                        className="text-xs font-mono text-warning flex items-center gap-0.5"
                        title={`Focus rating: ${log.energyRating} / 5`}
                      >
                        <Flame className="w-3 h-3 fill-current" aria-hidden="true" />
                        <span>{log.energyRating}</span>
                        <span className="sr-only"> out of 5 focus</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Description Body */}
                <div className="py-3 space-y-2">
                  {log.isSynthesized && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning font-mono text-xs font-bold">
                      Synthesized EOD log
                    </div>
                  )}
                  <p className="text-xs sm:text-sm text-[var(--text-main)] whitespace-pre-line leading-relaxed">
                    {log.description}
                  </p>
                  {log.underlyingTasks && <MicroTasks tasks={log.underlyingTasks} />}
                </div>

                {/* Footer Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[var(--border-app)] text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {log.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-[var(--radius-btn)] border border-[var(--border-app)]"
                      >
                        {tag}
                      </span>
                    ))}

                    {log.linkUrl && (
                      <a
                        href={log.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 text-xs font-semibold py-1 -my-1"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        <span className="truncate max-w-[180px]">{log.linkUrl.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}

                    {log.imageBase64 && (
                      <button
                        type="button"
                        onClick={() => onOpenImage(log.imageBase64!)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Screenshot</span>
                      </button>
                    )}
                  </div>

                  <LogActions
                    log={log}
                    onCopyText={onCopyText}
                    onEdit={onEditLog}
                    onDuplicate={onDuplicateLog}
                    onDelete={onDeleteLog}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
