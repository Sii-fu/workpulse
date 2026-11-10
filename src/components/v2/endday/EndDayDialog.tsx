import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Check, Minus, X } from 'lucide-react';
import type { AppSettings, BacklogTask, Project, WorkdayRecord, WorkLog } from '../../../types';
import { ModalShell } from '../../ui/ModalShell';
import { IconButton } from '../../ui/IconButton';
import { ActivitySuggestionsPanel } from '../../activity/ActivitySuggestionsDialog';
import { EodPanel, SynthesizedLogItem } from '../../EodSynthesizerModal';
import { TaskClock } from '../../tasks/Clock';
import { LogRow } from '../today/LogRow';
import { TodayActivityProps, sameActivityProps } from '../today/TodayScreen';
import { useNow } from '../useNow';
import { checkedToday, pendingCount, subscribeActivitySession } from '../../../utils/activity/sessionStore';
import { DEFAULT_WORKDAY_HOURS, clockState, formatHm } from '../../../utils/workday';
import { unsyncedLogs } from '../../../utils/syncStatus';
import { isDoneUnlogged } from '../../../utils/taskLogging';
import { isRunningTask, sameTasksIgnoringLiveTime } from '../../../utils/timerStore';
import { plainSheetMessage } from '../../../utils/aiErrors';
import { localTimeStr, parseLocalDate } from '../../../utils/dates';
import { StepEmpty, StepId, StepStatus, nextOpenStep, prevOpenStep, stepAfterDoneTasks, stepStatus } from '../../../utils/endDaySteps';

export interface EndDayDialogProps {
  isOpen: boolean;
  /** The step to open on (the next action "Log N done tasks" opens on 'tasks'). Absent: the first step with something to do. */
  initialStep?: StepId;
  onClose(): void;
  /** Local YYYY-MM-DD. */
  today: string;
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  settings: AppSettings;
  /** The office-clock record to end: today's, else an earlier day still open (past midnight). Absent when none. */
  workday?: WorkdayRecord;
  /** Local YYYY-MM-DD of `workday`. */
  workdayDate?: string;
  activityProps: TodayActivityProps;
  /** Step 2: adds the synthesized logs (and marks the tasks' time as logged). */
  onConfirmEodPush(items: SynthesizedLogItem[]): Promise<void>;
  onEditLog(log: WorkLog): void;
  onDeleteLog(id: string): void;
  /** Step 4: sends the unsynced logs to the Sheet. */
  onSync(): Promise<void>;
  onPauseTask(id: string): void;
  onClockOut(): void;
  onOpenImage(base64: string): void;
}

const STEPS: { id: StepId; label: string; title: string }[] = [
  { id: 'activity', label: 'Activity', title: 'From your activity' },
  { id: 'tasks', label: 'Done tasks', title: 'Done tasks' },
  { id: 'log', label: "Today's log", title: "Today's log" },
  { id: 'sync', label: 'Sync', title: 'Sync to the Sheet' },
  { id: 'clock', label: 'Clock out', title: 'Clock out' },
];

const BODY = 'text-[length:var(--fs-body)]';
const MUTED = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';
const FOOT_BTN = 'v2-btn min-h-11 px-4 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default';
const TEXT_BTN =
  'min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;


const NothingHere: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="v2-panel v2-inset py-[var(--row-pad)]">
    <p className={`${BODY} font-semibold`}>Nothing here</p>
    {children && <p className={`mt-1 ${MUTED}`}>{children}</p>}
  </div>
);

/** End my day: a full-height dialog that walks through activity, done tasks, the day's log, sync and clock-out. */
const EndDayDialogView: React.FC<EndDayDialogProps> = ({ isOpen, ...rest }) => (isOpen ? <EndDayBody {...rest} /> : null);

// Mounted fresh on each open: the done-task snapshot and the step marks start over.
const EndDayBody: React.FC<Omit<EndDayDialogProps, 'isOpen'>> = ({
  initialStep,
  onClose,
  today,
  logs,
  backlog,
  projects,
  settings,
  workday,
  workdayDate,
  activityProps,
  onConfirmEodPush,
  onEditLog,
  onDeleteLog,
  onSync,
  onPauseTask,
  onClockOut,
  onOpenImage,
}) => {
  const id = useId();
  const titleId = `${id}-title`;

  // Step 2 works on the done tasks as they were when the dialog opened.
  const [snapshot] = useState(() => backlog.filter(isDoneUnlogged));
  const [marks, setMarks] = useState<Partial<Record<StepId, StepStatus>>>({});
  const [tasksAdded, setTasksAdded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const pending = useSyncExternalStore(subscribeActivitySession, () => pendingCount(today));
  const checked = useSyncExternalStore(subscribeActivitySession, () => checkedToday(today));

  const byId = new Map(projects.map((p) => [p.id, p]));
  const todayLogs = logs.filter((l) => l.date === today).sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  const dayMinutes = todayLogs.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);
  const sheetUrl = settings.googleScriptUrl;
  const unsynced = sheetUrl ? unsyncedLogs(logs, settings.syncTrackingSince).length : 0;
  const running = backlog.filter(isRunningTask);

  const empty: StepEmpty = {
    activity: activityProps.folders.length === 0,
    tasks: snapshot.length === 0,
    log: todayLogs.length === 0,
    sync: !sheetUrl || unsynced === 0,
    clock: false,
  };
  const statusOf = (s: StepId): StepStatus =>
    stepStatus(s, empty, marks, (s === 'activity' && checked && pending === 0) || (s === 'tasks' && tasksAdded));

  const [current, setCurrent] = useState(() => {
    const asked = initialStep ? STEPS.findIndex((s) => s.id === initialStep) : -1;
    return asked >= 0 ? asked : nextOpenStep(empty, 0);
  });
  const [visited, setVisited] = useState<Set<number>>(() => new Set([current]));
  const step = STEPS[current];

  const go = (i: number) => {
    setCurrent(i);
    setVisited((v) => (v.has(i) ? v : new Set(v).add(i)));
  };
  const prevOpen = prevOpenStep(empty, current);
  const leave = (mark: StepStatus) => {
    if (statusOf(step.id) === 'todo') setMarks((m) => ({ ...m, [step.id]: mark }));
    go(nextOpenStep(empty, current + 1));
  };

  // Move focus to the step's heading on each change, so the new step is announced.
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRefs.current[current]?.focus();
  }, [current]);

  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await onSync();
      setSynced(true);
    } catch (e: any) {
      setSyncError(plainSheetMessage(e?.message));
    } finally {
      setSyncing(false);
    }
  };

  // Step 5
  const hours = settings.workdayHours ?? DEFAULT_WORKDAY_HOURS;
  const clockedIn = !!workday && !workday.clockOut;
  const clockOutNow = () => {
    running.forEach((t) => onPauseTask(t.id));
    onClockOut();
    onClose();
  };

  const sourceNames = [activityProps.sources.git && 'git', activityProps.sources.claude && 'Claude Code'].filter(Boolean).join(' + ');

  const renderStep = (s: StepId): React.ReactNode => {
    switch (s) {
      case 'activity':
        return empty.activity ? (
          <NothingHere>
            No activity folders are set up, so there is nothing to read.{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                activityProps.onOpenSettings();
              }}
              className={TEXT_BTN}
            >
              Set up in Settings
            </button>
          </NothingHere>
        ) : (
          <div className="v2-panel v2-inset py-[var(--row-pad)]">
            <ActivitySuggestionsPanel {...activityProps} logs={logs} backlog={backlog} projects={projects} date={today} compact />
          </div>
        );
      case 'tasks':
        if (empty.tasks) return <NothingHere>No done task has time waiting to be logged.</NothingHere>;
        if (tasksAdded)
          return (
            <div className="v2-panel v2-inset py-[var(--row-pad)]">
              <p className={`${BODY} font-semibold`}>Added to today's log.</p>
              <p className={`mt-1 ${MUTED}`}>You can check the new entries in the next step.</p>
            </div>
          );
        // No panel around it: the panel's log items are the cards (no nested cards).
        return (
          <div>
            <EodPanel
              embedded
              tasksSnapshot={snapshot}
              isCustomSelection
              projects={projects}
              geminiApiKey={settings.geminiApiKey}
              hasGoogleSheetLinked={!!sheetUrl}
              onConfirmAndPush={onConfirmEodPush}
              onDone={() => {
                setTasksAdded(true);
                // Not nextOpenStep(empty, …): this closure's `empty` predates the logs just added.
                go(stepAfterDoneTasks());
              }}
            />
          </div>
        );
      case 'log':
        return empty.log ? (
          <NothingHere>No logs today.</NothingHere>
        ) : (
          <div className="v2-panel">
            <ul>
              {todayLogs.map((l) => (
                <LogRow key={l.id} log={l} project={byId.get(l.projectId)} onEdit={onEditLog} onDelete={onDeleteLog} onOpenImage={onOpenImage} />
              ))}
            </ul>
          </div>
        );
      case 'sync':
        if (!sheetUrl)
          return (
            <div className="v2-panel v2-inset py-[var(--row-pad)]">
              <p className={BODY}>No Google Sheet connected. Your logs are saved on this computer.</p>
            </div>
          );
        if (unsynced === 0)
          return synced ? (
            <div className="v2-panel v2-inset py-[var(--row-pad)]">
              <p className={`${BODY} font-semibold`}>Sent. Every log is in the Sheet.</p>
            </div>
          ) : (
            <NothingHere>Every log is already in the Sheet.</NothingHere>
          );
        return (
          <div className="v2-panel v2-inset py-[var(--row-pad)] space-y-3">
            <p className={BODY}>
              <span className="num font-semibold">{unsynced}</span> {unsynced === 1 ? 'log is' : 'logs are'} not in the Sheet yet.
            </p>
            <button type="button" onClick={sync} disabled={syncing} className={`${FOOT_BTN} v2-btn-strong`}>
              {syncing ? 'Syncing…' : `Sync ${plural(unsynced, 'log', 'logs')}`}
            </button>
            {syncError && (
              <p role="alert" className="text-[length:var(--fs-small)] text-danger">
                {syncError}
              </p>
            )}
          </div>
        );
      case 'clock':
        return <ClockOutStep workday={workday} earlierDate={workdayDate !== today ? workdayDate : undefined} hours={hours} running={running} byId={byId} />;
    }
  };

  const headMeta = (s: StepId): React.ReactNode => {
    if (s === 'activity' && !empty.activity)
      return (
        <>
          {sourceNames}
          {sourceNames && checked && ' · '}
          {checked && <span className="num">{pending} new</span>}
        </>
      );
    if (s === 'tasks' && !empty.tasks) return <span className="num">{plural(snapshot.length, 'task', 'tasks')}</span>;
    if (s === 'log')
      return (
        <span className="num">
          {plural(todayLogs.length, 'entry', 'entries')} · {formatHm(dayMinutes * 60)}
          <span className="sr-only"> logged</span>
        </span>
      );
    return null;
  };

  const isLast = current === STEPS.length - 1;
  const primary = isLast
    ? clockedIn
      ? { label: running.length > 0 ? 'Pause and clock out' : 'Clock out', run: clockOutNow }
      : { label: 'Finish', run: onClose }
    : { label: 'Next', run: () => leave('done') };

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="p-0 sm:p-4"
      className="w-full max-w-5xl h-[100dvh] sm:h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] sm:border border-[var(--border-app)] sm:rounded-[var(--radius-card)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[var(--border-app)] shrink-0">
        <h2 id={titleId} className="font-[family-name:var(--font-display)] text-[length:var(--fs-body)] font-bold uppercase tracking-[0.08em]">
          End my day
        </h2>
        <IconButton label="Close" onClick={onClose}>
          <X className="w-5 h-5" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <nav aria-label="Steps" className="shrink-0 md:w-56 px-2 py-2 md:px-3 md:py-4 border-b md:border-b-0 md:border-r border-[var(--border-app)]">
          <ol className="grid grid-cols-5 md:grid-cols-1 gap-1">
            {STEPS.map((s, i) => {
              const status = statusOf(s.id);
              const active = i === current;
              const note = empty[s.id] && !(s.id === 'sync' && synced) ? 'Nothing here' : status === 'done' ? 'Done' : status === 'skipped' ? 'Skipped' : '';
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={active ? 'step' : undefined}
                    onClick={() => go(i)}
                    className={`w-full h-full min-h-11 flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-3 px-1 md:px-3 py-2 rounded-[var(--radius-btn)] text-center md:text-left cursor-pointer transition-colors ${
                      active ? 'bg-[var(--bg-surface)] ring-1 ring-[var(--border-control)]' : 'hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`num shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[length:var(--fs-small)] font-bold border ${
                        status === 'done'
                          ? 'bg-[var(--text-main)] border-[var(--text-main)] text-[var(--bg-surface)]'
                          : active
                            ? 'border-[var(--text-main)] text-[var(--text-main)]'
                            : 'border-[var(--border-control)] text-[var(--text-muted)]'
                      }`}
                    >
                      {status === 'done' ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : status === 'skipped' ? <Minus className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[length:var(--fs-small)] md:text-[length:var(--fs-body)] leading-tight ${active ? 'font-bold' : 'font-medium text-[var(--text-muted)]'}`}>
                        <span className="sr-only">Step {i + 1}: </span>
                        {s.label}
                      </span>
                      {note && (
                        <span className="sr-only md:not-sr-only md:block text-[length:var(--fs-small)] text-[var(--text-muted)]">
                          <span className="md:hidden">, </span>
                          {note}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5">
          {STEPS.map((s, i) =>
            visited.has(i) ? (
              <section key={s.id} hidden={i !== current} aria-labelledby={`${id}-${s.id}`} className="max-w-3xl">
                <h3
                  id={`${id}-${s.id}`}
                  ref={(el) => {
                    headingRefs.current[i] = el;
                  }}
                  tabIndex={-1}
                  className="v2-head outline-none"
                >
                  <span>{s.title}</span>
                  {headMeta(s.id) && <span className="v2-head-meta">{headMeta(s.id)}</span>}
                </h3>
                {renderStep(s.id)}
              </section>
            ) : null,
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-[var(--border-app)] shrink-0">
        <button type="button" onClick={() => go(prevOpen)} disabled={prevOpen < 0} className={FOOT_BTN}>
          Back
        </button>
        <div className="flex items-center gap-2">
          {!(isLast && !clockedIn) && (
            <button type="button" onClick={isLast ? onClose : () => leave('skipped')} className={FOOT_BTN}>
              Skip
            </button>
          )}
          <button type="button" onClick={primary.run} className={`${FOOT_BTN} v2-btn-strong`}>
            {primary.label}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

/** Step 5: worked time against the target, and the timers still running. */
const ClockOutStep: React.FC<{
  workday?: WorkdayRecord;
  /** Set when the workday began on an earlier date (still open past midnight). */
  earlierDate?: string;
  hours: number;
  running: BacklogTask[];
  byId: Map<string, Project>;
}> = ({ workday, earlierDate, hours, running, byId }) => {
  const now = useNow(30_000);
  if (!workday)
    return (
      <div className="v2-panel v2-inset py-[var(--row-pad)]">
        <p className={BODY}>You did not clock in today, so there is nothing to clock out.</p>
      </div>
    );

  const c = clockState(workday, hours, now);
  const out = c.phase === 'out';
  const rest = out
    ? `You clocked out at ${localTimeStr(new Date(workday.clockOut as string))}.`
    : c.overSec > 0
      ? `${formatHm(c.overSec)} over the target.`
      : c.leftSec > 0
        ? `${formatHm(c.leftSec)} to go.`
        : 'Target reached.';

  return (
    <div className="space-y-6">
      <div className="v2-panel v2-inset py-[var(--row-pad)]">
        <dl className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <div>
            <dt className={MUTED}>Worked</dt>
            <dd className="num text-[length:var(--fs-num)] font-bold leading-none">{formatHm(c.workedSec)}</dd>
          </div>
          <div>
            <dt className={MUTED}>Target</dt>
            <dd className="num text-[length:var(--fs-num)] font-bold leading-none text-[var(--text-muted)]">{formatHm(hours * 3600)}</dd>
          </div>
        </dl>
        <p className={`mt-3 ${BODY}`}>
          In at {earlierDate && `${parseLocalDate(earlierDate).toLocaleDateString('en-US', { weekday: 'short' })} `}
          <span className="num">{localTimeStr(new Date(workday.clockIn))}</span>. {rest}
        </p>
      </div>

      {running.length > 0 && !out && (
        <section aria-label="Running timers">
          <p className={`flex items-start gap-2 mb-2 ${BODY}`}>
            <AlertTriangle className="w-4 h-4 mt-1 shrink-0 text-warning" aria-hidden="true" />
            <span>
              {running.length === 1 ? 'A timer is still running.' : `${running.length} timers are still running.`} Clocking out pauses{' '}
              {running.length === 1 ? 'it' : 'them'}.
            </span>
          </p>
          <ul className="v2-panel">
            {running.map((t) => {
              const p = byId.get(t.projectId);
              return (
                <li key={t.id} className="v2-row v2-inset flex items-center gap-3">
                  <span className="v2-ribbon self-stretch min-h-5" style={{ backgroundColor: p?.color ?? 'var(--border-control)' }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className={`block ${BODY} break-words`}>{t.title}</span>
                    {p && <span className={`block ${MUTED}`}>{p.name}</span>}
                  </span>
                  <span className={`num shrink-0 ${BODY} font-semibold`}>
                    <TaskClock task={t} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};

// Redraws only when something it shows changes: running clocks tick on their own (<TaskClock>).
const sameEndDayProps = (prev: EndDayDialogProps, next: EndDayDialogProps): boolean =>
  (Object.keys(next) as (keyof EndDayDialogProps)[]).every((k) => {
    if (k === 'backlog') return sameTasksIgnoringLiveTime(prev.backlog, next.backlog);
    if (k === 'activityProps') return sameActivityProps(prev.activityProps, next.activityProps);
    return prev[k] === next[k];
  });

export const EndDayDialog = React.memo(EndDayDialogView, sameEndDayProps);
