import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { localDateStr, localTimeStr } from './utils/dates';
import {
  WorkLog,
  BacklogTask,
  Project,
  AppSettings,
  ThemeId,
  AppNavTab,
  ToastMessage,
  TaskStage,
  BackupData,
  Workdays,
} from './types';
import {
  loadStoredData,
  saveLogs as storeLogs,
  saveBacklog as storeBacklog,
  saveProjects as storeProjects,
  saveTags as storeTags,
  saveSettings as storeSettings,
  saveWorkdays as storeWorkdays,
  replaceAllData,
  rollOverTasks,
  SaveResult,
} from './utils/storage';
import { buildBackup, downloadTextFile } from './utils/backup';
import { loggedSecondsOf, unloggedSeconds, isPendingTask, isDoneUnlogged } from './utils/taskLogging';
import { advanceClock } from './utils/timer';
import { startSegment, endSegment } from './utils/segments';
import { minutesFromSeconds } from './utils/duration';
import { unsyncedLogs } from './utils/syncStatus';
import { applyDateFixes, DateFix } from './utils/logDates';
import { getInitialSeedData, DEFAULT_SETTINGS } from './data/seedData';
import { syncSingleLogToSheet, syncBatchLogsToSheet } from './utils/sheetsSync';
import { normalizeTheme } from './utils/theme';
import {
  DEFAULT_WORKDAY_HOURS,
  clockIn,
  clockOut,
  clockState,
  openWorkdayBefore,
  resumeWorkday,
} from './utils/workday';
import { chooseNextAction } from './utils/nextAction';
import { checkedToday, pendingCount, subscribeActivitySession } from './utils/activity/sessionStore';
import { backupStatus } from './utils/backupReminder';
import { sampleCounts, withoutSampleData } from './data/sampleData';
import { plainSheetMessage } from './utils/aiErrors';
import { useStableCallback } from './hooks/useStableCallback';
import { publishTimers } from './utils/timerStore';
import { aiFromSettings, sourcesFromSettings } from './utils/activity/settings';
import type { ActivityFolder } from './utils/activity/types';

// Shell and screens
import { AppHeader } from './components/v2/AppHeader';
import { ClockBand } from './components/v2/ClockBand';
import { BottomNav } from './components/v2/BottomNav';
import { ClockInDialog } from './components/v2/ClockInDialog';
import { useNow } from './components/v2/useNow';
import { TodayScreen, TodayActivityProps } from './components/v2/today/TodayScreen';
import { TasksScreen } from './components/v2/tasks/TasksScreen';
import { HistoryScreen } from './components/v2/history/HistoryScreen';
import { SettingsView } from './components/SettingsView';
import { LogFormDialog, LogFormPrefill } from './components/v2/LogFormDialog';
import { EndDayDialog } from './components/v2/endday/EndDayDialog';
import type { StepId } from './utils/endDaySteps';

// Dialogs and notices kept from v1
import { AiStandupModal } from './components/AiStandupModal';
import { SearchPaletteModal } from './components/SearchPaletteModal';
import { LightboxModal } from './components/LightboxModal';
import { ToastContainer } from './components/ToastContainer';
import { SampleDataBanner } from './components/SampleDataBanner';
import { OfflineNotice } from './components/OfflineNotice';
import { BackupReminder } from './components/BackupReminder';
import { EodSynthesizerModal, SynthesizedLogItem } from './components/EodSynthesizerModal';
import { ActivitySuggestionsDialog } from './components/activity/ActivitySuggestionsDialog';

const NO_FOLDERS: ActivityFolder[] = [];
const noop = () => {};


export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [backlog, setBacklog] = useState<BacklogTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [workdays, setWorkdays] = useState<Workdays>({});

  const [activeTab, setActiveTab] = useState<AppNavTab>('today');

  // Dialogs
  const [isAiStandupOpen, setIsAiStandupOpen] = useState(false);
  const [isEodSynthesizerOpen, setIsEodSynthesizerOpen] = useState(false);
  const [eodTasksSnapshot, setEodTasksSnapshot] = useState<BacklogTask[]>([]);
  const [isEodCustomSelection, setIsEodCustomSelection] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isClockInOpen, setIsClockInOpen] = useState(false);
  // End my day: closed (null), or open on its first open step (undefined) or on a chosen step.
  const [endDay, setEndDay] = useState<{ step?: StepId } | null>(null);
  // The log form: closed (null), a new log (editing null, maybe prefilled) or an edit.
  const [logForm, setLogForm] = useState<{ editing: WorkLog | null; prefill: LogFormPrefill | null } | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Opens the EOD synthesizer with a frozen snapshot of tasks, so live timer ticks do not re-run it.
  // With ids, only those tasks (a selection on the Tasks screen).
  const handleOpenEodSynthesizer = (selectedTaskIds?: string[]) => {
    if (selectedTaskIds && selectedTaskIds.length > 0) {
      const selectedSet = new Set(selectedTaskIds);
      setEodTasksSnapshot(backlog.filter((t) => selectedSet.has(t.id)));
      setIsEodCustomSelection(true);
    } else {
      setEodTasksSnapshot([...backlog]);
      setIsEodCustomSelection(false);
    }
    setIsEodSynthesizerOpen(true);
  };

  // Logs selected on History (standup, export)
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  // A log picked in the search palette: History opens on its day and scrolls to it.
  const [historyFocus, setHistoryFocus] = useState<{ date: string; id: string } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  // "Later" on the backup reminder: hidden until the next visit, not remembered.
  const [backupReminderHidden, setBackupReminderHidden] = useState(false);

  const addToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    action?: ToastMessage['action'],
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    // Errors and anything with an action (Undo, Retry) stay 8 s; the toast itself dismisses on a
    // timer that hovering or focusing it pauses (see ToastContainer).
    setToasts((prev) => [...prev, { id, type, message, action, durationMs: action || type === 'error' ? 8000 : 3500 }]);
  };

  // Save wrappers: a failed save (storage full or blocked) shows one error toast per 30 s
  // instead of failing silently. Callers can still read the returned result.
  const lastSaveErrorAt = useRef(0);
  const persist = (result: SaveResult, what: string): SaveResult => {
    if (!result.ok && Date.now() - lastSaveErrorAt.current > 30000) {
      lastSaveErrorAt.current = Date.now();
      addToast(
        `Could not save ${what}: browser storage is full or blocked. Export a backup now (Settings).`,
        'error',
      );
    }
    return result;
  };
  const saveLogs = (v: WorkLog[]) => persist(storeLogs(v), 'work logs');
  const saveBacklog = (v: BacklogTask[]) => persist(storeBacklog(v), 'tasks');
  const saveProjects = (v: Project[]) => persist(storeProjects(v), 'projects');
  const saveTags = (v: string[]) => persist(storeTags(v), 'tags');
  const saveSettings = (v: AppSettings) => persist(storeSettings(v), 'settings');
  const saveWorkdays = (v: Workdays) => persist(storeWorkdays(v), 'the office clock');

  // Records that these logs reached the Google Sheet, so they are never sent twice (B2).
  const markLogsSynced = (ids: string[]) => {
    const at = new Date().toISOString();
    const idSet = new Set(ids);
    setLogs((prev) => {
      const next = prev.map((l) => (idSet.has(l.id) ? { ...l, syncedAt: at } : l));
      saveLogs(next);
      return next;
    });
  };

  // Shows why a sync failed instead of failing silently (U2).
  // `retry` makes the toast carry a Retry button, so a failed sync is one click from trying again.
  const reportSyncFailure = (message: string, retry?: () => void) =>
    addToast(
      `Google Sheet sync failed. ${plainSheetMessage(message)} Your logs are saved here.`,
      'error',
      retry ? { label: 'Retry', onClick: retry } : undefined,
    );

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial load from localStorage (the loader maps old theme ids and rolls tasks over).
  useEffect(() => {
    const loaded = loadStoredData();
    setLogs(loaded.logs);
    setBacklog(loaded.backlog);
    setProjects(loaded.projects);
    setTags(loaded.tags);
    setWorkdays(loaded.workdays);
    if (loaded.warnings.length > 0) {
      addToast(loaded.warnings.join(' '), 'error');
    }

    // Sync tracking starts now for users who already have a sheet: older logs are not re-sent.
    const syncTrackingSince =
      loaded.settings.googleScriptUrl && !loaded.settings.syncTrackingSince
        ? new Date().toISOString()
        : loaded.settings.syncTrackingSince;
    if (syncTrackingSince !== loaded.settings.syncTrackingSince) {
      storeSettings({ ...loaded.settings, syncTrackingSince });
    }
    setSettings({ ...loaded.settings, syncTrackingSince });
    setDataLoaded(true);
  }, []);

  // 2. The theme lives on <html>. Wait for the saved settings: index.html already applied them
  // before first paint, and the initial state here is only the default.
  useEffect(() => {
    if (!dataLoaded) return;
    const theme = normalizeTheme(settings.theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', theme === 'console' ? 'dark' : 'light');
    document.documentElement.removeAttribute('data-crt');
  }, [dataLoaded, settings.theme]);

  // 3. Ctrl/Cmd+K opens the search palette.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 4. Live task timer.
  // Each tick adds the REAL seconds since the last tick (hidden tabs are throttled by the browser),
  // and the backlog is saved every 30 s and when the tab is hidden or closed, not every second.
  const timerDirty = useRef(false);
  const timerLastSaveAt = useRef(Date.now());
  const backlogRef = useRef<BacklogTask[]>([]);
  // Set just before a reload that follows a write of new data (backup import): the page must not
  // save its old tasks on the way out, or they would overwrite what was just imported.
  const leavingRef = useRef(false);

  // Mirror the running tasks' seconds for the clocks that show them (they redraw on their own).
  useEffect(() => {
    publishTimers(backlog);
  }, [backlog]);

  useEffect(() => {
    backlogRef.current = backlog;
    if (timerDirty.current && !leavingRef.current && Date.now() - timerLastSaveAt.current >= 30000) {
      saveBacklog(backlog);
      timerDirty.current = false;
      timerLastSaveAt.current = Date.now();
    }
  }, [backlog]);

  useEffect(() => {
    let lastTickMs = Date.now();
    const flush = () => {
      if (timerDirty.current && !leavingRef.current) {
        saveBacklog(backlogRef.current);
        timerDirty.current = false;
        timerLastSaveAt.current = Date.now();
      }
    };
    // The page is going away: the saved copy closes every open timer segment, so the overs strip never
    // shows time while the app was closed. On the next load rollOverTasks reopens them for running tasks.
    // State keeps the open segment, in case the page comes back from the back/forward cache.
    // Writes only when there is something to write (before the data has loaded the ref is empty,
    // and saving it would wipe the stored tasks).
    const onPageHide = () => {
      if (leavingRef.current) return;
      const nowIso = new Date().toISOString();
      const closed = backlogRef.current.map((t) => endSegment(t, nowIso));
      const segmentsClosed = closed.some((t, i) => t !== backlogRef.current[i]);
      if (!segmentsClosed && !timerDirty.current) return;
      saveBacklog(closed);
      timerDirty.current = false;
      timerLastSaveAt.current = Date.now();
    };
    const timerInterval = setInterval(() => {
      const { seconds, nextMs } = advanceClock(lastTickMs, Date.now());
      lastTickMs = nextMs;
      if (seconds === 0) return;
      setBacklog((prev) => {
        let changed = false;
        const updated = prev.map((t) => {
          if (t.stage === 'in_progress' && t.isRunning !== false) {
            changed = true;
            return {
              ...t,
              elapsedSeconds: (t.elapsedSeconds || 0) + seconds,
            };
          }
          return t;
        });
        if (changed) timerDirty.current = true;
        return changed ? updated : prev;
      });
    }, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // Midnight rollover: if the date changes while the app stays open, move unfinished past-due
  // tasks to the new day (before, this only happened when the page was reloaded).
  useEffect(() => {
    let lastDate = localDateStr();
    const id = setInterval(() => {
      const now = localDateStr();
      if (now === lastDate) return;
      lastDate = now;
      setBacklog((prev) => {
        const { tasks, changed } = rollOverTasks(prev, now);
        if (!changed) return prev;
        saveBacklog(tasks);
        return tasks;
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Persistence handlers
  // The theme picker applies at once and is remembered.
  const handleThemeChange = (theme: ThemeId) => {
    const next = normalizeTheme(theme);
    if (next === settings.theme) return;
    const updated = { ...settings, theme: next };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleSaveSettings = (incoming: AppSettings) => {
    // Connecting (or switching) a sheet: only logs created from now on are sent to it.
    const urlChanged = incoming.googleScriptUrl !== settings.googleScriptUrl;
    const withTracking =
      incoming.googleScriptUrl && (urlChanged || !incoming.syncTrackingSince)
        ? { ...incoming, syncTrackingSince: new Date().toISOString() }
        : incoming;
    const newSettings = { ...withTracking, theme: normalizeTheme(withTracking.theme) };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // The office clock. Functional updates, so two calls in a row both stick.
  const handleClockIn = (atIso?: string) => {
    const at = atIso ?? new Date().toISOString();
    setWorkdays((prev) => {
      const next = clockIn(prev, at);
      if (next !== prev) saveWorkdays(next);
      return next;
    });
    setIsClockInOpen(false);
  };

  const handleClockOut = (date: string) => {
    const at = new Date().toISOString();
    setWorkdays((prev) => {
      const next = clockOut(prev, date, at);
      if (next !== prev) saveWorkdays(next);
      return next;
    });
  };

  const handleResume = (date: string) => {
    setWorkdays((prev) => {
      const next = resumeWorkday(prev, date);
      if (next !== prev) saveWorkdays(next);
      return next;
    });
  };

  const handleAddLog = async (newLogData: Omit<WorkLog, 'id' | 'createdAt'>) => {
    const newLog: WorkLog = {
      ...newLogData,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [newLog, ...logs];
    setLogs(updated);
    if (saveLogs(updated).ok) addToast('Log added');

    if (settings.googleScriptUrl) {
      syncSingleLogToSheet(settings.googleScriptUrl, newLog).then((res) => {
        if (res.success) {
          markLogsSynced([newLog.id]);
          addToast('Synced with Google Sheet', 'success');
        } else {
          reportSyncFailure(res.message, () => handleSyncGoogleSheet());
        }
      });
    }
  };

  // Adds several logs in one state update (handleAddLog called in a loop would overwrite itself,
  // because each call starts from the same `logs`). Used by activity suggestions.
  const handleAddLogs = (batch: Omit<WorkLog, 'id' | 'createdAt'>[]) => {
    if (batch.length === 0) return;
    const stamp = Date.now();
    const created: WorkLog[] = batch.map((data, i) => ({
      ...data,
      id: `log-${stamp}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    }));
    const updated = [...created, ...logs];
    setLogs(updated);
    if (saveLogs(updated).ok) {
      addToast(created.length === 1 ? 'Log added' : `${created.length} logs added`);
    }

    if (settings.googleScriptUrl) {
      syncBatchLogsToSheet(settings.googleScriptUrl, created).then((res) => {
        if (res.success) {
          markLogsSynced(created.map((l) => l.id));
          addToast('Synced with Google Sheet', 'success');
        } else {
          reportSyncFailure(res.message, () => handleSyncGoogleSheet());
        }
      });
    }
  };

  const handleEditLog = (log: WorkLog) => setLogForm({ editing: log, prefill: null });
  const handleOpenLogForm = (prefill: LogFormPrefill | null) => setLogForm({ editing: null, prefill });

  const handleUpdateLog = (id: string, data: Omit<WorkLog, 'id' | 'createdAt'>) => {
    // editedAt makes the Sync button send the changed log to the sheet again.
    const updated = logs.map((l) => (l.id === id ? { ...l, ...data, editedAt: new Date().toISOString() } : l));
    setLogs(updated);
    if (saveLogs(updated).ok) addToast('Log updated', 'success');
  };

  const handleSaveLogForm = (data: Omit<WorkLog, 'id' | 'createdAt'>, id?: string) => {
    if (id) handleUpdateLog(id, data);
    else handleAddLog(data);
  };

  const handleDeleteLog = (id: string) => {
    const index = logs.findIndex((l) => l.id === id);
    if (index === -1) return;
    const removed = logs[index];
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveLogs(updated);
    setSelectedLogIds((prev) => prev.filter((i) => i !== id));
    addToast('Log deleted', 'info', {
      label: 'Undo',
      onClick: () =>
        setLogs((prev) => {
          if (prev.some((l) => l.id === removed.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          saveLogs(next);
          return next;
        }),
    });
  };

  const handleDuplicateLog = (log: WorkLog) => {
    const duplicated: WorkLog = {
      ...log,
      id: `log-${Date.now()}`,
      date: localDateStr(),
      time: localTimeStr(),
      createdAt: new Date().toISOString(),
      // a copy is a new log: it must not inherit "already synced" or "edited" from the original
      syncedAt: undefined,
      editedAt: undefined,
      // the original keeps the activity it was suggested from; a copy must not hold it too, or
      // deleting the original would never free that activity for suggestions again
      sourceIds: undefined,
    };
    const updated = [duplicated, ...logs];
    setLogs(updated);
    if (saveLogs(updated).ok) addToast('Log copied to today', 'success');
  };

  // Tasks
  const handleAddBacklogTask = (title: string, projectId: string, stage: TaskStage = 'planned', dueDate?: string) => {
    const nowIso = new Date().toISOString();
    const created: BacklogTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      projectId,
      dueDate: dueDate ?? localDateStr(),
      completed: stage === 'done',
      stage,
      originalDate: localDateStr(),
      isRolledOver: false,
      startedAt: stage === 'in_progress' ? nowIso : undefined,
    };
    const newTask = stage === 'in_progress' ? startSegment(created, nowIso) : created;
    const updated = [newTask, ...backlog];
    setBacklog(updated);
    saveBacklog(updated);
    addToast(stage === 'in_progress' ? 'Task added and started' : 'Task added');
  };

  const handleUpdateTaskStage = (taskId: string, stage: TaskStage, blockReason?: string) => {
    const task = backlog.find((t) => t.id === taskId);
    if (!task) return;

    if (stage === 'done') {
      // Done does not write a log. The task waits for "Log it" or End my day.
      handleCompleteTask(task);
      return;
    }

    const nowIso = new Date().toISOString();
    const updated = backlog.map((t) => {
      if (t.id === taskId) {
        const isNowInProgress = stage === 'in_progress';
        const moved: BacklogTask = {
          ...t,
          stage,
          completed: false,
          isRunning: isNowInProgress,
          startedAt: isNowInProgress ? t.startedAt || nowIso : t.startedAt,
          blockReason:
            blockReason !== undefined ? blockReason : stage === 'in_progress' ? undefined : t.blockReason,
        };
        return isNowInProgress ? startSegment(moved, nowIso) : endSegment(moved, nowIso);
      }
      return t;
    });

    setBacklog(updated);
    saveBacklog(updated);

    if (stage === 'in_progress') {
      addToast(`Started: ${task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title}`, 'success');
    } else if (stage === 'paused') {
      addToast('Task paused', 'info');
    } else if (stage === 'blocked') {
      addToast('Task marked as blocked', 'info');
    } else if (stage === 'planned') {
      addToast('Task moved back to planned', 'info');
    }
  };

  // Pauses one running task. A functional update, so End my day can pause several in a row
  // (a handler that reads `backlog` would keep only the last pause).
  const handlePauseTask = (taskId: string) => {
    const nowIso = new Date().toISOString();
    setBacklog((prev) => {
      const next = prev.map((t) =>
        t.id === taskId && t.stage === 'in_progress'
          ? endSegment({ ...t, stage: 'paused' as TaskStage, isRunning: false }, nowIso)
          : t,
      );
      saveBacklog(next);
      return next;
    });
  };

  const handleReopenTask = (taskId: string, targetStage: TaskStage = 'in_progress') => {
    const nowIso = new Date().toISOString();
    const updated = backlog.map((t) => {
      if (t.id === taskId) {
        const reopened: BacklogTask = {
          ...t,
          completed: false,
          stage: targetStage,
          isRunning: targetStage === 'in_progress',
          completedAt: undefined,
          startedAt: targetStage === 'in_progress' ? nowIso : t.startedAt,
          // New work after reopening can be logged again; loggedSeconds keeps what was already logged.
          isSynthesized: false,
          synthesizedAt: undefined,
        };
        return targetStage === 'in_progress' ? startSegment(reopened, nowIso) : reopened;
      }
      return t;
    });
    setBacklog(updated);
    saveBacklog(updated);
    addToast(
      targetStage === 'in_progress'
        ? 'Task reopened and running'
        : targetStage === 'planned'
          ? 'Task moved back to planned'
          : 'Task reopened',
      'info',
    );
  };

  // Marks a task done without writing a log. It waits for "Log it", a timesheet from the Tasks
  // screen, or End my day; only then does it become a log and sync to the Sheet.
  const handleCompleteTask = (task: BacklogTask) => {
    // Reopened and finished again with no new tracked time: everything is already in a log.
    const alreadyLogged = loggedSecondsOf(task) > 0 && unloggedSeconds(task) === 0;
    const nowIso = new Date().toISOString();
    const updated = backlog.map((t) =>
      t.id === task.id
        ? endSegment(
            {
              ...t,
              completed: true,
              stage: 'done' as TaskStage,
              isRunning: false,
              completedAt: nowIso,
              isSynthesized: alreadyLogged,
            },
            nowIso,
          )
        : t,
    );
    setBacklog(updated);
    saveBacklog(updated);
    addToast(
      alreadyLogged ? 'Task done (no new time to log)' : 'Task done. Log it now, or in End my day.',
      'success',
    );
  };

  const handleConvertTaskToLog = (task: BacklogTask) => {
    // A deleted project is named "General" below; never borrow another project's name (B13).
    const project = projects.find((p) => p.id === task.projectId);
    const nowIso = new Date().toISOString();
    const newSeconds = unloggedSeconds(task);

    // Mark the task as logged so the EOD synthesizer does not log it a second time (B3).
    const markDone = (t: BacklogTask): BacklogTask =>
      endSegment(
        {
          ...t,
          completed: true,
          stage: 'done' as TaskStage,
          isRunning: false,
          completedAt: t.completedAt ?? nowIso,
          isSynthesized: true,
          synthesizedAt: nowIso,
          loggedSeconds: task.elapsedSeconds || 0,
        },
        nowIso,
      );

    // Completed again after a reopen with no new tracked time: nothing new to log.
    if (loggedSecondsOf(task) > 0 && newSeconds === 0) {
      const done = backlog.map((t) => (t.id === task.id ? markDone(t) : t));
      setBacklog(done);
      saveBacklog(done);
      addToast('Task done (no new time to log)', 'info');
      return;
    }

    const durationMins = minutesFromSeconds(newSeconds);

    const newLog: WorkLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: localDateStr(),
      time: localTimeStr(),
      projectId: task.projectId,
      projectName: project?.name || 'General',
      description: task.title,
      status: 'completed',
      tags: ['#deep-work'],
      durationMinutes: durationMins || undefined,
      energyRating: 4,
      createdAt: nowIso,
    };

    const updatedBacklog = backlog.map((t) => (t.id === task.id ? markDone(t) : t));
    setBacklog(updatedBacklog);
    saveBacklog(updatedBacklog);

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    saveLogs(updatedLogs);

    addToast("Task logged to today's log", 'success');

    // Automatically push to Google Sheet if linked
    if (settings.googleScriptUrl) {
      syncSingleLogToSheet(settings.googleScriptUrl, newLog).then((res) => {
        if (res.success) {
          markLogsSynced([newLog.id]);
          addToast('Synced with Google Sheet', 'success');
        } else {
          reportSyncFailure(res.message, () => handleSyncGoogleSheet());
        }
      });
    }
  };

  // The EOD synthesizer (and End my day step 2) confirmed these logs.
  const handleConfirmEodPush = async (items: SynthesizedLogItem[]) => {
    const todayStr = localDateStr();
    const newLogs: WorkLog[] = items.map((item) => ({
      id: `log-eod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: todayStr,
      time: localTimeStr(),
      projectId: item.projectId,
      projectName: item.projectName,
      description: item.summaryBullets,
      status: item.status,
      tags: item.tags,
      durationMinutes: item.durationMinutes || undefined,
      isSynthesized: true,
      underlyingTasks: item.underlyingTasks,
      createdAt: new Date().toISOString(),
    }));

    // Tasks stay where they are; only isSynthesized, synthesizedAt and loggedSeconds change.
    const touchedTaskIds = new Set(items.flatMap((i) => i.taskIds));
    // The seconds each task contributed to these logs (the modal sends only not-yet-logged time).
    const addedSeconds = new Map<string, number>();
    items.forEach((i) =>
      i.underlyingTasks.forEach((u) => addedSeconds.set(u.id, (addedSeconds.get(u.id) || 0) + (u.elapsedSeconds || 0))),
    );
    const nowIso = new Date().toISOString();
    const updatedBacklog = backlog.map((t) => {
      if (touchedTaskIds.has(t.id)) {
        return {
          ...t,
          isSynthesized: true,
          synthesizedAt: nowIso,
          loggedSeconds: loggedSecondsOf(t) + (addedSeconds.get(t.id) || 0),
        };
      }
      return t;
    });

    setBacklog(updatedBacklog);
    saveBacklog(updatedBacklog);

    const updatedLogs = [...newLogs, ...logs];
    setLogs(updatedLogs);
    saveLogs(updatedLogs);

    addToast(newLogs.length === 1 ? '1 log added' : `${newLogs.length} logs added`, 'success');

    if (settings.googleScriptUrl) {
      const res = await syncBatchLogsToSheet(settings.googleScriptUrl, newLogs);
      if (res.success) {
        markLogsSynced(newLogs.map((l) => l.id));
        addToast('Synced with Google Sheet', 'success');
      } else {
        reportSyncFailure(res.message, () => handleSyncGoogleSheet());
      }
    }
  };

  const handleDeleteBacklogTask = (taskId: string) => {
    const index = backlog.findIndex((t) => t.id === taskId);
    if (index === -1) return;
    const removed = backlog[index];
    const updated = backlog.filter((t) => t.id !== taskId);
    setBacklog(updated);
    saveBacklog(updated);
    addToast('Task deleted', 'info', {
      label: 'Undo',
      onClick: () =>
        setBacklog((prev) => {
          if (prev.some((t) => t.id === removed.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          saveBacklog(next);
          return next;
        }),
    });
  };

  const handleAddProject = (name: string, color: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      color,
      isArchived: false,
    };
    const updated = [...projects, newProj];
    setProjects(updated);
    saveProjects(updated);
    addToast(`Project "${name}" added`);
  };

  const backupNow = () => buildBackup({ logs, backlog, projects, tags, settings, workdays });

  const handleResetSeedData = () => {
    if (
      window.confirm(
        'Replace all work logs, tasks, projects and tags with the demo data? A backup file of your current data will be downloaded first.',
      )
    ) {
      downloadTextFile(`workpulse-pre-reset-${localDateStr()}.json`, backupNow());
      const seed = getInitialSeedData();
      setLogs(seed.logs);
      setBacklog(seed.backlog);
      setProjects(seed.projects);
      setTags(seed.tags);
      saveLogs(seed.logs);
      saveBacklog(seed.backlog);
      saveProjects(seed.projects);
      saveTags(seed.tags);
      addToast('Reset to demo data. Your previous data was downloaded as a backup file.');
    }
  };

  // Removes only the demo items; everything the person added stays. Undo puts the demo items back.
  const handleClearSampleData = () => {
    const out = withoutSampleData(logs, backlog, projects, () => ({
      id: `proj-${Date.now()}`,
      name: 'General',
      color: '#6366f1',
      isArchived: false,
    }));
    const removed = {
      logs: logs.filter((l) => !out.logs.includes(l)),
      backlog: backlog.filter((t) => !out.backlog.includes(t)),
      projects: projects.filter((p) => !out.projects.includes(p)),
      added: out.projects.filter((p) => !projects.includes(p)),
    };
    setLogs(out.logs);
    setBacklog(out.backlog);
    setProjects(out.projects);
    saveLogs(out.logs);
    saveBacklog(out.backlog);
    saveProjects(out.projects);
    addToast('Sample data cleared. Your own logs and tasks are untouched.', 'success', {
      label: 'Undo',
      onClick: () => {
        // put the demo items back next to whatever has been added since
        setLogs((cur) => {
          const next = [...cur, ...removed.logs];
          saveLogs(next);
          return next;
        });
        setBacklog((cur) => {
          const next = [...cur, ...removed.backlog];
          saveBacklog(next);
          return next;
        });
        setProjects((cur) => {
          const next = [...cur.filter((p) => !removed.added.some((a) => a.id === p.id)), ...removed.projects];
          saveProjects(next);
          return next;
        });
      },
    });
  };

  const handleStartFresh = () => {
    if (
      window.confirm(
        'Remove ALL logs, tasks and tags, and keep a single "General" project? Your settings (theme, API key, Sheet URL) stay. A backup file of your current data is downloaded first.',
      )
    ) {
      downloadTextFile(`workpulse-pre-fresh-${localDateStr()}.json`, backupNow());
      const general: Project = { id: `proj-${Date.now()}`, name: 'General', color: '#6366f1', isArchived: false };
      setLogs([]);
      setBacklog([]);
      setProjects([general]);
      setTags([]);
      saveLogs([]);
      saveBacklog([]);
      saveProjects([general]);
      saveTags([]);
      addToast('Started fresh. Your previous data was downloaded as a backup file.');
    }
  };

  const handleFixLogDates = (fixes: DateFix[]) => {
    downloadTextFile(`workpulse-pre-datefix-${localDateStr()}.json`, backupNow());
    const updated = applyDateFixes(logs, fixes);
    setLogs(updated);
    if (saveLogs(updated).ok) {
      addToast(`Fixed the date of ${fixes.length} log(s). A backup file was downloaded first.`);
    }
  };

  // The manual backup (Settings, or "Back up now" in the reminder). It also starts the reminder's clock.
  const handleBackupNow = () => {
    downloadTextFile(`workpulse-backup-${localDateStr()}.json`, backupNow());
    const updated = { ...settings, lastBackupAt: new Date().toISOString() };
    setSettings(updated);
    saveSettings(updated);
    addToast('Backup downloaded (the Gemini API key is not included)', 'success');
  };

  const handleImportBackup = (data: BackupData) => {
    // Keep this machine's API key and backup date; backups never contain them. Workdays travel
    // with the backup (an older backup without them leaves the stored ones alone).
    const result = replaceAllData({
      ...data,
      settings: { ...data.settings, geminiApiKey: settings.geminiApiKey, lastBackupAt: settings.lastBackupAt },
      workdays: data.workdays,
    });
    if (!result.ok) {
      addToast('Import failed: browser storage is full. Nothing was changed.', 'error');
      return;
    }
    // Reload so the normal loader normalises the imported data (stages, rollover, theme). The page's
    // own (old) tasks must not be saved on the way out.
    leavingRef.current = true;
    timerDirty.current = false;
    window.location.reload();
  };

  // Sends every unsynced log. Toasts the outcome; used by the Retry button on a failed sync.
  const handleSyncGoogleSheet = async () => {
    if (!settings.googleScriptUrl) {
      setActiveTab('settings');
      addToast('Add your Google Apps Script Web App URL in Settings first.', 'info');
      return;
    }

    const pending = unsyncedLogs(logs, settings.syncTrackingSince);
    if (pending.length === 0) {
      addToast('Everything is already synced to Google Sheet.', 'info');
      return;
    }

    setIsSyncingSheet(true);
    const result = await syncBatchLogsToSheet(settings.googleScriptUrl, pending).finally(() => setIsSyncingSheet(false));
    if (result.success) {
      markLogsSynced(pending.map((l) => l.id));
      addToast(result.message, 'success');
    } else {
      reportSyncFailure(result.message, () => handleSyncGoogleSheet());
    }
  };

  // End my day's Sync step: the same send, but a failure rejects so the step can show it.
  const handleSyncForEndDay = async () => {
    if (!settings.googleScriptUrl) return;
    const pending = unsyncedLogs(logs, settings.syncTrackingSince);
    if (pending.length === 0) return;
    const result = await syncBatchLogsToSheet(settings.googleScriptUrl, pending);
    if (!result.success) throw new Error(result.message);
    markLogsSynced(pending.map((l) => l.id));
  };

  const handleToggleSelectLog = (id: string) =>
    setSelectedLogIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleCopy = (text: string) => {
    if (!navigator.clipboard) {
      addToast('Could not copy: the clipboard is not available here.', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => addToast('Copied to clipboard'),
      () => addToast('Could not copy to the clipboard.', 'error'),
    );
  };

  // ---- Derived state for the shell ----
  // Re-render twice a minute even with no timer running, so the next action follows the clock
  // (calm → near the leave time) and the date rolls over at midnight. The band ticks on its own.
  const now = useNow(30_000);
  const todayStr = localDateStr(new Date(now));
  const hours = settings.workdayHours ?? DEFAULT_WORKDAY_HOURS;
  const todayRecord = workdays[todayStr];
  // A forgotten clock-out from an earlier day shows in the band only while today has no record.
  const staleOpen = todayRecord ? null : openWorkdayBefore(workdays, todayStr);
  const theme = normalizeTheme(settings.theme);

  const pendingSuggestions = useSyncExternalStore(subscribeActivitySession, () => pendingCount(todayStr));
  const checkedActivityToday = useSyncExternalStore(subscribeActivitySession, () => checkedToday(todayStr));
  const folders = settings.activityFolders && settings.activityFolders.length > 0 ? settings.activityFolders : NO_FOLDERS;

  const next = chooseNextAction({
    clock: clockState(todayRecord, hours, Date.now()),
    pendingSuggestions,
    doneUnloggedTasks: backlog.filter(isDoneUnlogged).length,
    checkedActivityToday,
    hasActivityFolders: folders.length > 0,
  });

  const todayMinutes = logs.reduce((sum, l) => (l.date === todayStr ? sum + (l.durationMinutes ?? 0) : sum), 0);
  const openTasks = backlog.filter(isPendingTask).length;

  // Opens the suggestions: on a wide screen the Today card (scrolled into view), under 1024 px the
  // dialog, because the card sits at the bottom of the single column there.
  const showSuggestions = () => {
    if (window.innerWidth < 1024) {
      setIsActivityOpen(true);
      return;
    }
    setActiveTab('today');
    setTimeout(() => {
      const el = document.getElementById('today-suggestions');
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      el.querySelector<HTMLElement>('h2')?.focus();
    }, 50);
  };

  const handleNext = () => {
    switch (next.kind) {
      case 'clock-in':
        setIsClockInOpen(true);
        return;
      case 'end-day':
        setEndDay({});
        return;
      case 'review-suggestions':
      case 'check-activity':
        showSuggestions();
        return;
      case 'log-done':
        setEndDay({ step: 'tasks' });
        return;
      case 'add-log':
        handleOpenLogForm(null);
        return;
    }
  };

  // Stable handlers for the memoized screens and dialogs: they never change identity but always run
  // the latest closure, so the screens skip the every-second re-render while a timer runs.
  const h = {
    addTask: useStableCallback(handleAddBacklogTask),
    stage: useStableCallback(handleUpdateTaskStage),
    complete: useStableCallback(handleCompleteTask),
    logTask: useStableCallback(handleConvertTaskToLog),
    reopenToPlanned: useStableCallback((id: string) => handleReopenTask(id, 'planned')),
    deleteTask: useStableCallback(handleDeleteBacklogTask),
    addLog: useStableCallback(handleAddLog),
    addLogs: useStableCallback(handleAddLogs),
    openLogForm: useStableCallback(handleOpenLogForm),
    editLog: useStableCallback(handleEditLog),
    deleteLog: useStableCallback(handleDeleteLog),
    duplicateLog: useStableCallback(handleDuplicateLog),
    openSettings: useStableCallback(() => setActiveTab('settings')),
    endDay: useStableCallback(() => setEndDay({})),
    logSelectedTasks: useStableCallback((ids: string[]) => handleOpenEodSynthesizer(ids)),
    copy: useStableCallback(handleCopy),
    toggleSelectLog: useStableCallback(handleToggleSelectLog),
    selectLogs: useStableCallback((ids: string[]) => setSelectedLogIds(ids)),
    clearLogSelection: useStableCallback(() => setSelectedLogIds([])),
    standup: useStableCallback(() => setIsAiStandupOpen(true)),
    // Today's log "Standup": the day's logs become the selection, as a History selection would.
    standupToday: useStableCallback(() => {
      setSelectedLogIds(logs.filter((l) => l.date === localDateStr()).map((l) => l.id));
      setIsAiStandupOpen(true);
    }),
    openImage: useStableCallback((base64: string) => setActiveLightboxImage(base64)),
    sync: useStableCallback(() => {
      if (!isSyncingSheet) handleSyncGoogleSheet();
    }),
    historyFocusHandled: useStableCallback(() => setHistoryFocus(null)),
    confirmEod: useStableCallback(handleConfirmEodPush),
    syncForEndDay: useStableCallback(handleSyncForEndDay),
    pauseTask: useStableCallback(handlePauseTask),
    clockOutToday: useStableCallback(() => handleClockOut(localDateStr())),
    closeEndDay: useStableCallback(() => setEndDay(null)),
  };

  const sourcesGit = sourcesFromSettings(settings).git;
  const sourcesClaude = sourcesFromSettings(settings).claude;
  const ai = aiFromSettings(settings);
  const activityProps: TodayActivityProps = useMemo(
    () => ({
      folders,
      sources: { git: sourcesGit, claude: sourcesClaude },
      ai,
      geminiApiKey: settings.geminiApiKey,
      onAddLogs: h.addLogs,
      onOpenSettings: h.openSettings,
    }),
    // h.* never change identity, so they are not dependencies.
    [folders, sourcesGit, sourcesClaude, ai, settings.geminiApiKey],
  );

  const hasSheet = Boolean(settings.googleScriptUrl);
  const unsyncedCount = hasSheet ? unsyncedLogs(logs, settings.syncTrackingSince).length : 0;
  const sync = useMemo(
    () => ({ hasSheet, unsynced: unsyncedCount, syncing: isSyncingSheet, onSync: h.sync }),
    // h.sync never changes identity.
    [hasSheet, unsyncedCount, isSyncingSheet],
  );

  if (!dataLoaded) {
    return <div className="min-h-screen bg-[var(--bg-app)]" />;
  }

  const samples = sampleCounts(logs, backlog);
  const backup = backupStatus(settings.lastBackupAt, logs, backlog);
  const showNotices = activeTab === 'today' || activeTab === 'tasks';
  const noticeWidth = activeTab === 'tasks' ? 'max-w-[960px]' : 'max-w-[1440px]';

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] antialiased selection:bg-[var(--accent)] selection:text-[var(--on-accent)]">
      <AppHeader
        active={activeTab}
        onTab={setActiveTab}
        todayMinutes={todayMinutes}
        openTasks={openTasks}
        next={next}
        onNext={handleNext}
        onSearch={() => setIsSearchOpen(true)}
      >
        <ClockBand
          theme={theme}
          today={todayStr}
          record={todayRecord}
          staleOpen={staleOpen}
          hours={hours}
          tasks={backlog}
          projects={projects}
          onClockIn={() => setIsClockInOpen(true)}
          onClockOut={handleClockOut}
          onResume={handleResume}
        />
      </AppHeader>

      <main className="pb-[calc(56px+env(safe-area-inset-bottom))] sm:pb-0">
        <div className={`mx-auto ${noticeWidth} px-4 sm:px-8 pt-5 flex flex-col gap-3 empty:hidden`}>
          <OfflineNotice />
          {showNotices && samples.total > 0 && (
            <SampleDataBanner
              logCount={samples.logs}
              taskCount={samples.tasks}
              onClear={handleClearSampleData}
              onOpenSetup={() => setActiveTab('settings')}
            />
          )}
          {showNotices && !backupReminderHidden && backup.due && (
            <BackupReminder days={backup.days} onBackup={handleBackupNow} onLater={() => setBackupReminderHidden(true)} />
          )}
        </div>

        {activeTab === 'today' && (
          <TodayScreen
            backlog={backlog}
            logs={logs}
            projects={projects}
            today={todayStr}
            onAddTask={h.addTask}
            onStage={h.stage}
            onComplete={h.complete}
            onLogTask={h.logTask}
            onReopen={h.reopenToPlanned}
            onDeleteTask={h.deleteTask}
            onAddLog={h.addLog}
            onOpenLogForm={h.openLogForm}
            onEditLog={h.editLog}
            onDeleteLog={h.deleteLog}
            onDuplicateLog={h.duplicateLog}
            activityProps={activityProps}
            onSuggestionsPending={noop}
            onActivityScanned={noop}
            onEndDay={h.endDay}
            onStandup={h.standupToday}
            onOpenImage={h.openImage}
            sync={sync}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksScreen
            backlog={backlog}
            projects={projects}
            today={todayStr}
            onAddTask={h.addTask}
            onStage={h.stage}
            onComplete={h.complete}
            onLogTask={h.logTask}
            onReopen={h.reopenToPlanned}
            onDeleteTask={h.deleteTask}
            onLogSelected={h.logSelectedTasks}
          />
        )}

        {activeTab === 'history' && (
          <HistoryScreen
            logs={logs}
            projects={projects}
            workdays={workdays}
            hours={hours}
            onEditLog={h.editLog}
            onDeleteLog={h.deleteLog}
            onDuplicateLog={h.duplicateLog}
            onCopy={h.copy}
            selectedIds={selectedLogIds}
            onToggleSelect={h.toggleSelectLog}
            onSelectMany={h.selectLogs}
            onClearSelection={h.clearLogSelection}
            onStandup={h.standup}
            onOpenImage={h.openImage}
            sync={sync}
            focusDate={historyFocus?.date}
            focusLogId={historyFocus?.id}
            onFocusHandled={h.historyFocusHandled}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onThemeChange={handleThemeChange}
            projects={projects}
            onUpdateProjects={(p) => {
              setProjects(p);
              saveProjects(p);
            }}
            tags={tags}
            onUpdateTags={(t) => {
              setTags(t);
              saveTags(t);
            }}
            logs={logs}
            backlog={backlog}
            onResetSeedData={handleResetSeedData}
            onImportBackup={handleImportBackup}
            onBackupNow={handleBackupNow}
            onFixLogDates={handleFixLogDates}
            onStartFresh={handleStartFresh}
            onNotify={(msg, type, action) => addToast(msg, type || 'info', action)}
          />
        )}
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} openTasks={openTasks} />

      <ClockInDialog isOpen={isClockInOpen} onClose={() => setIsClockInOpen(false)} onConfirm={handleClockIn} />

      <EndDayDialog
        isOpen={endDay !== null}
        initialStep={endDay?.step}
        onClose={h.closeEndDay}
        today={todayStr}
        logs={logs}
        backlog={backlog}
        projects={projects}
        settings={settings}
        workday={todayRecord}
        activityProps={activityProps}
        onConfirmEodPush={h.confirmEod}
        onEditLog={h.editLog}
        onDeleteLog={h.deleteLog}
        onSync={h.syncForEndDay}
        onPauseTask={h.pauseTask}
        onClockOut={h.clockOutToday}
        onOpenImage={h.openImage}
      />

      {/* Timesheet from selected tasks (Tasks screen) or from History */}
      <EodSynthesizerModal
        isOpen={isEodSynthesizerOpen}
        onClose={() => setIsEodSynthesizerOpen(false)}
        tasksSnapshot={eodTasksSnapshot}
        isCustomSelection={isEodCustomSelection}
        projects={projects}
        geminiApiKey={settings.geminiApiKey}
        hasGoogleSheetLinked={Boolean(settings.googleScriptUrl)}
        onConfirmAndPush={handleConfirmEodPush}
        onOpenActivity={() => setIsActivityOpen(true)}
      />

      {/* Activity suggestions as a dialog (phones and tablets; the Today card on wide screens) */}
      <ActivitySuggestionsDialog
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        logs={logs}
        backlog={backlog}
        projects={projects}
        folders={folders}
        sources={activityProps.sources}
        ai={ai}
        geminiApiKey={settings.geminiApiKey}
        onAddLogs={handleAddLogs}
        onOpenSettings={() => setActiveTab('settings')}
      />

      <AiStandupModal
        isOpen={isAiStandupOpen}
        onClose={() => setIsAiStandupOpen(false)}
        logs={logs}
        selectedLogIds={selectedLogIds}
        geminiApiKey={settings.geminiApiKey}
        defaultRecipientName={settings.defaultRecipientName}
        defaultTone={settings.defaultTone}
        onCopySuccess={() => addToast('Standup copied to clipboard')}
      />

      <SearchPaletteModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        logs={logs}
        projects={projects}
        onSelectLog={(log) => {
          setActiveTab('history');
          setHistoryFocus({ date: log.date, id: log.id });
        }}
        onOpenImage={(base64) => setActiveLightboxImage(base64)}
      />

      <LightboxModal imageBase64={activeLightboxImage} onClose={() => setActiveLightboxImage(null)} />

      {/* Opened last so it stacks over End my day when a log is edited from there. */}
      {logForm && (
        <LogFormDialog
          isOpen
          projects={projects}
          tags={tags}
          editing={logForm.editing}
          prefill={logForm.prefill}
          onSave={handleSaveLogForm}
          onAddProject={handleAddProject}
          onClose={() => setLogForm(null)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
