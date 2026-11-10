import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RotateCw, Sparkles, X } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { IconButton } from '../ui/IconButton';
import { localDateStr } from '../../utils/dates';
import { describeSources, loadSuggestions, noticeSignature, PipelineResult } from '../../utils/activity/pipeline';
import { suggestionToLogData, trackedMinutesFor } from '../../utils/activity/suggestions';
import { formatEstimate, formatMinutes } from '../../utils/activity/time';
import type { BacklogTask, Project, WorkLog } from '../../types';
import type { ActivityAi, ActivityFolder, ActivitySources, Suggestion } from '../../utils/activity/types';

export interface ActivitySuggestionsPanelProps {
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  folders: ActivityFolder[];
  sources: ActivitySources;
  ai: ActivityAi;
  geminiApiKey: string;
  /** Adds several logs in one go (one state update, one sheet sync). */
  onAddLogs: (logs: Omit<WorkLog, 'id' | 'createdAt'>[]) => void;
  onOpenSettings: () => void;
  /** How many suggestions are waiting (not added yet), reported after every scan and every add. */
  onPendingChange?: (count: number) => void;
  /** Called when a scan has finished and its suggestions are on screen. */
  onScanned?: () => void;
  /** Embedded on a screen: today only, one line per suggestion, edits open on demand. */
  compact?: boolean;
  /** id for the heading (full mode), so a dialog can name itself after it. */
  titleId?: string;
  /** Extra controls at the end of the heading row (full mode), e.g. a close button. */
  headerEnd?: React.ReactNode;
}

interface ActivitySuggestionsDialogProps extends Omit<ActivitySuggestionsPanelProps, 'onPendingChange' | 'onScanned' | 'compact' | 'titleId' | 'headerEnd'> {
  isOpen: boolean;
  onClose: () => void;
}

interface Row {
  suggestion: Suggestion;
  checked: boolean;
  text: string;
  projectId: string;
  minutes: string;
  /** One sub-task per line. */
  subtasks: string;
}

const NOTICE_KEY = 'workpulse_activity_notice';
const readAck = (): string => {
  try {
    return localStorage.getItem(NOTICE_KEY) ?? '';
  } catch {
    return '';
  }
};
const writeAck = (sig: string) => {
  try {
    localStorage.setItem(NOTICE_KEY, sig);
  } catch {
    // Not remembered: the notice simply shows again next time.
  }
};

const FIELD =
  'bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--border-focus)]';

const PRIMARY =
  'px-4 py-2 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer';

// 'idle' is the state before the panel has decided between 'notice' (first use, or a new source
// was switched on) and 'loading': nothing is read while it lasts.
type Phase = 'idle' | 'notice' | 'loading' | 'ready' | 'error';

/** The dialog: a ModalShell around the panel. Closing unmounts the panel, which drops any scan still running. */
export const ActivitySuggestionsDialog: React.FC<ActivitySuggestionsDialogProps> = ({ isOpen, onClose, onOpenSettings, ...rest }) => {
  if (!isOpen) return null;
  return (
    <ModalShell
      onClose={onClose}
      labelledBy="activity-title"
      backdropClassName="p-3 sm:p-4"
      className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[var(--radius-card)] border overflow-hidden shadow-2xl bg-[var(--bg-surface-elevated)] border-[var(--border-app)] text-[var(--text-main)]"
    >
      <ActivitySuggestionsPanel
        {...rest}
        titleId="activity-title"
        onOpenSettings={() => {
          onClose();
          onOpenSettings();
        }}
        headerEnd={
          <IconButton label="Close" onClick={onClose}>
            <X className="w-5 h-5" />
          </IconButton>
        }
      />
    </ModalShell>
  );
};

/** The body of activity suggestions: data notice, scanning, rows to tick and edit, and Add. */
export const ActivitySuggestionsPanel: React.FC<ActivitySuggestionsPanelProps> = ({
  logs,
  backlog,
  projects,
  folders,
  sources,
  ai,
  geminiApiKey,
  onAddLogs,
  onOpenSettings,
  onPendingChange,
  onScanned,
  compact = false,
  titleId,
  headerEnd,
}) => {
  const fallbackId = useId();
  const [date, setDate] = useState(localDateStr());
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [addedCount, setAddedCount] = useState(0);
  const [runId, setRunId] = useState(0);
  // Compact mode: the suggestion whose editor is open.
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const signature = noticeSignature(sources, ai);
  const hasSetup = folders.length > 0 && (sources.claude || sources.git);
  const activeProjects = projects.filter((p) => !p.isArchived);

  // The scan reads the latest logs and tasks without re-running whenever they change
  // (adding logs from this panel changes them).
  const latest = useRef({ logs, backlog, projects, folders, sources, geminiApiKey, ai });
  latest.current = { logs, backlog, projects, folders, sources, geminiApiKey, ai };
  const callbacks = useRef({ onPendingChange, onScanned });
  callbacks.current = { onPendingChange, onScanned };

  // Only the newest scan may write its result: a slower, older one (date changed twice) is dropped.
  const scanSeq = useRef(0);

  // Fresh start on mount. Unmounting drops any scan still running, so a reopened panel can never
  // act on a stale phase before the notice is decided.
  useEffect(() => {
    setPhase(readAck() === signature ? 'loading' : 'notice');
    setRunId((n) => n + 1);
    return () => {
      scanSeq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(async (forDate: string) => {
    const seq = ++scanSeq.current;
    setError('');
    try {
      const l = latest.current;
      const r = await loadSuggestions({ date: forDate, folders: l.folders, sources: l.sources, projects: l.projects, logs: l.logs, backlog: l.backlog, geminiApiKey: l.geminiApiKey, ai: l.ai });
      if (seq !== scanSeq.current) return;
      setResult(r);
      setRows(
        r.suggestions.map((s) => ({ suggestion: s, checked: false, text: s.text, projectId: s.projectId, minutes: String(s.minutes), subtasks: s.subtasks.join('\n') })),
      );
      setEditingKey(null);
      setPhase('ready');
      callbacks.current.onScanned?.();
    } catch (err) {
      if (seq !== scanSeq.current) return;
      setError(err instanceof Error ? err.message : 'Reading your activity failed.');
      setPhase('error');
    }
  }, []);

  // Runs whenever the panel is loading: on mount, on a different day, on retry, and once the
  // notice is accepted.
  useEffect(() => {
    if (hasSetup && phase === 'loading') void run(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSetup, date, runId, phase === 'loading']);

  // Suggestions still waiting, for the app's next action. Only a finished scan has a count.
  useEffect(() => {
    if (phase === 'ready') callbacks.current.onPendingChange?.(rows.length);
  }, [phase, rows.length]);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.suggestion.key === key ? { ...r, ...patch } : r)));

  const chosen = rows.filter((r) => r.checked);
  const canAdd = chosen.length > 0 && chosen.every((r) => r.text.trim().length > 0);
  const allChecked = rows.length > 0 && rows.every((r) => r.checked);

  const handleAdd = () => {
    if (!canAdd) return;
    onAddLogs(
      chosen.map((r) => {
        const name = projects.find((p) => p.id === r.projectId)?.name ?? r.suggestion.projectName;
        const minutes = Math.max(0, Math.round(Number(r.minutes)) || 0);
        return suggestionToLogData(r.suggestion, date, minutes, r.text.trim(), r.projectId, name, r.subtasks.split('\n'));
      }),
    );
    setAddedCount((n) => n + chosen.length);
    setRows((prev) => prev.filter((r) => !r.checked));
  };

  const acceptNotice = () => {
    writeAck(signature);
    setPhase('loading');
    setRunId((n) => n + 1);
  };

  const rescan = () => {
    setAddedCount(0);
    setPhase('loading');
    setRunId((n) => n + 1);
  };

  const sourceLines = result ? describeSources(sources, result.status) : [];

  // The editable fields of one suggestion: text, sub-tasks, project, minutes, evidence and the
  // already-tracked warning. Shown for every row in full mode, and for the opened row in compact mode.
  const renderEditor = (r: Row) => {
    const s = r.suggestion;
    const unchanged = Number(r.minutes) === s.minutes;
    // Live, not frozen at scan time: counts logs added from this panel and a changed project.
    const tracked = trackedMinutesFor(date, r.projectId, logs, backlog);
    return (
      <>
        <div className="pl-6">
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor={`sub-${s.key}`}>
            Sub-tasks, one per line. They are listed under the log.
          </label>
          <textarea
            id={`sub-${s.key}`}
            value={r.subtasks}
            onChange={(e) => update(s.key, { subtasks: e.target.value })}
            rows={Math.min(8, Math.max(2, r.subtasks.split('\n').length))}
            className={`w-full resize-y ${FIELD}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <select value={r.projectId} onChange={(e) => update(s.key, { projectId: e.target.value })} aria-label="Project" className={FIELD}>
            {!activeProjects.some((p) => p.id === r.projectId) && <option value={r.projectId}>{s.projectName}</option>}
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <input
              type="number"
              min={0}
              value={r.minutes}
              onChange={(e) => update(s.key, { minutes: e.target.value })}
              aria-label="Minutes"
              className={`w-20 ${FIELD}`}
            />
            <span>min</span>
          </label>
          <span className="text-xs text-[var(--text-muted)]">{unchanged ? formatEstimate(s.minutes) : 'edited by you'}</span>
        </div>
        <p className="pl-6 text-xs text-[var(--text-muted)]">From: {s.evidence}</p>
        {tracked > 0 && (
          <p className="pl-6 text-xs text-warning">You already have {formatMinutes(tracked)} tracked or logged for this project on this day.</p>
        )}
      </>
    );
  };

  const settingsButton = (
    <button type="button" onClick={onOpenSettings} className={PRIMARY}>
      Open Settings
    </button>
  );

  const body = !hasSetup ? (
    <div className={compact ? 'py-2 space-y-2' : 'py-10 text-center space-y-3'}>
      <p className="text-sm font-semibold">
        {folders.length === 0 ? 'Choose the folders to read first.' : 'Turn on at least one source first.'}
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        Suggestions come from the folders you list in Settings. Nothing else on this computer is read.
      </p>
      {settingsButton}
    </div>
  ) : phase === 'notice' ? (
    <div className={compact ? 'py-1 space-y-3' : 'py-8 max-w-lg mx-auto space-y-4'}>
      <h3 className="text-sm font-bold">Before the first scan</h3>
      <ul className="text-xs text-[var(--text-muted)] space-y-1.5 list-disc pl-5">
        {ai === 'none' ? (
          <li>Nothing is sent anywhere: the log text is written on this computer from your commits and prompts.</li>
        ) : (
          <>
            {sources.git && <li>The subjects of your git commits go to {ai === 'claude' ? 'Claude, through the Claude Code on this computer,' : 'Gemini'} so it can group them and write the log text.</li>}
            {sources.claude && (
              <li>The first line of your Claude Code prompts, session titles and edited file names go to {ai === 'claude' ? 'Claude' : 'Gemini'} too.</li>
            )}
            <li>Anything that looks like a key or password is hidden first.</li>
          </>
        )}
        <li>File contents and command output never leave your computer.</li>
        {ai !== 'none' && <li>If the AI is not available, the text is written from the same material on this computer instead.</li>}
      </ul>
      <button type="button" onClick={acceptNotice} className={PRIMARY}>
        Continue
      </button>
    </div>
  ) : phase === 'loading' || phase === 'idle' ? (
    <div className={compact ? 'py-3 flex items-center gap-2' : 'py-16 text-center space-y-3'} role="status">
      <Loader2 className={`${compact ? 'w-4 h-4' : 'w-9 h-9 mx-auto'} text-[var(--accent-text)] animate-spin`} aria-hidden="true" />
      <p className="text-sm font-semibold">Reading your activity...</p>
    </div>
  ) : phase === 'error' ? (
    <div className={`${compact ? 'p-3 space-y-2' : 'p-6 text-center space-y-3'} border border-danger/30 bg-danger/10 rounded-[var(--radius-card)]`}>
      {!compact && <AlertTriangle className="w-8 h-8 text-danger mx-auto" aria-hidden="true" />}
      <p className="text-sm font-semibold text-danger">{error}</p>
      <div className={`flex gap-2 ${compact ? '' : 'justify-center'}`}>
        <button
          type="button"
          onClick={() => setPhase('loading')}
          className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--text-main)] text-[var(--bg-app)] hover:opacity-90 cursor-pointer"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-subtle-hover)] cursor-pointer"
        >
          Open Settings
        </button>
      </div>
    </div>
  ) : (
    <>
      {result?.notice && (
        <p role="status" className="text-xs p-2.5 rounded-[var(--radius-btn)] border border-warning/30 bg-warning/10 text-[var(--text-main)]">
          {result.notice}
        </p>
      )}
      {!compact && sourceLines.length > 0 && (
        <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
          {sourceLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <div className={compact ? 'py-1 space-y-1' : 'py-10 text-center space-y-1'}>
          <p className="text-sm font-semibold">
            {addedCount > 0 ? `Added ${addedCount} ${addedCount === 1 ? 'log' : 'logs'}. Nothing else is waiting.` : compact ? 'Nothing new in your activity today.' : 'No new activity found for this day.'}
          </p>
          {!compact && (
            <p className="text-xs text-[var(--text-muted)]">
              {addedCount > 0 ? 'Close this window or pick another day.' : 'Pick another day, or check the folders and sources in Settings.'}
            </p>
          )}
        </div>
      ) : compact ? (
        <ul>
          {rows.map((r) => {
            const s = r.suggestion;
            const open = editingKey === s.key;
            const projectName = projects.find((p) => p.id === r.projectId)?.name ?? s.projectName;
            const minutes = Math.max(0, Math.round(Number(r.minutes)) || 0);
            return (
              <li key={s.key} className="py-[var(--row-pad)] border-b border-[var(--border-app)] space-y-2.5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={r.checked}
                    onChange={(e) => update(s.key, { checked: e.target.checked })}
                    aria-label={`Add: ${r.text.slice(0, 60)}`}
                    className="mt-1 w-4 h-4 shrink-0 accent-[var(--accent-text)]"
                  />
                  <div className="flex-1 min-w-0">
                    {open ? (
                      <textarea
                        value={r.text}
                        onChange={(e) => update(s.key, { text: e.target.value })}
                        aria-label="Log text"
                        rows={2}
                        className={`w-full resize-y ${FIELD}`}
                      />
                    ) : (
                      <p className="text-[length:var(--fs-body)] font-semibold break-words">{r.text}</p>
                    )}
                    <p className="mt-1 text-[length:var(--fs-small)] text-[var(--text-muted)]">
                      {projectName} · {s.evidence} · {Number(r.minutes) === s.minutes ? formatEstimate(minutes) : `${formatMinutes(minutes)}, edited by you`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingKey(open ? null : s.key)}
                    aria-expanded={open}
                    className="shrink-0 min-h-8 pointer-coarse:min-h-11 px-2 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer"
                  >
                    {open ? 'Done editing' : 'Edit'}
                  </button>
                </div>
                {open && renderEditor(r)}
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, checked: e.target.checked })))}
            />
            <span>Select all ({rows.length})</span>
          </label>
          <ul className="space-y-3">
            {rows.map((r) => {
              const s = r.suggestion;
              return (
                <li key={s.key} className="p-3 rounded-[var(--radius-card)] border border-[var(--border-control)] bg-[var(--bg-subtle)] space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={r.checked}
                      onChange={(e) => update(s.key, { checked: e.target.checked })}
                      aria-label={`Add: ${r.text.slice(0, 60)}`}
                      className="mt-2"
                    />
                    <textarea
                      value={r.text}
                      onChange={(e) => update(s.key, { text: e.target.value })}
                      aria-label="Log text"
                      rows={2}
                      className={`flex-1 resize-y ${FIELD}`}
                    />
                  </div>
                  {renderEditor(r)}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );

  const footer = hasSetup && phase === 'ready' && rows.length > 0 && (
    <div className={`flex items-center justify-between gap-3 shrink-0 ${compact ? 'pt-3' : 'p-4 border-t border-[var(--border-app)]'}`}>
      <span className="text-xs text-[var(--text-muted)]">
        {compact ? `${chosen.length} of ${rows.length} selected` : `${chosen.length} selected`}
      </span>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        className="px-5 py-2 text-xs sm:text-sm font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {compact
          ? chosen.length > 0
            ? `Add ${chosen.length} ${chosen.length === 1 ? 'log' : 'logs'}`
            : 'Add selected'
          : chosen.length > 0
            ? `Add ${chosen.length} selected`
            : 'Add selected'}
      </button>
    </div>
  );

  if (compact) {
    return (
      <div>
        {body}
        {footer}
        {hasSetup && (phase === 'ready' || phase === 'error') && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={rescan}
              className="inline-flex items-center gap-1.5 min-h-8 pointer-coarse:min-h-11 px-2 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              Scan again
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border-app)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/30">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId ?? fallbackId} className="text-base sm:text-lg font-bold">Suggest logs from my activity</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Tick the ones that are right. You can edit them before adding.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <span>Day</span>
            <input
              type="date"
              value={date}
              max={localDateStr()}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(e.target.value);
                setAddedCount(0);
                if (phase !== 'notice') setPhase('loading');
              }}
              className={FIELD}
            />
          </label>
          {headerEnd}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">{body}</div>

      {footer}
    </>
  );
};
