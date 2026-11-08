import React, { useState, useEffect, useRef } from 'react';
import { parseLogCommand } from '../../utils/logCommand';
import { defaultProject, activeProjectsOf } from '../../utils/projects';
import { localDateStr, localTimeStr } from '../../utils/dates';
import { TaskStatus } from '../../types';
import { isPendingTask } from '../../utils/taskLogging';
import { useLogFilters } from '../../hooks/useLogFilters';
import { useFocusLog, logRowId } from '../../hooks/useFocusLog';
import { LogListProps, QuickLogProps, TaskQueueProps } from '../feed/types';
import { LogFilterBar } from '../feed/LogFilterBar';
import { SelectionBar } from '../feed/SelectionBar';
import { SelectBox } from '../feed/SelectBox';
import { LogActions } from '../feed/LogActions';
import { StatusBadge } from '../feed/StatusBadge';
import { SampleBadge } from '../ui/SampleBadge';
import { isSampleLog } from '../../data/sampleData';
import { MicroTasks } from '../feed/MicroTasks';

type MatrixTuiLayoutProps = LogListProps &
  Omit<QuickLogProps, 'availableTags'> &
  TaskQueueProps & {
    hasGoogleSheetLinked: boolean;
    onOpenAiStandup: () => void;
  };

export const MatrixTuiLayout: React.FC<MatrixTuiLayoutProps> = ({
  logs,
  backlog,
  projects,
  hasGoogleSheetLinked,
  onAddLog,
  onOpenDetails,
  onEditLog,
  onDeleteLog,
  onDuplicateLog,
  onCopyText,
  onToggleTask,
  onConvertTaskToLog,
  onOpenAiStandup,
  onOpenImage,
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
  const list = useLogFilters(logs);
  useFocusLog(focusLogId, list.reset, onFocusLogHandled);
  const [cliInput, setCliInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([
    'WORKPULSE UNIX SUBSYSTEM v3.8.0-RELEASE',
    'Type "help" for syntax or enter work log directly below.',
  ]);
  const [systemTime, setSystemTime] = useState(new Date().toTimeString().slice(0, 8));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date().toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    const lower = cmd.toLowerCase();

    if (lower === 'help') {
      setCommandHistory((prev) => [
        ...prev,
        `$ ${cmd}`,
        'COMMANDS:',
        '  log -m "description" [-p "Project"] [-s completed|in_progress|blocked] [-t mins]',
        '  tasks                     (list pending tasks with index numbers)',
        '  done <number>             (log task & commit to sheet, e.g. "done 1")',
        '  details [text]            (open the full log form: link, screenshot, tags, date)',
        '  standup                   (trigger AI standup generator)',
        '  clear                     (clear terminal history)',
        '  or simply type text to log to default project',
      ]);
      setCliInput('');
      return;
    }

    if (lower === 'clear') {
      setCommandHistory(['WORKPULSE UNIX SUBSYSTEM v3.8.0-RELEASE']);
      setCliInput('');
      return;
    }

    if (lower === 'details' || lower.startsWith('details ')) {
      const text = cmd.slice('details'.length).trim();
      const project = defaultProject(projects);
      onOpenDetails({ description: text, projectId: project?.id || '', status: 'completed' });
      setCommandHistory((prev) => [...prev, `$ ${cmd}`, '>> Opening the full log form...']);
      setCliInput('');
      return;
    }

    if (lower === 'standup') {
      onOpenAiStandup();
      setCommandHistory((prev) => [...prev, `$ ${cmd}`, '>> Opening AI Standup Hub...']);
      setCliInput('');
      return;
    }

    if (lower === 'tasks') {
      const pending = backlog.filter(isPendingTask);
      const lines = pending.length
        ? pending.map(
            (t, idx) =>
              `  [${idx + 1}] [${(t.stage || 'planned').toUpperCase()}] ${t.title}`
          )
        : ['  No pending tasks in queue'];
      setCommandHistory((prev) => [
        ...prev,
        `$ ${cmd}`,
        'ACTIVE & PLANNED TASKS:',
        ...lines,
        '  (Type "done <number>" to log task immediately)',
      ]);
      setCliInput('');
      return;
    }

    if (lower.startsWith('done ') || lower.startsWith('logtask ')) {
      const parts = cmd.split(' ');
      const idx = parseInt(parts[1]) - 1;
      const pending = backlog.filter(isPendingTask);
      if (pending[idx]) {
        if (onConvertTaskToLog) {
          onConvertTaskToLog(pending[idx]);
        } else {
          onToggleTask(pending[idx].id);
        }
        setCommandHistory((prev) => [
          ...prev,
          `$ ${cmd}`,
          `>> Converted Task [${idx + 1}: ${pending[idx].title}] to Work Log & committed!`,
        ]);
        setCliInput('');
        return;
      } else {
        setCommandHistory((prev) => [
          ...prev,
          `$ ${cmd}`,
          `>> Invalid task index. Type "tasks" to see pending task numbers.`,
        ]);
        setCliInput('');
        return;
      }
    }

    // Parse the command (see parseLogCommand): log -m "..." -p "Project" -s blocked -t 45, or plain text
    const parsed = parseLogCommand(cmd);
    if (!parsed.description) {
      setCommandHistory((prev) => [...prev, `$ ${cmd}`, '>> ERROR: nothing to log. Usage: log -m "message" [-p project] [-s blocked|in_progress] [-t minutes]']);
      setCliInput('');
      return;
    }
    const desc = parsed.description;
    const status: TaskStatus = parsed.status;
    const mins = parsed.minutes;
    const activeProjects = activeProjectsOf(projects);
    const matchedProject =
      (parsed.project &&
        activeProjects.find((p) => p.name.toLowerCase().includes(parsed.project!.toLowerCase()))) ||
      defaultProject(projects);

    onAddLog({
      date: localDateStr(),
      time: localTimeStr(),
      projectId: matchedProject?.id || 'default',
      projectName: matchedProject?.name || 'General',
      description: desc,
      status,
      tags: [],
      durationMinutes: mins,
      energyRating: 5,
    });

    setCommandHistory((prev) => [
      ...prev,
      `$ ${cmd}`,
      `>> SUCCESS: Log written to [${matchedProject?.name}]. Status: ${status.toUpperCase()}.`,
    ]);

    setCliInput('');
  };

  return (
    <div className="space-y-4 font-mono text-xs text-[var(--text-main)]">
      
      {/* 1. Terminal Window Console */}
      <div className="p-4 border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-[0_0_15px_rgba(0,255,102,0.06)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-app)] pb-2 text-xs text-[var(--text-muted)]">
          <span className="matrix-glow font-bold text-[var(--text-main)]">
            +---[ WORKPULSE CLI TERMINAL v3.8 ]---+
          </span>
          <span>TTY: /dev/pts/1</span>
        </div>

        {/* Scrollable Command Line History */}
        <div className="max-h-48 overflow-y-auto space-y-1 text-xs leading-relaxed">
          {commandHistory.map((line, idx) => (
            <div key={idx} className={line.startsWith('$') ? 'text-[var(--text-main)] font-bold' : 'text-[var(--text-muted)]'}>
              {line}
            </div>
          ))}
        </div>

        {/* Live Command Prompt Input */}
        <form onSubmit={handleCommand} className="flex items-center gap-2 pt-2 border-t border-[var(--border-app)]">
          <span className="text-[var(--text-main)] font-bold shrink-0 matrix-glow">
            user@workpulse:~$
          </span>
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={cliInput}
              onChange={(e) => setCliInput(e.target.value)}
              aria-label="Command line"
              placeholder='log -m "Task description..." or plain text (type help for docs)'
              className="w-full bg-transparent border-0 text-[var(--text-main)] placeholder-[var(--text-subtle)] text-xs"
              autoFocus
            />
            <span className="w-2 h-4 bg-[var(--accent)] animate-pulse inline-block shrink-0" />
          </div>
          <button
            type="submit"
            className="px-2 py-0.5 bg-[var(--accent)] text-[var(--on-accent)] font-bold text-xs uppercase cursor-pointer hover:bg-[var(--accent-hover)]"
          >
            EXEC
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenDetails({ description: cliInput.trim(), projectId: defaultProject(projects)?.id || '', status: 'completed' });
              setCliInput('');
            }}
            title="Open the full log form: link, screenshot, tags, date"
            className="px-2 py-0.5 border border-[var(--border-control)] text-[var(--text-main)] font-bold text-xs uppercase cursor-pointer hover:bg-[var(--bg-subtle)]"
          >
            DETAILS
          </button>
        </form>
      </div>

      {/* 2. Structured UNIX Log Chronicle */}
      <div className="border border-[var(--border-app)] bg-[var(--bg-surface)] p-3 space-y-2">
        <div className="flex items-center justify-between border-b border-[var(--border-app)] pb-1.5 text-xs text-[var(--text-muted)]">
          <span>+---[ STORED WORK LOGS ]---+</span>
          <span>
            SHOWING: {list.visible.length} / {logs.length} RECORDS
          </span>
        </div>

        <LogFilterBar {...list} projects={projects} shown={list.visible.length} total={logs.length} dense />

        <SelectionBar
          visibleIds={list.visible.map((l) => l.id)}
          selectedIds={selectedLogIds}
          onSelectAll={onSelectAllVisible}
          onClear={onClearSelection}
          onGenerateStandup={onOpenAiStandupWithSelected}
          dense
        />

        <div className="divide-y divide-[var(--border-app)] text-xs">
          {list.visible.length === 0 && (
            <p className="py-6 text-center text-[var(--text-muted)]">
              {logs.length === 0 ? '>> no records. type a message above.' : '>> no records match these filters.'}
            </p>
          )}
          {list.visible.map((log) => (
            <div
              key={log.id}
              id={logRowId(log.id)}
              tabIndex={-1}
              className={`py-2.5 space-y-1 hover:bg-[var(--bg-subtle)]/30 px-1 group scroll-mt-24 ${log.id === justAddedLogId ? 'log-enter' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold flex items-center gap-1.5 min-w-0">
                  <SelectBox checked={selectedLogIds.includes(log.id)} onChange={() => onToggleSelectLog(log.id)} />
                  <span className="truncate">
                    [{log.date} {log.time}] [{log.projectName.toUpperCase()}]
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <SampleBadge show={isSampleLog(log)} />
                  <StatusBadge status={log.status} variant="bracket" />
                </span>
              </div>
              <p className="text-[var(--text-main)] whitespace-pre-line">&gt; {log.description}</p>
              {log.underlyingTasks && <MicroTasks tasks={log.underlyingTasks} dense />}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] pt-0.5">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span>
                    TIME: {log.durationMinutes || 0}m · TAGS: {log.tags.join(' ') || '-'}
                  </span>
                  {log.imageBase64 && onOpenImage && (
                    <button
                      type="button"
                      onClick={() => onOpenImage(log.imageBase64 as string)}
                      className="hover:text-[var(--text-main)] cursor-pointer"
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
                      className="hover:text-[var(--text-main)]"
                      aria-label={`Open link ${log.linkUrl}`}
                    >
                      [LINK]
                    </a>
                  )}
                </span>
                <LogActions
                  log={log}
                  onCopyText={onCopyText}
                  onEdit={onEditLog}
                  onDuplicate={onDuplicateLog}
                  onDelete={onDeleteLog}
                  variant="bracket"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tmux / Vim-Style Bottom Status Bar */}
      <div className="p-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex flex-wrap items-center justify-between text-xs font-bold tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className="bg-[var(--accent)] text-[var(--on-accent)] px-1.5 py-0.2">[NORMAL]</span>
          <span>100% LOCAL CACHED</span>
          <span>·</span>
          <span>{hasGoogleSheetLinked ? 'SHEETS: CONNECTED' : 'SHEETS: STANDALONE'}</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span>UTF-8</span>
          <span>[TUI]</span>
          <span className="text-[var(--text-main)]">{systemTime}</span>
        </div>
      </div>

    </div>
  );
};
