import React, { useState, useEffect } from 'react';
import { isEodCandidate, withUnloggedTime } from '../utils/taskLogging';
import { BacklogTask, Project, ThemeId, TaskStatus, TaskStage } from '../types';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Ban,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Send,
  Loader2,
  CheckSquare,
  Square,
  Flame,
  Terminal,
  FileText,
} from 'lucide-react';

export interface SynthesizedLogItem {
  id: string; // unique split ID e.g. `${projectId}_${status}`
  splitId?: string;
  projectId: string;
  projectName: string;
  projectColor?: string;
  status: TaskStatus;
  durationMinutes: number;
  summaryBullets: string;
  tags: string[];
  taskIds: string[];
  underlyingTasks: {
    id: string;
    title: string;
    stage: TaskStage;
    elapsedSeconds: number;
    excluded?: boolean;
  }[];
}

interface EodSynthesizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasksSnapshot?: BacklogTask[];
  isCustomSelection?: boolean;
  backlog?: BacklogTask[];
  projects: Project[];
  activeTheme: ThemeId;
  geminiApiKey: string;
  hasGoogleSheetLinked: boolean;
  onConfirmAndPush: (items: SynthesizedLogItem[]) => Promise<void>;
}

function formatDurationSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export const EodSynthesizerModal: React.FC<EodSynthesizerModalProps> = ({
  isOpen,
  onClose,
  tasksSnapshot,
  isCustomSelection = false,
  backlog,
  projects,
  activeTheme,
  geminiApiKey,
  hasGoogleSheetLinked,
  onConfirmAndPush,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [synthesizedItems, setSynthesizedItems] = useState<SynthesizedLogItem[]>([]);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [expandedMicroTasks, setExpandedMicroTasks] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [activeModelName, setActiveModelName] = useState<string>('GEMINI 3.5 FLASH');

  const isMatrix = activeTheme === 'matrix';
  const isMinimalist = activeTheme === 'minimalist';
  const isCompact = activeTheme === 'compact';

  // Static snapshot reference to prevent 1-second timer intervals from re-triggering API calls
  const tasksSource = tasksSnapshot || backlog || [];
  const frozenTasksRef = React.useRef<BacklogTask[]>([]);
  const hasRunRef = React.useRef(false);

  const runSynthesis = async (tasksToUse: BacklogTask[]) => {
    setIsLoading(true);
    setErrorMsg(null);
    setAiWarning(null);
    // Never keep results from an earlier run: they could be pushed a second time (B4).
    setSynthesizedItems([]);
    setSelectedLogIds(new Set());

    const todayStr = new Date().toISOString().split('T')[0];

    // Scoping (see isEodCandidate): fully logged tasks are never offered again; tasks with new
    // time since their last log are.
    const candidateTasks = tasksToUse.filter((t) => isEodCandidate(t, todayStr, isCustomSelection));

    if (candidateTasks.length === 0) {
      setIsLoading(false);
      setErrorMsg(
        isCustomSelection
          ? 'Selected tasks have no new time to log (tasks that were already logged are skipped).'
          : 'All tasks for today have already been logged to Google Sheet! Only new, unsent tasks with activity will be included in subsequent syntheses.'
      );
      return;
    }

    try {
      const resp = await fetch('/api/synthesize-eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: candidateTasks.map(withUnloggedTime),
          projects,
          date: todayStr,
          customApiKey: geminiApiKey,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Failed with status ${resp.status}`);
      }

      const data = await resp.json();
      const logs: SynthesizedLogItem[] = (data.synthesizedLogs || []).map((item: any) => ({
        ...item,
        id: item.id || item.splitId || `${item.projectId}_${item.status}`,
      }));

      setSynthesizedItems(logs);
      setSelectedLogIds(new Set(logs.map((l) => l.id)));

      if (data.modelUsed) {
        setActiveModelName(data.modelUsed.toUpperCase());
      } else {
        setActiveModelName('GEMINI 3.5 CASCADE');
      }

      if (data.apiError || data.apiKeyMissing) {
        setAiWarning(data.notice || 'AI synthesis unavailable. Formatted via status-separated fallback.');
        setAiNote(null);
      } else if (data.notice) {
        setAiNote(data.notice);
      } else if (data.isAIGenerated) {
        setAiNote(`Synthesized via ${data.modelUsed || 'Gemini 3.5 Flash'} into status-separated project timesheets.`);
      }
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setErrorMsg(err.message || 'Error communicating with AI synthesis service');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger synthesis strictly ONCE per modal opening session
  useEffect(() => {
    if (!isOpen) {
      hasRunRef.current = false;
      setIsLoading(false);
      return;
    }

    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // Freeze snapshot at opening time
    frozenTasksRef.current = [...tasksSource];
    runSynthesis(frozenTasksRef.current);
  }, [isOpen]);

  const handleManualResynthesize = () => {
    const tasksToUse = frozenTasksRef.current.length > 0 ? frozenTasksRef.current : tasksSource;
    runSynthesis(tasksToUse);
  };

  if (!isOpen) return null;

  const toggleSelectLog = (logId: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const toggleExpandMicroTasks = (logId: string) => {
    setExpandedMicroTasks((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const handleToggleUnderlyingTask = (logId: string, taskId: string) => {
    setSynthesizedItems((prev) =>
      prev.map((item) => {
        if (item.id !== logId) return item;
        const updatedTasks = item.underlyingTasks.map((t) =>
          t.id === taskId ? { ...t, excluded: !t.excluded } : t
        );
        const activeTasks = updatedTasks.filter((t) => !t.excluded);
        const newTotalSecs = activeTasks.reduce((acc, t) => acc + (t.elapsedSeconds || 0), 0);
        const newDuration = Math.max(15, Math.round(newTotalSecs / 60) || activeTasks.length * 20);

        if (activeTasks.length === 0) {
          setSelectedLogIds((s) => {
            const next = new Set(s);
            next.delete(logId);
            return next;
          });
        }

        return {
          ...item,
          underlyingTasks: updatedTasks,
          taskIds: activeTasks.map((t) => t.id),
          durationMinutes: newDuration,
        };
      })
    );
  };

  const handleUpdateItem = (logId: string, field: keyof SynthesizedLogItem, val: any) => {
    setSynthesizedItems((prev) =>
      prev.map((item) => (item.id === logId ? { ...item, [field]: val } : item))
    );
  };

  const handleConfirm = async () => {
    const toPush = synthesizedItems
      .filter((item) => selectedLogIds.has(item.id))
      .map((item) => {
        const activeTasks = item.underlyingTasks.filter((t) => !t.excluded);
        return {
          ...item,
          taskIds: activeTasks.map((t) => t.id),
          underlyingTasks: activeTasks,
        };
      })
      .filter((item) => item.taskIds.length > 0);

    if (toPush.length === 0) {
      alert('Please select at least one synthesized log entry with active tasks.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirmAndPush(toPush);
      onClose();
    } catch (e: any) {
      alert(e?.message || 'Failed to push logs');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[var(--radius-card)] border overflow-hidden shadow-2xl transition-all ${
          isMatrix
            ? 'bg-black border-[#00ff66] text-[#00ff66] font-mono shadow-[0_0_30px_rgba(0,255,102,0.2)]'
            : isMinimalist
            ? 'bg-[#FBFBFA] dark:bg-[#191919] border-[#E3E2DE] dark:border-[#333] text-[var(--text-main)]'
            : 'bg-[var(--bg-surface-elevated)] border-[var(--border-app)] text-[var(--text-main)] shadow-indigo-500/10'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-app)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
              {isMatrix ? <Terminal className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>End-of-Day (EOD) AI Log Synthesizer</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">
                  {activeModelName}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Splits logs by Project × Status (Completed deliverables, Blockers & Active Focus)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualResynthesize}
              disabled={isLoading}
              className="px-2.5 py-1 text-xs font-medium rounded-[var(--radius-btn)] border border-[var(--border-app)] hover:border-[var(--text-main)] bg-[var(--bg-subtle)] text-[var(--text-main)] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Re-run synthesis"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              <span className="hidden sm:inline">Re-synthesize</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Review Console */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto text-[var(--accent)] animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Synthesizing status-separated timesheet logs...</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Splitting by Project × Stage, calculating times, and writing professional executive summaries.
                </p>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="p-6 text-center space-y-3 border border-rose-500/30 bg-rose-500/10 rounded-[var(--radius-card)]">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-400">{errorMsg}</p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-subtle-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : synthesizedItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] font-mono">
              No project items generated.
            </div>
          ) : (
            <>
              {aiWarning && (
                <div className="p-3.5 rounded-[var(--radius-card)] bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="leading-relaxed">{aiWarning}</span>
                  </div>
                  <button
                    onClick={() => setAiWarning(null)}
                    className="p-1 hover:text-white rounded hover:bg-amber-500/20 transition-colors cursor-pointer shrink-0"
                    title="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {aiNote && (
                <div className="p-3 rounded-[var(--radius-btn)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-xs text-[var(--text-main)] flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    <span>{aiNote}</span>
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {selectedLogIds.size} of {synthesizedItems.length} status-split logs selected
                  </span>
                </div>
              )}

              {/* List of Status-Separated Project Logs */}
              <div className="space-y-4">
                {synthesizedItems.map((item) => {
                  const isSelected = selectedLogIds.has(item.id);
                  const isExpanded = expandedMicroTasks.has(item.id);
                  const activeTasks = item.underlyingTasks.filter((t) => !t.excluded);

                  const textareaThemeClass = isMatrix
                    ? 'bg-black border-[#00ff66]/50 text-[#00ff66] font-mono focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]/30'
                    : isMinimalist
                    ? 'bg-white dark:bg-[#1f1f1f] border-[#E3E2DE] dark:border-[#333] text-[var(--text-main)] font-sans focus:border-[#888] shadow-xs'
                    : isCompact
                    ? 'bg-[var(--bg-subtle)] border-[var(--border-app)] text-[var(--text-main)] font-mono text-xs focus:border-[var(--accent)]'
                    : 'bg-[var(--bg-surface-elevated)] border-white/10 text-[var(--text-main)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-md shadow-inner';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-[var(--radius-card)] border transition-all space-y-3 ${
                        isSelected
                          ? isMatrix
                            ? 'border-[#00ff66] bg-[#060e07]'
                            : item.status === 'blocked'
                            ? 'border-rose-500/70 bg-rose-500/5 ring-1 ring-rose-500/20 shadow-md'
                            : item.status === 'in_progress'
                            ? 'border-amber-500/70 bg-amber-500/5 ring-1 ring-amber-500/20 shadow-md'
                            : 'border-[var(--accent)]/80 bg-[var(--bg-surface)] ring-1 ring-[var(--accent)]/30 shadow-md'
                          : 'border-[var(--border-app)] bg-[var(--bg-subtle)]/40 opacity-60'
                      }`}
                    >
                      {/* Project & Status Split Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--border-app)]">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleSelectLog(item.id)}
                            className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>

                          <div className="flex items-center gap-2 font-bold text-sm">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: item.projectColor || '#6366f1' }}
                            />
                            <span>{item.projectName}</span>
                          </div>

                          {/* Distinct Status Pill */}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                              item.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : item.status === 'blocked'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>

                          <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            ({activeTasks.length} of {item.underlyingTasks.length} tasks included)
                          </span>
                        </div>

                        {/* Status & Duration Controls */}
                        <div className="flex items-center gap-2 text-xs">
                          {/* Fine-tune Status Picker */}
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'status', e.target.value as TaskStatus)
                            }
                            className="px-2.5 py-1 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] text-xs text-[var(--text-main)] font-semibold cursor-pointer"
                          >
                            <option value="completed">Completed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                          </select>

                          {/* Duration Input */}
                          <div className="flex items-center gap-1 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] px-2 py-1">
                            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <input
                              type="number"
                              min={5}
                              max={720}
                              value={item.durationMinutes}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.id,
                                  'durationMinutes',
                                  Math.max(5, parseInt(e.target.value) || 0)
                                )
                              }
                              className="w-12 text-xs font-mono font-bold bg-transparent text-[var(--text-main)] focus:outline-hidden"
                            />
                            <span className="text-[11px] text-[var(--text-muted)]">mins</span>
                          </div>
                        </div>
                      </div>

                      {/* Editable Synthesized Bullets */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--text-muted)] flex items-center justify-between">
                          <span>Synthesized Timesheet Description (Markdown Bullets):</span>
                          <span className="text-[10px] font-mono font-normal">Editable</span>
                        </label>
                        <textarea
                          rows={Math.max(3, item.summaryBullets.split('\n').length)}
                          value={item.summaryBullets}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'summaryBullets', e.target.value)
                          }
                          className={`w-full text-sm leading-relaxed p-3.5 rounded-[var(--radius-card)] border resize-y focus:outline-hidden transition-all ${textareaThemeClass}`}
                        />
                      </div>

                      {/* Interactive Micro-Tasks Checklist (Uncheck to Exclude) */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleExpandMicroTasks(item.id)}
                          className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>
                            {isExpanded ? 'Hide' : 'Review & Filter'} Underlying Micro-Tasks ({activeTasks.length}/{item.underlyingTasks.length})
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-2.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)]/70 border border-[var(--border-app)] space-y-2 animate-in fade-in duration-150">
                            <p className="text-[10px] text-[var(--text-muted)] font-mono">
                              Uncheck tasks below to exclude them from this timesheet entry and reduce logged duration:
                            </p>
                            <div className="space-y-1">
                              {item.underlyingTasks.map((t) => (
                                <div
                                  key={t.id}
                                  onClick={() => handleToggleUnderlyingTask(item.id, t.id)}
                                  className={`flex items-center justify-between gap-2 text-xs py-1 px-2 rounded cursor-pointer transition-colors ${
                                    t.excluded
                                      ? 'bg-rose-500/5 opacity-50 line-through text-[var(--text-muted)]'
                                      : 'hover:bg-[var(--bg-subtle)] text-[var(--text-main)]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {t.excluded ? (
                                      <Square className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                    ) : (
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    )}
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0 ${
                                        t.stage === 'done'
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : t.stage === 'in_progress'
                                          ? 'bg-amber-500/20 text-amber-400'
                                          : t.stage === 'blocked'
                                          ? 'bg-rose-500/20 text-rose-400'
                                          : 'bg-blue-500/20 text-blue-400'
                                      }`}
                                    >
                                      {t.stage}
                                    </span>
                                    <span className="truncate">{t.title}</span>
                                  </div>

                                  <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0">
                                    {formatDurationSeconds(t.elapsedSeconds)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer / Commit Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-app)] bg-[var(--bg-subtle)]/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[var(--text-muted)] font-mono">
            {hasGoogleSheetLinked ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Google Sheet endpoint linked & ready</span>
              </span>
            ) : (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Offline mode (logs will be recorded to local timeline)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || isLoading || !!errorMsg || selectedLogIds.size === 0}
              className="px-5 py-2 text-xs font-bold rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-md shadow-[var(--accent-glow)] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing to Google Sheet...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>🚀 Confirm & Push to Google Sheet ({selectedLogIds.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
