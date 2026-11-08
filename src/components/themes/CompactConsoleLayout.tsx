import React, { useState, useEffect } from 'react';
import { activeProjectsOf } from '../../utils/projects';
import { isPendingTask } from '../../utils/taskLogging';
import { useQuickLog } from '../../hooks/useQuickLog';
import { useLogFilters } from '../../hooks/useLogFilters';
import { useFocusLog, logRowId } from '../../hooks/useFocusLog';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { LogListProps, QuickLogProps, TaskQueueProps } from '../feed/types';
import { LogFilterBar } from '../feed/LogFilterBar';
import { SelectionBar } from '../feed/SelectionBar';
import { SelectBox } from '../feed/SelectBox';
import { LogActions, copyTextOf } from '../feed/LogActions';
import { StatusBadge } from '../feed/StatusBadge';
import { SampleBadge } from '../ui/SampleBadge';
import { isSampleLog } from '../../data/sampleData';
import { MicroTasks } from '../feed/MicroTasks';
import { IconButton } from '../ui/IconButton';
import { CornerDownLeft, ListTodo, Check, Zap, SquarePen, X } from 'lucide-react';

type CompactConsoleLayoutProps = LogListProps & QuickLogProps & TaskQueueProps;

export const CompactConsoleLayout: React.FC<CompactConsoleLayoutProps> = ({
  logs,
  backlog,
  projects,
  availableTags,
  onAddLog,
  onOpenDetails,
  onEditLog,
  onDeleteLog,
  onDuplicateLog,
  onOpenImage,
  onCopyText,
  onToggleTask,
  onConvertTaskToLog,
  selectedLogIds,
  onToggleSelectLog,
  onSelectAllVisible,
  onClearSelection,
  onOpenAiStandupWithSelected,
  onOpenEodSynthesizer,
  focusLogId,
  onFocusLogHandled,
  justAddedLogId,
}) => {
  const quick = useQuickLog(projects, onAddLog, { withDuration: true });
  const list = useLogFilters(logs);
  useFocusLog(focusLogId, list.reset, onFocusLogHandled);
  const [showBacklog, setShowBacklog] = useState(false);
  // The table needs about 760 px; below that each log becomes a card so its actions stay on screen.
  const isWide = useMediaQuery('(min-width: 768px)');

  // Keyboard driving, like a spreadsheet: j and k move a row cursor, e edits it, x selects it,
  // c copies it, d duplicates it, / jumps to search. Delete has no key on purpose.
  const [cursorId, setCursorId] = useState<string | null>(null);
  useEffect(() => {
    if (!isWide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]'))) return;
      const ids = list.visible.map((l) => l.id);
      const at = cursorId ? ids.indexOf(cursorId) : -1;
      const current = at >= 0 ? list.visible[at] : null;
      const move = (to: number) => {
        const id = ids[Math.max(0, Math.min(ids.length - 1, to))];
        if (!id) return;
        setCursorId(id);
        document.getElementById(logRowId(id))?.scrollIntoView({ block: 'nearest' });
      };
      switch (e.key) {
        case 'j': e.preventDefault(); move(at + 1); break;
        case 'k': e.preventDefault(); move(at < 0 ? 0 : at - 1); break;
        case 'e': if (current) { e.preventDefault(); onEditLog(current); } break;
        case 'x': if (current) { e.preventDefault(); onToggleSelectLog(current.id); } break;
        case 'c': if (current) { e.preventDefault(); onCopyText(copyTextOf(current)); } break;
        case 'd': if (current) { e.preventDefault(); onDuplicateLog(current); } break;
        case '/': e.preventDefault(); document.querySelector<HTMLInputElement>('[role="search"] input')?.focus(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isWide, list.visible, cursorId, onEditLog, onToggleSelectLog, onCopyText, onDuplicateLog]);

  const pendingTasks = backlog.filter(isPendingTask);
  const control = 'h-8 px-2 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded text-xs text-[var(--text-main)] cursor-pointer';

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* 1. Horizontal Single-Line Command Bar (Zero Vertical Wastage) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          quick.submit();
        }}
        className="glass-panel p-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1.5 border border-[var(--border-app)] shadow-xs"
      >
        <select
          value={quick.projectId}
          onChange={(e) => quick.setProjectId(e.target.value)}
          aria-label="Project"
          className={`${control} font-semibold`}
        >
          {activeProjectsOf(projects).map((p) => (
            <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={quick.description}
          onChange={(e) => quick.setDescription(e.target.value)}
          aria-label="Quick log description"
          placeholder="Fast single-line log (e.g. Fixed caching race condition)..."
          className="flex-1 min-w-[10rem] h-8 px-3 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded text-xs text-[var(--text-main)] focus:border-[var(--accent)] font-sans"
        />

        <select
          value={quick.status}
          onChange={(e) => quick.setStatus(e.target.value as typeof quick.status)}
          aria-label="Status"
          className={control}
        >
          <option value="completed" className="bg-[var(--bg-surface)]">DONE</option>
          <option value="in_progress" className="bg-[var(--bg-surface)]">IN_PROG</option>
          <option value="blocked" className="bg-[var(--bg-surface)]">BLOCKED</option>
        </select>

        {availableTags.length > 0 && (
          <select value={quick.tag} onChange={(e) => quick.setTag(e.target.value)} aria-label="Tag" className={`${control} max-w-[7rem]`}>
            <option value="" className="bg-[var(--bg-surface)]">no tag</option>
            {availableTags.map((t) => (
              <option key={t} value={t} className="bg-[var(--bg-surface)]">
                {t}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 h-8 px-2 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded">
          <input
            type="number"
            aria-label="Duration in minutes"
            min={5}
            step={5}
            value={quick.duration}
            onChange={(e) => quick.setDuration(e.target.value)}
            className="w-10 text-center text-xs bg-transparent"
          />
          <span className="text-xs text-[var(--text-muted)]">m</span>
        </div>

        <button
          type="submit"
          className="h-8 px-3 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
        >
          <span>LOG</span>
          <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
        </button>

        <IconButton
          label="Add details"
          hint="Add a link, screenshot, several tags or a date"
          onClick={() => onOpenDetails(quick.detailsDraft())}
          className="h-8 border border-[var(--border-control)] bg-[var(--bg-subtle)]"
        >
          <SquarePen className="w-3.5 h-3.5" />
        </IconButton>

        <button
          type="button"
          onClick={() => setShowBacklog(!showBacklog)}
          aria-expanded={showBacklog}
          className={`h-8 px-2.5 rounded border border-[var(--border-control)] text-xs flex items-center gap-1 cursor-pointer transition-colors ${
            showBacklog
              ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
          title="Toggle Tasks Drawer"
          aria-label={`Pending tasks: ${pendingTasks.length}`}
        >
          <ListTodo className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{pendingTasks.length}</span>
        </button>
      </form>

      {/* Optional Top Tasks Drawer if toggled */}
      {showBacklog && (
        <div className="glass-panel p-3 border border-[var(--border-app)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">
            <span>Pending tasks ({pendingTasks.length})</span>
            <IconButton label="Close tasks drawer" onClick={() => setShowBacklog(false)}>
              <X className="w-3.5 h-3.5" />
            </IconButton>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                className="p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-app)] hover:border-[var(--accent)] flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <IconButton label={`Check off task: ${t.title}`} hint="Check off task" onClick={() => onToggleTask(t.id)} className="hover:text-success">
                    <Check className="w-3.5 h-3.5" />
                  </IconButton>
                  <span className="truncate">{t.title}</span>
                </div>
                {onConvertTaskToLog && (
                  <button
                    type="button"
                    onClick={() => onConvertTaskToLog(t)}
                    className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1"
                    title="Log to Work Log and Sheet"
                    aria-label={`Log task: ${t.title}`}
                  >
                    <Zap className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                    <span>LOG</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <LogFilterBar {...list} projects={projects} shown={list.visible.length} total={logs.length} dense />

      <SelectionBar
        visibleIds={list.visible.map((l) => l.id)}
        selectedIds={selectedLogIds}
        onSelectAll={onSelectAllVisible}
        onClear={onClearSelection}
        onGenerateStandup={onOpenAiStandupWithSelected}
        dense
      />

      {/* 2a. Phones: one card per log */}
      {!isWide && (
        <ul className="space-y-2 font-sans">
          {list.visible.length === 0 && (
            <li className="glass-panel px-3 py-8 text-center text-[var(--text-muted)]">
              {logs.length === 0 ? 'Nothing logged yet. Use the bar above.' : 'No logs match these filters.'}
            </li>
          )}
          {list.visible.map((log) => {
            const project = projects.find((p) => p.id === log.projectId);
            return (
              <li key={log.id} id={logRowId(log.id)} tabIndex={-1} className={`glass-panel p-3 space-y-1.5 scroll-mt-24 ${log.id === justAddedLogId ? 'log-enter' : ''}`}>
                <div className="flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <SelectBox checked={selectedLogIds.includes(log.id)} onChange={() => onToggleSelectLog(log.id)} />
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: project?.color || '#6366f1' }} aria-hidden="true" />
                    <span className="font-semibold text-[var(--text-main)] truncate">{log.projectName}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <SampleBadge show={isSampleLog(log)} />
                    <StatusBadge status={log.status} variant="bracket" />
                  </span>
                </div>
                <p className="text-xs text-[var(--text-main)] whitespace-pre-line">{log.description}</p>
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  {log.date} {log.time} · {log.durationMinutes ? `${log.durationMinutes}m` : '-'}
                  {log.tags.length > 0 && ` · ${log.tags.join(' ')}`}
                </p>
                {log.underlyingTasks && <MicroTasks tasks={log.underlyingTasks} dense />}
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span className="flex items-center gap-3 text-xs">
                    {log.imageBase64 && (
                      <button type="button" onClick={() => onOpenImage(log.imageBase64 as string)} className="text-[var(--accent-text)] hover:underline cursor-pointer">
                        [IMG]
                      </button>
                    )}
                    {log.linkUrl && (
                      <a href={log.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:underline" aria-label={`Open link ${log.linkUrl}`}>
                        [LINK]
                      </a>
                    )}
                  </span>
                  <LogActions log={log} onCopyText={onCopyText} onEdit={onEditLog} onDuplicate={onDuplicateLog} onDelete={onDeleteLog} variant="text" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 2b. Full-Width Dense Spreadsheet Feed */}
      {isWide && (
      <div className="glass-panel overflow-x-auto border border-[var(--border-app)] shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase tracking-wider text-xs h-9">
              <th className="pl-2.5 w-8"><span className="sr-only">Select</span></th>
              <th className="px-2.5 w-24">Date</th>
              <th className="px-2.5 w-32">Project</th>
              <th className="px-2.5">Work Description</th>
              <th className="px-2.5 w-24">Status</th>
              <th className="px-2.5 w-16 text-right">Mins</th>
              <th className="px-2.5 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-app)]">
            {list.visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--text-muted)] font-sans">
                  {logs.length === 0 ? 'Nothing logged yet. Use the bar above.' : 'No logs match these filters.'}
                </td>
              </tr>
            )}
            {list.visible.map((log) => {
              const project = projects.find((p) => p.id === log.projectId);

              return (
                <tr
                  key={log.id}
                  id={logRowId(log.id)}
                  tabIndex={-1}
                  aria-current={log.id === cursorId ? 'true' : undefined}
                  className={`min-h-9 hover:bg-[var(--bg-subtle-hover)] transition-colors group align-top scroll-mt-24 ${log.id === justAddedLogId ? 'log-enter' : ''} ${
                    log.id === cursorId ? 'bg-[var(--bg-subtle-hover)]' : ''
                  }`}
                >
                  <td className="pl-2.5 pt-1.5">
                    <SelectBox checked={selectedLogIds.includes(log.id)} onChange={() => onToggleSelectLog(log.id)} />
                  </td>
                  <td className="px-2.5 py-2 text-[var(--text-muted)] whitespace-nowrap">
                    {log.id === cursorId && <span aria-hidden="true" className="text-[var(--accent-text)] mr-1">›</span>}
                    {log.date}
                  </td>
                  <td className="px-2.5 py-2 font-semibold text-[var(--text-main)] whitespace-nowrap truncate max-w-[130px]">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: project?.color || '#6366f1' }}
                        aria-hidden="true"
                      />
                      <span className="truncate" title={log.projectName}>
                        {log.projectName}
                      </span>
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-[var(--text-main)] font-sans max-w-[420px]">
                    <span className="block truncate" title={log.description}>
                      {log.description}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)] empty:hidden">
                      <SampleBadge show={isSampleLog(log)} />
                      {log.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                      {log.imageBase64 && (
                        <button
                          type="button"
                          onClick={() => onOpenImage(log.imageBase64 as string)}
                          className="text-[var(--accent-text)] hover:underline cursor-pointer"
                          title="View screenshot"
                          aria-label="View screenshot"
                        >
                          [IMG]
                        </button>
                      )}
                      {log.linkUrl && (
                        <a
                          href={log.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent-text)] hover:underline"
                          title={log.linkUrl}
                          aria-label={`Open link ${log.linkUrl}`}
                        >
                          [LINK]
                        </a>
                      )}
                    </span>
                    {log.underlyingTasks && <MicroTasks tasks={log.underlyingTasks} dense />}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap">
                    <StatusBadge status={log.status} variant="bracket" />
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                    {log.durationMinutes ? `${log.durationMinutes}m` : '-'}
                  </td>
                  <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                    <div className="flex justify-end">
                      <LogActions
                        log={log}
                        onCopyText={onCopyText}
                        onEdit={onEditLog}
                        onDuplicate={onDuplicateLog}
                        onDelete={onDeleteLog}
                        variant="text"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {isWide && (
        <p className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--text-muted)]" aria-label="Keyboard shortcuts">
          {[['j k', 'move'], ['e', 'edit'], ['x', 'select'], ['c', 'copy'], ['d', 'duplicate'], ['/', 'search']].map(([key, what]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-control)] bg-[var(--bg-subtle)] text-[var(--text-main)]">{key}</kbd>
              {what}
            </span>
          ))}
        </p>
      )}
    </div>
  );
};
