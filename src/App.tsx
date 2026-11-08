import React, { useState, useEffect, useRef } from 'react';
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
  SaveResult,
} from './utils/storage';
import { buildBackup, downloadTextFile } from './utils/backup';
import { loggedSecondsOf, unloggedSeconds } from './utils/taskLogging';
import { advanceClock } from './utils/timer';
import { minutesFromSeconds } from './utils/duration';
import { unsyncedLogs } from './utils/syncStatus';
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
import { EodSynthesizerModal, SynthesizedLogItem } from './components/EodSynthesizerModal';

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
  });

  // Active top navigation tab (now includes 'settings' as dedicated view)
  const [activeTab, setActiveTab] = useState<AppNavTab>('feed');

  // Modals
  const [isAiStandupOpen, setIsAiStandupOpen] = useState(false);
  const [isEodSynthesizerOpen, setIsEodSynthesizerOpen] = useState(false);
  const [eodTasksSnapshot, setEodTasksSnapshot] = useState<BacklogTask[]>([]);
  const [isEodCustomSelection, setIsEodCustomSelection] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  // Sync state
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Reminder banner dismissal
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // Pre-fill log state for "Log with Details"
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
    setToasts((prev) => [...prev, { id, type, message, action }]);
    setTimeout(
      () => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      },
      action ? 6000 : 3500,
    );
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
  const reportSyncFailure = (message: string) =>
    addToast(`Google Sheet sync failed: ${message} Saved locally; click Sync to retry.`, 'error');

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
      colorMode: activeTheme === 'matrix' ? 'dark' : activeMode,
    });

    const todayStr = new Date().toISOString().split('T')[0];
    if (loaded.settings?.lastDismissedReminderDate === todayStr) {
      setReminderDismissed(true);
    }

    setDataLoaded(true);
  }, []);

  // 2. Sync theme & colorMode attributes to HTML root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute(
      'data-mode',
      settings.theme === 'matrix' ? 'dark' : settings.colorMode
    );
  }, [settings.theme, settings.colorMode]);

  // 3. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setActiveLightboxImage(null);
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

  // 4. Persistence Handlers
  const handleThemeChange = (newTheme: ThemeId) => {
    const newMode = newTheme === 'matrix' ? 'dark' : settings.colorMode;
    const updated = { ...settings, theme: newTheme, colorMode: newMode };
    setSettings(updated);
    saveSettings(updated);
    addToast(`Layout switched to ${newTheme.toUpperCase()}`, 'info');
  };

  const handleColorModeChange = (newMode: ColorMode) => {
    if (settings.theme === 'matrix') return;
    const updated = { ...settings, colorMode: newMode };
    setSettings(updated);
    saveSettings(updated);
    addToast(`Mode: ${newMode.toUpperCase()}`, 'info');
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
    if (saveLogs(updated).ok) addToast('Work log recorded successfully!');

    if (settings.googleScriptUrl) {
      syncSingleLogToSheet(settings.googleScriptUrl, newLog).then((res) => {
        if (res.success) {
          markLogsSynced([newLog.id]);
          addToast('Synced with Google Sheet ✓', 'success');
        } else {
          reportSyncFailure(res.message);
        }
      });
    }
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
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      createdAt: new Date().toISOString(),
    };
    const updated = [duplicated, ...logs];
    setLogs(updated);
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
      dueDate: new Date().toISOString().split('T')[0],
      completed: stage === 'done',
      stage,
      originalDate: new Date().toISOString().split('T')[0],
      isRolledOver: false,
      startedAt: stage === 'in_progress' ? new Date().toISOString() : undefined,
    };
    const updated = [newTask, ...backlog];
    setBacklog(updated);
    saveBacklog(updated);
    addToast(
      stage === 'in_progress'
        ? 'Task added directly to Active Focus! ⚡'
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
      // Mark task as done and convert to official work log with Google Sheets sync
      handleConvertTaskToLog(task);
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
      addToast(`"${task.title.slice(0, 32)}..." set to Active Focus`, 'success');
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
    addToast('Task reopened and moved to Active Focus', 'info');
  };

  const handleToggleBacklogTask = (taskId: string) => {
    const task = backlog.find((t) => t.id === taskId);
    if (!task) return;

    if (task.completed || task.stage === 'done') {
      handleReopenTask(taskId, 'planned');
    } else {
      handleConvertTaskToLog(task);
    }
  };

  const handleConvertTaskToLog = (task: BacklogTask) => {
    const project = projects.find((p) => p.id === task.projectId) || projects[0];
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
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
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
          reportSyncFailure(res.message);
        }
      });
    }
  };

  // EOD AI Synthesizer Push Handler
  const handleConfirmEodPush = async (items: SynthesizedLogItem[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newLogs: WorkLog[] = items.map((item) => ({
      id: `log-eod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: todayStr,
      time: new Date().toTimeString().slice(0, 5),
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
        reportSyncFailure(res.message);
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
        `workpulse-pre-reset-${new Date().toISOString().split('T')[0]}.json`,
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

  const handleImportBackup = (data: BackupData) => {
    // Keep this machine's API key; backups never contain one.
    const result = replaceAllData({ ...data, settings: { ...data.settings, geminiApiKey: settings.geminiApiKey } });
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
      reportSyncFailure(result.message);
    }
  };

  const handleDismissReminder = () => {
    setReminderDismissed(true);
    const todayStr = new Date().toISOString().split('T')[0];
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

  const todayStr = new Date().toISOString().split('T')[0];
  const hasLogsToday = logs.some((l) => l.date === todayStr);
  const pendingTasksCount = backlog.filter((t) => !t.completed && t.stage !== 'done').length;

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
        INITIALIZING WORKPULSE OS...
      </div>
    );
  }

  return (
    <div
      data-theme={settings.theme}
      data-mode={settings.theme === 'matrix' ? 'dark' : settings.colorMode}
      className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] transition-all antialiased selection:bg-[var(--accent)] selection:text-white pb-20 md:pb-6"
    >
      {/* Top Bar Navigation */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTheme={settings.theme}
        colorMode={settings.colorMode}
        onColorModeChange={handleColorModeChange}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAiStandup={() => setIsAiStandupOpen(true)}
        hasGoogleSheetLinked={Boolean(settings.googleScriptUrl)}
        onSyncGoogleSheet={handleSyncGoogleSheet}
        unsyncedCount={
          settings.googleScriptUrl ? unsyncedLogs(logs, settings.syncTrackingSince).length : 0
        }
        isSyncing={isSyncingSheet}
      />

      {/* Main Viewport Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* 5:00 PM End of Day Reminder Banner */}
        <ReminderBanner
          hasLogsToday={hasLogsToday}
          isDismissed={reminderDismissed}
          onDismiss={handleDismissReminder}
          onScrollToLogger={() => {
            loggerRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* =========================================================================
            VIEW 1: TIMELINE FEED & DAILY LOGGING (UNIQUE PER THEME)
           ========================================================================= */}
        {activeTab === 'feed' && (
          <div>
            {/* 1. MINIMALIST: The Zen Notebook (Borderless Inline Writing & Narrative Chronicle) */}
            {settings.theme === 'minimalist' && (
              <MinimalistZenLayout
                logs={logs}
                projects={projects}
                availableTags={tags}
                onAddLog={handleAddLog}
                onDeleteLog={handleDeleteLog}
                onDuplicateLog={handleDuplicateLog}
                onOpenImage={(base64) => setActiveLightboxImage(base64)}
                onCopyText={(text) => {
                  navigator.clipboard.writeText(text);
                  addToast('Copied to clipboard!');
                }}
              />
            )}

            {/* 2. COMPACT: The Linear High-Density Console (Horizontal Bar + Full Data Table) */}
            {settings.theme === 'compact' && (
              <CompactConsoleLayout
                logs={logs}
                backlog={backlog}
                projects={projects}
                availableTags={tags}
                onAddLog={handleAddLog}
                onDeleteLog={handleDeleteLog}
                onDuplicateLog={handleDuplicateLog}
                onOpenImage={(base64) => setActiveLightboxImage(base64)}
                onCopyText={(text) => {
                  navigator.clipboard.writeText(text);
                  addToast('Copied to clipboard!');
                }}
                onToggleTask={handleToggleBacklogTask}
                onConvertTaskToLog={handleConvertTaskToLog}
              />
            )}

            {/* 3. MATRIX CLI: The Retro UNIX Terminal User Interface (CLI Prompt + Tmux Bar) */}
            {settings.theme === 'matrix' && (
              <MatrixTuiLayout
                logs={logs}
                backlog={backlog}
                projects={projects}
                hasGoogleSheetLinked={Boolean(settings.googleScriptUrl)}
                onAddLog={handleAddLog}
                onDeleteLog={handleDeleteLog}
                onDuplicateLog={handleDuplicateLog}
                onCopyText={(text) => {
                  navigator.clipboard.writeText(text);
                  addToast('Copied to clipboard!');
                }}
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
                      onAddLog={handleAddLog}
                      onAddProject={handleAddProject}
                      onAddTag={handleAddTag}
                    />
                  </div>

                  <TimelineFeed
                    logs={logs}
                    projects={projects}
                    activeTheme={settings.theme}
                    onEditLog={(log) => addToast(`Focused: ${log.projectName}`, 'info')}
                    onDeleteLog={handleDeleteLog}
                    onDuplicateLog={handleDuplicateLog}
                    onOpenImage={(base64) => setActiveLightboxImage(base64)}
                    selectedLogIds={selectedLogIds}
                    onToggleSelectLog={handleToggleSelectLog}
                    onSelectAllVisible={(ids) => setSelectedLogIds(ids)}
                    onClearSelection={() => setSelectedLogIds([])}
                    onOpenAiStandupWithSelected={() => setIsAiStandupOpen(true)}
                    onCopyText={(text) => {
                      navigator.clipboard.writeText(text);
                      addToast('Copied to clipboard!');
                    }}
                    onOpenEodSynthesizer={handleOpenEodSynthesizer}
                  />
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
              onAddTask={handleAddBacklogTask}
              onUpdateTaskStage={handleUpdateTaskStage}
              onToggleTask={handleToggleBacklogTask}
              onConvertTaskToLog={handleConvertTaskToLog}
              onLogWithDetails={handleLogWithDetails}
              onDeleteTask={handleDeleteBacklogTask}
              onAddProject={handleAddProject}
              onReopenTask={handleReopenTask}
              onOpenEodSynthesizer={handleOpenEodSynthesizer}
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
              onNotify={(msg) => addToast(msg, 'success')}
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
      />

      {/* AI Standup Modal */}
      <AiStandupModal
        isOpen={isAiStandupOpen}
        onClose={() => setIsAiStandupOpen(false)}
        logs={logs}
        selectedLogIds={selectedLogIds}
        geminiApiKey={settings.geminiApiKey}
        defaultTone={settings.defaultTone}
        onCopySuccess={() => addToast('Standup report copied to clipboard! 🎉')}
      />

      {/* Global Cmd+K Search Palette */}
      <SearchPaletteModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        logs={logs}
        projects={projects}
        onSelectLog={(log) => addToast(`Viewing log: ${log.projectName}`, 'info')}
        onOpenImage={(base64) => setActiveLightboxImage(base64)}
      />

      {/* Proof Lightbox */}
      <LightboxModal
        imageBase64={activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
      />

      {/* Dismissable Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
