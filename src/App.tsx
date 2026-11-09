import React, { useState, useEffect, useRef } from 'react';
import { localDateStr, localTimeStr } from './utils/dates';
import {
  WorkLog,
  BacklogTask,
  Project,
  AppSettings,
  ThemeId,
  ColorMode,
  AppNavTab,
  ToastMessage,
  TaskStatus,
  TaskStage,
  BackupData,
} from './types';
import {
  loadStoredData,
  saveLogs as storeLogs,
  saveBacklog as storeBacklog,
  saveProjects as storeProjects,
  saveTags as storeTags,
  saveSettings as storeSettings,
  replaceAllData,
  rollOverTasks,
  SaveResult,
} from './utils/storage';
import { buildBackup, downloadTextFile } from './utils/backup';
import { loggedSecondsOf, unloggedSeconds } from './utils/taskLogging';
import { advanceClock } from './utils/timer';
import { minutesFromSeconds } from './utils/duration';
import { unsyncedLogs } from './utils/syncStatus';
import { applyDateFixes, DateFix } from './utils/logDates';
import { getInitialSeedData } from './data/seedData';
import { syncSingleLogToSheet, syncBatchLogsToSheet } from './utils/sheetsSync';

// Common Components
import { TopBar } from './components/TopBar';
import { MobileNav } from './components/MobileNav';
import { DailyLogger } from './components/DailyLogger';
import { CommandSidebar } from './components/CommandSidebar';
import { BacklogSection } from './components/BacklogSection';
import { TimelineFeed } from './components/TimelineFeed';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { AiStandupModal } from './components/AiStandupModal';
import { SearchPaletteModal } from './components/SearchPaletteModal';
import { LightboxModal } from './components/LightboxModal';
import { ReminderBanner } from './components/ReminderBanner';
import { ToastContainer } from './components/ToastContainer';
import { LogEditorDialog } from './components/feed/LogEditorDialog';
import { RunningStrip } from './components/RunningStrip';
import { SampleDataBanner } from './components/SampleDataBanner';
import { OfflineNotice } from './components/OfflineNotice';
import { BackupReminder } from './components/BackupReminder';
import { backupStatus } from './utils/backupReminder';
import { sampleCounts, withoutSampleData } from './data/sampleData';
import { plainSheetMessage } from './utils/aiErrors';
import { useStableCallback } from './hooks/useStableCallback';
import { publishTimers } from './utils/timerStore';
import { LogListProps, QuickLogProps } from './components/feed/types';
import { isPendingTask } from './utils/taskLogging';
import { EodSynthesizerModal, SynthesizedLogItem } from './components/EodSynthesizerModal';
import { ActivitySuggestionsDialog } from './components/activity/ActivitySuggestionsDialog';
import { aiFromSettings, sourcesFromSettings } from './utils/activity/settings';

// Distinct Sub-Layouts Per Theme
import { MinimalistZenLayout } from './components/themes/MinimalistZenLayout';
import { CompactConsoleLayout } from './components/themes/CompactConsoleLayout';
import { MatrixTuiLayout } from './components/themes/MatrixTuiLayout';

export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [backlog, setBacklog] = useState<BacklogTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'modern',
    colorMode: 'dark',
    googleScriptUrl: '',
    geminiApiKey: '',
    defaultTone: 'casual',
    crtEffect: false,
  });

  // Active top navigation tab (now includes 'settings' as dedicated view)
  const [activeTab, setActiveTab] = useState<AppNavTab>('feed');

  // Modals
  const [isAiStandupOpen, setIsAiStandupOpen] = useState(false);
  const [isEodSynthesizerOpen, setIsEodSynthesizerOpen] = useState(false);
  const [eodTasksSnapshot, setEodTasksSnapshot] = useState<BacklogTask[]>([]);
  const [isEodCustomSelection, setIsEodCustomSelection] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Opens EOD modal with a frozen snapshot of backlog tasks to decouple from 1-second live timer ticks
  // Supports optional specific selectedTaskIds for granular synthesis
  const handleOpenEodSynthesizer = (selectedTaskIds?: string[]) => {
    if (selectedTaskIds && selectedTaskIds.length > 0) {
      const selectedSet = new Set(selectedTaskIds);
      const filtered = backlog.filter((t) => selectedSet.has(t.id));
      setEodTasksSnapshot(filtered);
      setIsEodCustomSelection(true);
    } else {
      setEodTasksSnapshot([...backlog]);
      setIsEodCustomSelection(false);
    }
    setIsEodSynthesizerOpen(true);
  };

  // Selected logs for AI standup
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  // Log picked in the search palette; the timeline scrolls to it and clears this.
  const [focusLogId, setFocusLogId] = useState<string | null>(null);
  // The log just written, so its row can settle into the list once.
  const [justAddedLogId, setJustAddedLogId] = useState<string | null>(null);
  const markJustAdded = (id: string) => {
    setJustAddedLogId(id);
    setTimeout(() => setJustAddedLogId((cur) => (cur === id ? null : cur)), 1500);
  };

  // Sync state
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Reminder banner dismissal
  const [reminderDismissed, setReminderDismissed] = useState(false);
  // "Later" on the backup reminder: hidden until the next visit, not remembered.
  const [backupReminderHidden, setBackupReminderHidden] = useState(false);

  // Pre-fill log state for "Log with Details"
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [prefillLog, setPrefillLog] = useState<{
    description: string;
    projectId: string;
    status?: TaskStatus;
  } | null>(null);

  const loggerRef = useRef<HTMLDivElement>(null);

  // Helper to add toast
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

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const loaded = loadStoredData();
    setLogs(loaded.logs);
    setBacklog(loaded.backlog);
    setProjects(loaded.projects);
    setTags(loaded.tags);
    if (loaded.warnings.length > 0) {
      addToast(loaded.warnings.join(' '), 'error');
    }

    const activeTheme = loaded.settings?.theme || 'modern';
    const activeMode = loaded.settings?.colorMode || (activeTheme === 'minimalist' ? 'light' : 'dark');

    // Sync tracking starts now for users who already have a sheet: older logs are not re-sent.
    const syncTrackingSince =
      loaded.settings.googleScriptUrl && !loaded.settings.syncTrackingSince
        ? new Date().toISOString()
        : loaded.settings.syncTrackingSince;
    if (syncTrackingSince !== loaded.settings.syncTrackingSince) {
      storeSettings({ ...loaded.settings, syncTrackingSince });
    }

    setSettings({
      ...loaded.settings,
      syncTrackingSince,
      theme: activeTheme,
      colorMode: activeMode,
    });

    const todayStr = localDateStr();
    if (loaded.settings?.lastDismissedReminderDate === todayStr) {
      setReminderDismissed(true);
    }

    setDataLoaded(true);
  }, []);

  // 2. Sync theme & colorMode attributes to HTML root
  // Wait for the saved settings: index.html already applied them before first paint, and the
  // initial state here is only the default, which would flash the wrong theme.
  useEffect(() => {
    if (!dataLoaded) return;
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute(
      'data-mode',
      settings.theme === 'matrix' ? 'dark' : settings.colorMode
    );
    if (settings.theme === 'matrix' && settings.crtEffect) {
      document.documentElement.setAttribute('data-crt', 'on');
    } else {
      document.documentElement.removeAttribute('data-crt');
    }
  }, [dataLoaded, settings.theme, settings.colorMode, settings.crtEffect]);

  // A half-done edit or pre-filled log belongs to the layout it was started in: Modern edits inline,
  // the others in a dialog, so switching theme must not pop the old one open.
  useEffect(() => {
    setEditingLog(null);
    setPrefillLog(null);
  }, [settings.theme]);

  // 3. Global Keyboard Shortcuts
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

  // 4. Live Automatic Task Timer Engine.
  // Each tick adds the REAL seconds since the last tick (hidden tabs are throttled by the browser),
  // and the backlog is saved every 30 s and when the tab is hidden or closed, not every second.
  const timerDirty = useRef(false);
  const timerLastSaveAt = useRef(Date.now());
  const backlogRef = useRef<BacklogTask[]>([]);

  // Mirror the running tasks' seconds for the clocks that show them (they redraw on their own).
  useEffect(() => {
    publishTimers(backlog);
  }, [backlog]);

  useEffect(() => {
    backlogRef.current = backlog;
    if (timerDirty.current && Date.now() - timerLastSaveAt.current >= 30000) {
      saveBacklog(backlog);
      timerDirty.current = false;
      timerLastSaveAt.current = Date.now();
    }
  }, [backlog]);

  useEffect(() => {
    let lastTickMs = Date.now();
    const flush = () => {
      if (timerDirty.current) {
        saveBacklog(backlogRef.current);
        timerDirty.current = false;
        timerLastSaveAt.current = Date.now();
      }
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
    window.addEventListener('pagehide', flush);

    return () => {
      clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
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

  // 4. Persistence Handlers
  const handleColorModeChange = (newMode: ColorMode) => {
    if (settings.theme === 'matrix') return;
    const updated = { ...settings, colorMode: newMode };
    setSettings(updated);
    saveSettings(updated);
    addToast(`Mode: ${newMode.toUpperCase()}`, 'info');
  };

  // The theme switch in the top bar applies at once and is remembered. The mode is left alone, so
  // a person who leaves Matrix (always dark) gets their own light or dark choice back.
  const handleThemeChange = (theme: ThemeId) => {
    if (theme === settings.theme) return;
    const updated = { ...settings, theme };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleSaveSettings = (incoming: AppSettings) => {
    // Connecting (or switching) a sheet: only logs created from now on are sent to it.
    const urlChanged = incoming.googleScriptUrl !== settings.googleScriptUrl;
    const newSettings =
      incoming.googleScriptUrl && (urlChanged || !incoming.syncTrackingSince)
        ? { ...incoming, syncTrackingSince: new Date().toISOString() }
        : incoming;
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleAddLog = async (newLogData: Omit<WorkLog, 'id' | 'createdAt'>) => {
    const newLog: WorkLog = {
      ...newLogData,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [newLog, ...logs];
    setLogs(updated);
    markJustAdded(newLog.id);
    if (saveLogs(updated).ok) addToast('Work log recorded successfully!');

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
    markJustAdded(created[0].id);
    if (saveLogs(updated).ok) {
      addToast(created.length === 1 ? 'Work log recorded successfully!' : `${created.length} work logs recorded.`);
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

  const handleEditLog = (log: WorkLog) => {
    setEditingLog(log);
    setPrefillLog(null);
    setActiveTab('feed');
    setTimeout(() => loggerRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleUpdateLog = (id: string, data: Omit<WorkLog, 'id' | 'createdAt'>) => {
    // editedAt makes the Sync button send the changed log to the sheet again.
    const updated = logs.map((l) => (l.id === id ? { ...l, ...data, editedAt: new Date().toISOString() } : l));
    setLogs(updated);
    if (saveLogs(updated).ok) addToast('Log updated', 'success');
  };

  const handleDeleteLog = (id: string) => {
    const index = logs.findIndex((l) => l.id === id);
    if (index === -1) return;
    const removed = logs[index];
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveLogs(updated);
    setSelectedLogIds((prev) => prev.filter((i) => i !== id));
    addToast('Work log removed', 'info', {
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
    markJustAdded(duplicated.id);
    if (saveLogs(updated).ok) addToast('Log duplicated for today', 'success');
  };

  // Backlog & Focus Workspace handlers
  const handleAddBacklogTask = (
    title: string,
    projectId: string,
    stage: TaskStage = 'planned'
  ) => {
    const newTask: BacklogTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      projectId,
      dueDate: localDateStr(),
      completed: stage === 'done',
      stage,
      originalDate: localDateStr(),
      isRolledOver: false,
      startedAt: stage === 'in_progress' ? new Date().toISOString() : undefined,
    };
    const updated = [newTask, ...backlog];
    setBacklog(updated);
    saveBacklog(updated);
    addToast(
      stage === 'in_progress'
        ? 'Task added and started'
        : 'Task added to Planned Queue'
    );
  };

  const handleUpdateTaskStage = (
    taskId: string,
    stage: TaskStage,
    blockReason?: string
  ) => {
    const task = backlog.find((t) => t.id === taskId);
    if (!task) return;

    if (stage === 'done') {
      // Done only moves the task to Completed Today. It reaches the timesheet when the user picks it.
      handleCompleteTask(task);
      return;
    }

    const updated = backlog.map((t) => {
      if (t.id === taskId) {
        const isNowInProgress = stage === 'in_progress';
        return {
          ...t,
          stage,
          completed: false,
          isRunning: isNowInProgress,
          startedAt: isNowInProgress ? t.startedAt || new Date().toISOString() : t.startedAt,
          blockReason:
            blockReason !== undefined ? blockReason : stage === 'in_progress' ? undefined : t.blockReason,
        };
      }
      return t;
    });

    setBacklog(updated);
    saveBacklog(updated);

    if (stage === 'in_progress') {
      addToast(`"${task.title.slice(0, 32)}..." is now running`, 'success');
    } else if (stage === 'paused') {
      addToast('Task shifted to Paused', 'info');
    } else if (stage === 'blocked') {
      addToast('Task marked as Blocked', 'info');
    } else if (stage === 'planned') {
      addToast('Task reverted to Planned Queue', 'info');
    }
  };

  const handleReopenTask = (taskId: string, targetStage: TaskStage = 'in_progress') => {
    const updated = backlog.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          completed: false,
          stage: targetStage,
          isRunning: targetStage === 'in_progress',
          completedAt: undefined,
          startedAt: targetStage === 'in_progress' ? new Date().toISOString() : t.startedAt,
          // New work after reopening can be logged again; loggedSeconds keeps what was already logged.
          isSynthesized: false,
          synthesizedAt: undefined,
        };
      }
      return t;
    });
    setBacklog(updated);
    saveBacklog(updated);
    addToast(
      targetStage === 'in_progress'
        ? 'Task reopened and running'
        : targetStage === 'planned'
          ? 'Task reopened and moved to the Planned queue'
          : 'Task reopened',
      'info',
    );
  };

  const handleToggleBacklogTask = (taskId: string) => {
    const task = backlog.find((t) => t.id === taskId);
    if (!task) return;

    if (task.completed || task.stage === 'done') {
      handleReopenTask(taskId, 'planned');
    } else {
      handleCompleteTask(task);
    }
  };

  // Marks a task done without writing a log. It waits in Completed Today until the user selects it
  // for the timesheet (End of day); only then does it become a log and sync to the Sheet.
  const handleCompleteTask = (task: BacklogTask) => {
    // Reopened and finished again with no new tracked time: everything is already in a log.
    const alreadyLogged = loggedSecondsOf(task) > 0 && unloggedSeconds(task) === 0;
    const nowIso = new Date().toISOString();
    const updated = backlog.map((t) =>
      t.id === task.id
        ? {
            ...t,
            completed: true,
            stage: 'done' as TaskStage,
            isRunning: false,
            completedAt: nowIso,
            isSynthesized: alreadyLogged,
          }
        : t,
    );
    setBacklog(updated);
    saveBacklog(updated);
    addToast(
      alreadyLogged
        ? 'Task completed (no new time to log)'
        : 'Task done. Select it under Completed Today to add it to the timesheet.',
      'success',
    );
  };

  const handleConvertTaskToLog = (task: BacklogTask) => {
    // A deleted project is named "General" below; never borrow another project's name (B13).
    const project = projects.find((p) => p.id === task.projectId);
    const nowIso = new Date().toISOString();
    const newSeconds = unloggedSeconds(task);

    // Mark the task as logged so the EOD synthesizer does not log it a second time (B3).
    const markDone = (t: BacklogTask): BacklogTask => ({
      ...t,
      completed: true,
      stage: 'done' as TaskStage,
      isRunning: false,
      completedAt: nowIso,
      isSynthesized: true,
      synthesizedAt: nowIso,
      loggedSeconds: task.elapsedSeconds || 0,
    });

    // Completed again after a reopen with no new tracked time: nothing new to log.
    if (loggedSecondsOf(task) > 0 && newSeconds === 0) {
      const done = backlog.map((t) => (t.id === task.id ? markDone(t) : t));
      setBacklog(done);
      saveBacklog(done);
      addToast('Task completed (no new time to log)', 'info');
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

    addToast('Task completed & logged to timeline!', 'success');

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

  // EOD AI Synthesizer Push Handler
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

    // Preserve tasks 100% visible in their respective sections - ONLY update isSynthesized & synthesizedAt
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

    addToast(`${newLogs.length} EOD project logs recorded to timeline!`, 'success');

    if (settings.googleScriptUrl) {
      addToast('Syncing synthesized EOD logs with Google Sheets...', 'info');
      const res = await syncBatchLogsToSheet(settings.googleScriptUrl, newLogs);
      if (res.success) {
        markLogsSynced(newLogs.map((l) => l.id));
        addToast('Synced with Google Sheet', 'success');
      } else {
        reportSyncFailure(res.message, () => handleSyncGoogleSheet());
      }
    }
  };

  const handleLogWithDetails = (task: BacklogTask) => {
    setPrefillLog({
      description: task.title,
      projectId: task.projectId,
      status: 'completed',
    });
    setActiveTab('feed');
    setTimeout(() => {
      loggerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    addToast('Task details loaded into Daily Logger', 'info');
  };

  const handleDeleteBacklogTask = (taskId: string) => {
    const index = backlog.findIndex((t) => t.id === taskId);
    if (index === -1) return;
    const removed = backlog[index];
    const updated = backlog.filter((t) => t.id !== taskId);
    setBacklog(updated);
    saveBacklog(updated);
    addToast('Task removed', 'info', {
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

  const handleAddTag = (tag: string) => {
    if (!tags.includes(tag)) {
      const updated = [...tags, tag];
      setTags(updated);
      saveTags(updated);
    }
  };

  const handleResetSeedData = () => {
    if (
      window.confirm(
        'Replace all work logs, tasks, projects and tags with the demo data? A backup file of your current data will be downloaded first.',
      )
    ) {
      downloadTextFile(
        `workpulse-pre-reset-${localDateStr()}.json`,
        buildBackup({ logs, backlog, projects, tags, settings }),
      );
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
      downloadTextFile(
        `workpulse-pre-fresh-${localDateStr()}.json`,
        buildBackup({ logs, backlog, projects, tags, settings }),
      );
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
    downloadTextFile(
      `workpulse-pre-datefix-${localDateStr()}.json`,
      buildBackup({ logs, backlog, projects, tags, settings }),
    );
    const updated = applyDateFixes(logs, fixes);
    setLogs(updated);
    if (saveLogs(updated).ok) {
      addToast(`Fixed the date of ${fixes.length} log(s). A backup file was downloaded first.`);
    }
  };

  // The manual backup (Settings, or "Back up now" in the reminder). It also starts the reminder's clock.
  const handleBackupNow = () => {
    downloadTextFile(
      `workpulse-backup-${localDateStr()}.json`,
      buildBackup({ logs, backlog, projects, tags, settings }),
    );
    const updated = { ...settings, lastBackupAt: new Date().toISOString() };
    setSettings(updated);
    saveSettings(updated);
    addToast('Backup downloaded (the Gemini API key is not included)', 'success');
  };

  const handleImportBackup = (data: BackupData) => {
    // Keep this machine's API key and backup date; backups never contain them.
    const result = replaceAllData({
      ...data,
      settings: { ...data.settings, geminiApiKey: settings.geminiApiKey, lastBackupAt: settings.lastBackupAt },
    });
    if (!result.ok) {
      addToast('Import failed: browser storage is full. Nothing was changed.', 'error');
      return;
    }
    // Reload so the normal loader normalises the imported data (stages, rollover, theme).
    window.location.reload();
  };

  const handleSyncGoogleSheet = async () => {
    if (!settings.googleScriptUrl) {
      setActiveTab('settings');
      addToast('Please enter your Google Apps Script Web App URL first.', 'info');
      return;
    }

    const pending = unsyncedLogs(logs, settings.syncTrackingSince);
    if (pending.length === 0) {
      addToast('Everything is already synced to Google Sheet.', 'info');
      return;
    }

    setIsSyncingSheet(true);
    const result = await syncBatchLogsToSheet(settings.googleScriptUrl, pending);
    setIsSyncingSheet(false);
    if (result.success) {
      markLogsSynced(pending.map((l) => l.id));
      addToast(result.message, 'success');
    } else {
      reportSyncFailure(result.message, () => handleSyncGoogleSheet());
    }
  };

  const handleDismissReminder = () => {
    setReminderDismissed(true);
    const todayStr = localDateStr();
    const updated = { ...settings, lastDismissedReminderDate: todayStr };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleToggleSelectLog = (id: string) => {
    if (selectedLogIds.includes(id)) {
      setSelectedLogIds(selectedLogIds.filter((i) => i !== id));
    } else {
      setSelectedLogIds([...selectedLogIds, id]);
    }
  };

  const todayStr = localDateStr();
  const hasLogsToday = logs.some((l) => l.date === todayStr);
  const pendingTasksCount = backlog.filter(isPendingTask).length;

  // Handlers for the memoized Tasks screen: stable identities that always call the latest closure.
  const tasksHandlers = {
    onAddTask: useStableCallback(handleAddBacklogTask),
    onUpdateTaskStage: useStableCallback(handleUpdateTaskStage),
    onToggleTask: useStableCallback(handleToggleBacklogTask),
    onConvertTaskToLog: useStableCallback(handleConvertTaskToLog),
    onLogWithDetails: useStableCallback(handleLogWithDetails),
    onDeleteTask: useStableCallback(handleDeleteBacklogTask),
    onAddProject: useStableCallback(handleAddProject),
    onReopenTask: useStableCallback(handleReopenTask),
    onOpenEodSynthesizer: useStableCallback(handleOpenEodSynthesizer),
  };
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
        INITIALIZING WORKPULSE OS...
      </div>
    );
  }

  // Everything a timeline needs to list, select, edit and copy logs. All four themes get the same
  // set, so a feature cannot quietly exist in one theme only.
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard!');
  };
  const logListProps: LogListProps = {
    logs,
    projects,
    onEditLog: handleEditLog,
    onDeleteLog: handleDeleteLog,
    onDuplicateLog: handleDuplicateLog,
    onOpenImage: (base64) => setActiveLightboxImage(base64),
    onCopyText: copyToClipboard,
    selectedLogIds,
    onToggleSelectLog: handleToggleSelectLog,
    onSelectAllVisible: (ids) => setSelectedLogIds(ids),
    onClearSelection: () => setSelectedLogIds([]),
    onOpenAiStandupWithSelected: () => setIsAiStandupOpen(true),
    onOpenEodSynthesizer: handleOpenEodSynthesizer,
    focusLogId,
    onFocusLogHandled: () => setFocusLogId(null),
    justAddedLogId,
  };
  const quickLogProps: QuickLogProps = {
    availableTags: tags,
    onAddLog: handleAddLog,
    onOpenDetails: (draft) => {
      setEditingLog(null);
      setPrefillLog(draft);
    },
  };
  // Modern edits in its inline form; the other themes use the same form in a dialog.
  const showEditorDialog = settings.theme !== 'modern' && (editingLog !== null || prefillLog !== null);

  return (
    <div
      data-theme={settings.theme}
      data-mode={settings.theme === 'matrix' ? 'dark' : settings.colorMode}
      className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] transition-all antialiased selection:bg-[var(--accent)] selection:text-[var(--on-accent)] pb-20 md:pb-6"
    >
      {/* The top bar and the running task stay together at the top while you scroll */}
      <div className="sticky top-0 z-40">
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTheme={settings.theme}
        onThemeChange={handleThemeChange}
        colorMode={settings.colorMode}
        onColorModeChange={handleColorModeChange}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAiStandup={() => setIsAiStandupOpen(true)}
        onOpenEod={handleOpenEodSynthesizer}
        onOpenActivity={() => setIsActivityOpen(true)}
        hasGoogleSheetLinked={Boolean(settings.googleScriptUrl)}
        onSyncGoogleSheet={handleSyncGoogleSheet}
        unsyncedCount={
          settings.googleScriptUrl ? unsyncedLogs(logs, settings.syncTrackingSince).length : 0
        }
        isSyncing={isSyncingSheet}
      />

      <RunningStrip
        backlog={backlog}
        projects={projects}
        onPause={(id) => handleUpdateTaskStage(id, 'paused')}
        onOpenTasks={() => setActiveTab('backlog')}
      />
      </div>

      {/* Main Viewport Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        <OfflineNotice />

        {(activeTab === 'feed' || activeTab === 'backlog') && sampleCounts(logs, backlog).total > 0 && (
          <SampleDataBanner
            logCount={sampleCounts(logs, backlog).logs}
            taskCount={sampleCounts(logs, backlog).tasks}
            onClear={handleClearSampleData}
            onOpenSetup={() => setActiveTab('settings')}
          />
        )}

        {(activeTab === 'feed' || activeTab === 'backlog') && !backupReminderHidden && (() => {
          const status = backupStatus(settings.lastBackupAt, logs, backlog);
          return status.due ? (
            <BackupReminder days={status.days} onBackup={handleBackupNow} onLater={() => setBackupReminderHidden(true)} />
          ) : null;
        })()}

        {/* 5:00 PM End of Day Reminder Banner */}
        <ReminderBanner
          hasLogsToday={hasLogsToday}
          isDismissed={reminderDismissed}
          onDismiss={handleDismissReminder}
          onScrollToLogger={() => {
            // Go to the log form in every theme: modern has a ref; the other layouts have a quick-log input.
            setActiveTab('feed');
            setTimeout(() => {
              if (loggerRef.current) {
                loggerRef.current.scrollIntoView({ behavior: 'smooth' });
              } else {
                const input = document.querySelector<HTMLElement>('main textarea, main input[type="text"]');
                input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input?.focus();
              }
            }, 100);
          }}
        />

        {/* =========================================================================
            VIEW 1: TIMELINE FEED & DAILY LOGGING (UNIQUE PER THEME)
           ========================================================================= */}
        {activeTab === 'feed' && (
          <div>
            {/* 1. MINIMALIST: The Zen Notebook (Borderless Inline Writing & Narrative Chronicle) */}
            {settings.theme === 'minimalist' && <MinimalistZenLayout {...logListProps} {...quickLogProps} />}

            {/* 2. COMPACT: The Linear High-Density Console (Horizontal Bar + Full Data Table) */}
            {settings.theme === 'compact' && (
              <CompactConsoleLayout
                {...logListProps}
                {...quickLogProps}
                backlog={backlog}
                onToggleTask={handleToggleBacklogTask}
                onConvertTaskToLog={handleConvertTaskToLog}
              />
            )}

            {/* 3. MATRIX CLI: The Retro UNIX Terminal User Interface (CLI Prompt + Tmux Bar) */}
            {settings.theme === 'matrix' && (
              <MatrixTuiLayout
                {...logListProps}
                onAddLog={quickLogProps.onAddLog}
                onOpenDetails={quickLogProps.onOpenDetails}
                backlog={backlog}
                hasGoogleSheetLinked={Boolean(settings.googleScriptUrl)}
                onToggleTask={handleToggleBacklogTask}
                onConvertTaskToLog={handleConvertTaskToLog}
                onOpenAiStandup={() => setIsAiStandupOpen(true)}
              />
            )}

            {/* 4. MODERN SAAS: The Command Dashboard (Interactive 2-Column Split Workspace) */}
            {settings.theme === 'modern' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left 8 Cols: Form & Timeline */}
                <div className="lg:col-span-8 space-y-6">
                  <div ref={loggerRef}>
                    <DailyLogger
                      projects={projects}
                      availableTags={tags}
                      activeTheme={settings.theme}
                      prefillData={prefillLog}
                      onClearPrefill={() => setPrefillLog(null)}
                      editingLog={editingLog}
                      onUpdateLog={handleUpdateLog}
                      onCancelEdit={() => setEditingLog(null)}
                      onAddLog={handleAddLog}
                      onAddProject={handleAddProject}
                      onAddTag={handleAddTag}
                    />
                  </div>

                  <TimelineFeed {...logListProps} />
                </div>

                {/* Right 4 Cols: Consolidated Sticky Command Sidebar */}
                <div className="lg:col-span-4 sticky top-16">
                  <CommandSidebar
                    backlog={backlog}
                    projects={projects}
                    logs={logs}
                    activeTheme={settings.theme}
                    onAddTask={handleAddBacklogTask}
                    onToggleTask={handleToggleBacklogTask}
                    onConvertTaskToLog={handleConvertTaskToLog}
                    onLogWithDetails={handleLogWithDetails}
                    onDeleteTask={handleDeleteBacklogTask}
                    onOpenAiStandup={() => setIsAiStandupOpen(true)}
                  />
                </div>

              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            VIEW 2: PLANNED TASKS FOCUS VIEW & WORKSPACE
           ========================================================================= */}
        {activeTab === 'backlog' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <BacklogSection
              backlog={backlog}
              projects={projects}
              activeTheme={settings.theme}
              onAddTask={tasksHandlers.onAddTask}
              onUpdateTaskStage={tasksHandlers.onUpdateTaskStage}
              onToggleTask={tasksHandlers.onToggleTask}
              onConvertTaskToLog={tasksHandlers.onConvertTaskToLog}
              onLogWithDetails={tasksHandlers.onLogWithDetails}
              onDeleteTask={tasksHandlers.onDeleteTask}
              onAddProject={tasksHandlers.onAddProject}
              onReopenTask={tasksHandlers.onReopenTask}
              onOpenEodSynthesizer={tasksHandlers.onOpenEodSynthesizer}
            />
          </div>
        )}

        {/* =========================================================================
            VIEW 3: VISUAL ANALYTICS & EXPORT
           ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <AnalyticsView
              logs={logs}
              projects={projects}
              onNotify={(msg, type) => addToast(msg, type || 'success')}
            />
          </div>
        )}

        {/* =========================================================================
            VIEW 4: DEDICATED FULL-SCREEN SETTINGS CONSOLE
           ========================================================================= */}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
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

      {/* Mobile Persistent Bottom Tab Bar */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingTasksCount={pendingTasksCount}
      />

      {/* End-of-Day (EOD) AI Log Synthesizer Modal */}
      <EodSynthesizerModal
        isOpen={isEodSynthesizerOpen}
        onClose={() => setIsEodSynthesizerOpen(false)}
        tasksSnapshot={eodTasksSnapshot}
        isCustomSelection={isEodCustomSelection}
        projects={projects}
        activeTheme={settings.theme}
        geminiApiKey={settings.geminiApiKey}
        hasGoogleSheetLinked={Boolean(settings.googleScriptUrl)}
        onConfirmAndPush={handleConfirmEodPush}
        onOpenActivity={() => setIsActivityOpen(true)}
      />

      {/* Activity suggestions: logs suggested from git commits and Claude Code history */}
      <ActivitySuggestionsDialog
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        logs={logs}
        backlog={backlog}
        projects={projects}
        folders={settings.activityFolders ?? []}
        sources={sourcesFromSettings(settings)}
        ai={aiFromSettings(settings)}
        geminiApiKey={settings.geminiApiKey}
        onAddLogs={handleAddLogs}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* AI Standup Modal */}
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

      {/* Global Cmd+K Search Palette */}
      <SearchPaletteModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        logs={logs}
        projects={projects}
        onSelectLog={(log) => {
          setActiveTab('feed');
          setFocusLogId(log.id);
        }}
        onOpenImage={(base64) => setActiveLightboxImage(base64)}
      />

      {/* Proof Lightbox */}
      <LightboxModal
        imageBase64={activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
      />

      {/* Dismissable Toast Notifications */}
      {showEditorDialog && (
        <LogEditorDialog
          projects={projects}
          availableTags={tags}
          activeTheme={settings.theme}
          editingLog={editingLog}
          prefill={prefillLog}
          onAddLog={handleAddLog}
          onUpdateLog={handleUpdateLog}
          onAddProject={handleAddProject}
          onAddTag={handleAddTag}
          onClose={() => {
            setEditingLog(null);
            setPrefillLog(null);
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
