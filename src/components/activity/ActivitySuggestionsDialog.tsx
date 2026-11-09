import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles, X } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { IconButton } from '../ui/IconButton';
import { localDateStr } from '../../utils/dates';
import { describeSources, loadSuggestions, noticeSignature, PipelineResult } from '../../utils/activity/pipeline';
import { suggestionToLogData, trackedMinutesFor } from '../../utils/activity/suggestions';
import { formatEstimate, formatMinutes } from '../../utils/activity/time';
import type { BacklogTask, Project, WorkLog } from '../../types';
import type { ActivityAi, ActivityFolder, ActivitySources, Suggestion } from '../../utils/activity/types';

interface ActivitySuggestionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
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
}

interface Row {
  suggestion: Suggestion;
  checked: boolean;
  text: string;
  projectId: string;
  minutes: string;
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

// 'idle' is the closed state: nothing is read until the dialog has decided between 'notice' (first
// use, or a new source was switched on) and 'loading'.
type Phase = 'idle' | 'notice' | 'loading' | 'ready' | 'error';

export const ActivitySuggestionsDialog: React.FC<ActivitySuggestionsDialogProps> = ({
  isOpen,
  onClose,
  logs,
  backlog,
  projects,
  folders,
  sources,
  ai,
  geminiApiKey,
  onAddLogs,
  onOpenSettings,
}) => {
  const [date, setDate] = useState(localDateStr());
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [addedCount, setAddedCount] = useState(0);
  const [runId, setRunId] = useState(0);

  const signature = noticeSignature(sources, ai);
  const hasSetup = folders.length > 0 && (sources.claude || sources.git);
  const activeProjects = projects.filter((p) => !p.isArchived);

  // The scan reads the latest logs and tasks without re-running whenever they change
  // (adding logs from this dialog changes them).
  const latest = useRef({ logs, backlog, projects, folders, sources, geminiApiKey, ai });
  latest.current = { logs, backlog, projects, folders, sources, geminiApiKey, ai };

  // Only the newest scan may write its result: a slower, older one (date changed twice) is dropped.
  const scanSeq = useRef(0);

  // Fresh start each time the dialog opens. Closing goes back to 'idle' and drops any scan still
  // running, so a reopened dialog can never act on a stale phase before the notice is decided.
  useEffect(() => {
    if (!isOpen) {
      scanSeq.current++;
      setPhase('idle');
      return;
    }
    setDate(localDateStr());
    setAddedCount(0);
    setResult(null);
    setRows([]);
    setPhase(readAck() === signature ? 'loading' : 'notice');
    setRunId((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const run = useCallback(async (forDate: string) => {
    const seq = ++scanSeq.current;
    setError('');
    try {
      const l = latest.current;
      const r = await loadSuggestions({ date: forDate, folders: l.folders, sources: l.sources, projects: l.projects, logs: l.logs, backlog: l.backlog, geminiApiKey: l.geminiApiKey, ai: l.ai });
      if (seq !== scanSeq.current) return;
      setResult(r);
      setRows(
        r.suggestions.map((s) => ({ suggestion: s, checked: false, text: s.text, projectId: s.projectId, minutes: String(s.minutes) })),
      );
      setPhase('ready');
    } catch (err) {
      if (seq !== scanSeq.current) return;
      setError(err instanceof Error ? err.message : 'Reading your activity failed.');
      setPhase('error');
    }
  }, []);

  // Runs whenever the dialog is loading: on open, on a different day, on retry, and once the
  // notice is accepted.
  useEffect(() => {
    if (isOpen && hasSetup && phase === 'loading') void run(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasSetup, date, runId, phase === 'loading']);

  if (!isOpen) return null;

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
        return suggestionToLogData(r.suggestion, date, minutes, r.text.trim(), r.projectId, name);
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

  const sourceLines = result ? describeSources(sources, result.status) : [];

  return (
    <ModalShell
      onClose={onClose}
      labelledBy="activity-title"
      backdropClassName="p-3 sm:p-4"
      className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[var(--radius-card)] border overflow-hidden shadow-2xl bg-[var(--bg-surface-elevated)] border-[var(--border-app)] text-[var(--text-main)]"
    >
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border-app)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/30">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="activity-title" className="text-base sm:text-lg font-bold">Suggest logs from my activity</h2>
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
            <IconButton label="Close" onClick={onClose}>
              <X className="w-5 h-5" />
            </IconButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!hasSetup ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-semibold">
                {folders.length === 0 ? 'Choose the folders to read first.' : 'Turn on at least one source first.'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Suggestions come from the folders you list in Settings. Nothing else on this computer is read.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Open Settings
              </button>
            </div>
          ) : phase === 'notice' ? (
            <div className="py-8 max-w-lg mx-auto space-y-4">
              <h3 className="text-sm font-bold">Before the first scan</h3>
              <ul className="text-xs text-[var(--text-muted)] space-y-1.5 list-disc pl-5">
                {ai === 'none' ? (
                  <li>Nothing is sent anywhere: the log text is written on this computer from your commits and prompts.</li>
                ) : (
                  <>
                    {sources.git && <li>The subjects of your git commits go to {ai === 'claude' ? 'Claude, through the Claude Code on this computer,' : 'Gemini'} so it can group them and write the log text.</li>}
                    {sources.claude && (
                      <li>
                        The first line of your Claude Code prompts, session titles and edited file names go to {ai === 'claude' ? 'Claude' : 'Gemini'} too.
                      </li>
                    )}
                    <li>Anything that looks like a key or password is hidden first.</li>
                  </>
                )}
                <li>File contents and command output never leave your computer.</li>
                {ai !== 'none' && <li>If the AI is not available, the text is written from the same material on this computer instead.</li>}
              </ul>
              <button
                type="button"
                onClick={acceptNotice}
                className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Continue
              </button>
            </div>
          ) : phase === 'loading' || phase === 'idle' ? (
            <div className="py-16 text-center space-y-3" role="status">
              <Loader2 className="w-9 h-9 mx-auto text-[var(--accent-text)] animate-spin" />
              <p className="text-sm font-semibold">Reading your activity...</p>
            </div>
          ) : phase === 'error' ? (
            <div className="p-6 text-center space-y-3 border border-danger/30 bg-danger/10 rounded-[var(--radius-card)]">
              <AlertTriangle className="w-8 h-8 text-danger mx-auto" />
              <p className="text-sm font-semibold text-danger">{error}</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('loading')}
                  className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--text-main)] text-[var(--bg-app)] hover:opacity-90 cursor-pointer"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
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
              {sourceLines.length > 0 && (
                <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
                  {sourceLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}

              {rows.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <p className="text-sm font-semibold">
                    {addedCount > 0 ? `Added ${addedCount} ${addedCount === 1 ? 'log' : 'logs'}. Nothing else is waiting.` : 'No new activity found for this day.'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {addedCount > 0 ? 'Close this window or pick another day.' : 'Pick another day, or check the folders and sources in Settings.'}
                  </p>
                </div>
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
                      const unchanged = Number(r.minutes) === s.minutes;
                      // Live, not frozen at scan time: counts logs added from this dialog and a changed project.
                      const tracked = trackedMinutesFor(date, r.projectId, logs, backlog);
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
                          <div className="flex flex-wrap items-center gap-2 pl-6">
                            <select
                              value={r.projectId}
                              onChange={(e) => update(s.key, { projectId: e.target.value })}
                              aria-label="Project"
                              className={FIELD}
                            >
                              {!activeProjects.some((p) => p.id === r.projectId) && (
                                <option value={r.projectId}>{s.projectName}</option>
                              )}
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
                            <p className="pl-6 text-xs text-warning">
                              You already have {formatMinutes(tracked)} tracked or logged for this project on this day.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        {hasSetup && phase === 'ready' && rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--border-app)] shrink-0">
            <span className="text-xs text-[var(--text-muted)]">{chosen.length} selected</span>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="px-5 py-2 text-xs sm:text-sm font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {chosen.length > 0 ? `Add ${chosen.length} selected` : 'Add selected'}
            </button>
          </div>
        )}
      </>
    </ModalShell>
  );
};
