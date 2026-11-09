import React, { useState } from 'react';
import { localDateStr } from '../utils/dates';
import {
  Project,
  ThemeId,
  ColorMode,
  AppSettings,
  WorkLog,
  BacklogTask,
  ReportTone,
  BackupData,
  ToastMessage,
} from '../types';
import { parseBackup } from '../utils/backup';
import { ActivityFoldersSettings } from './activity/ActivityFoldersSettings';
import { activityFieldsFromSources, aiField, aiFromSettings, sourcesFromSettings } from '../utils/activity/settings';
import type { ActivityAi, ActivityFolder, ActivitySources } from '../utils/activity/types';
import { backupStatus, describeBackupAge } from '../utils/backupReminder';
import { findMisdatedLogs, DateFix } from '../utils/logDates';
import { toCsv } from '../utils/csv';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptTemplate';
import { testSheetConnection } from '../utils/sheetsSync';
import {
  Activity,
  Palette,
  Cloud,
  MessageSquareText,
  Layers,
  Database,
  Sun,
  Moon,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
  Archive,
  Download,
  Upload,
  Eye,
  EyeOff,
  FolderPlus,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  projects: Project[];
  onUpdateProjects: (projects: Project[]) => void;
  tags: string[];
  onUpdateTags: (tags: string[]) => void;
  logs: WorkLog[];
  backlog: BacklogTask[];
  onResetSeedData: () => void;
  onImportBackup: (data: BackupData) => void;
  onBackupNow: () => void;
  onFixLogDates: (fixes: DateFix[]) => void;
  onStartFresh: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info', action?: ToastMessage['action']) => void;
}

type SettingsSection = 'appearance' | 'sheets' | 'ai' | 'projects' | 'activity' | 'data';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  projects,
  onUpdateProjects,
  tags,
  onUpdateTags,
  logs,
  backlog,
  onResetSeedData,
  onImportBackup,
  onBackupNow,
  onFixLogDates,
  onStartFresh,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');

  // Appearance state
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(settings.theme);
  const [selectedColorMode, setSelectedColorMode] = useState<ColorMode>(settings.colorMode || 'dark');
  const [selectedCrt, setSelectedCrt] = useState<boolean>(settings.crtEffect === true);

  // Google Sheets state
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(settings.googleScriptUrl || '');
  const [isTestingSheet, setIsTestingSheet] = useState<boolean>(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showScriptCode, setShowScriptCode] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // AI & Comms state
  const [geminiApiKey, setGeminiApiKey] = useState<string>(settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [defaultTone, setDefaultTone] = useState<ReportTone>(settings.defaultTone || 'casual');
  const [defaultRecipientName, setDefaultRecipientName] = useState<string>(settings.defaultRecipientName || '');

  // Project management inputs
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectColor, setNewProjectColor] = useState<string>('#6366f1');
  const [newTagInput, setNewTagInput] = useState<string>('');

  // Activity suggestions state
  const [activityFolders, setActivityFolders] = useState<ActivityFolder[]>(settings.activityFolders ?? []);
  const [activitySources, setActivitySources] = useState<ActivitySources>(sourcesFromSettings(settings));
  const [activityAi, setActivityAi] = useState<ActivityAi>(aiFromSettings(settings));

  const handleSaveAll = () => {
    const updated: AppSettings = {
      ...settings,
      theme: selectedTheme,
      // Matrix is always dark on screen, but the person's own light or dark choice is kept for when they leave it.
      colorMode: selectedColorMode,
      crtEffect: selectedCrt,
      googleScriptUrl: googleScriptUrl.trim(),
      geminiApiKey: geminiApiKey.trim(),
      defaultTone,
      defaultRecipientName: defaultRecipientName.trim() || undefined,
      activityFolders: activityFolders.length > 0 ? activityFolders : undefined,
      ...activityFieldsFromSources(activitySources),
      activityAi: aiField(activityAi),
    };
    onSaveSettings(updated);
    onNotify('All settings successfully saved!', 'success');
  };

  const handleTestSheet = async () => {
    if (!googleScriptUrl.trim()) {
      setSheetTestResult({
        success: false,
        message: 'Please enter a valid Google Apps Script Web App URL first.',
      });
      return;
    }
    setIsTestingSheet(true);
    setSheetTestResult(null);

    const result = await testSheetConnection(googleScriptUrl.trim());
    setIsTestingSheet(false);
    setSheetTestResult(result);
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    onNotify('Apps Script code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      color: newProjectColor,
      isArchived: false,
    };
    onUpdateProjects([...projects, newProj]);
    setNewProjectName('');
    onNotify(`Project "${newProj.name}" created.`, 'success');
  };

  const handleToggleArchiveProject = (id: string) => {
    const updated = projects.map((p) => (p.id === id ? { ...p, isArchived: !p.isArchived } : p));
    onUpdateProjects(updated);
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      alert('You must keep at least one active project.');
      return;
    }
    const updated = projects.filter((p) => p.id !== id);
    onUpdateProjects(updated);
    onNotify('Project removed', 'info', { label: 'Undo', onClick: () => onUpdateProjects(projects) });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = newTagInput.trim();
    if (!cleaned) return;
    if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
    if (tags.includes(cleaned)) return;
    onUpdateTags([...tags, cleaned]);
    setNewTagInput('');
    onNotify(`Tag "${cleaned}" added.`, 'success');
  };

  const handleDeleteTag = (t: string) => {
    onUpdateTags(tags.filter((item) => item !== t));
  };

  const lastBackup = describeBackupAge(backupStatus(settings.lastBackupAt, logs, backlog).days);

  const misdatedLogs = React.useMemo(() => findMisdatedLogs(logs), [logs]);

  const handleFixDates = () => {
    const examples = misdatedLogs
      .slice(0, 5)
      .map((f) => `${f.from} -> ${f.to}: ${f.description.slice(0, 40)}`)
      .join('\n');
    if (
      window.confirm(
        `Move ${misdatedLogs.length} log(s) to the correct local date?\n\n${examples}${
          misdatedLogs.length > 5 ? '\n...' : ''
        }\n\nOnly the date changes. A backup file of your current data is downloaded first.`,
      )
    ) {
      onFixLogDates(misdatedLogs);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      onNotify(`Import failed: ${result.error}`, 'error');
      return;
    }
    const d = result.data;
    if (
      window.confirm(
        `Replace ALL current data with this backup?

${d.logs.length} logs, ${d.backlog.length} tasks, ${d.projects.length} projects, ${d.tags.length} tags.

Your current Gemini API key is kept. Export a backup first if you want to keep your current data.`,
      )
    ) {
      onImportBackup(d);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const csv = toCsv([
      ['ID', 'Date', 'Time', 'Project', 'Description', 'Status', 'Tags', 'Link', 'Duration_Mins', 'Energy_Rating'],
      ...logs.map((l) => [
        l.id,
        l.date,
        l.time,
        l.projectName,
        l.description,
        l.status,
        l.tags.join(' '),
        l.linkUrl || '',
        l.durationMinutes || 0,
        l.energyRating || 0,
      ]),
    ]);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workpulse-logs-${localDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Exported CSV spreadsheet', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border-app)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Theme, Google Sheet, standup writing, projects and your data.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="px-5 py-2.5 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>Save All Settings</span>
        </button>
      </div>

      {/* Main Settings Grid: Left Sidebar Tabs + Right Pane */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Navigation Tabs (Sidebar on Desktop, Horizontal Pills on Mobile) */}
        <div className="md:col-span-3 glass-panel p-2 space-y-1 overflow-x-auto flex md:flex-col shrink-0">
          {[
            { id: 'appearance' as SettingsSection, label: 'Appearance & Themes', icon: <Palette className="w-4 h-4" /> },
            { id: 'sheets' as SettingsSection, label: 'Google Sheets Sync', icon: <Cloud className="w-4 h-4" /> },
            { id: 'ai' as SettingsSection, label: 'Standup & AI', icon: <MessageSquareText className="w-4 h-4" /> },
            { id: 'projects' as SettingsSection, label: 'Projects & Tags', icon: <Layers className="w-4 h-4" /> },
            { id: 'activity' as SettingsSection, label: 'Activity suggestions', icon: <Activity className="w-4 h-4" /> },
            { id: 'data' as SettingsSection, label: 'Data & Backup', icon: <Database className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-[var(--radius-btn)] transition-all whitespace-nowrap cursor-pointer ${
                activeSection === item.id
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-control)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <span className={activeSection === item.id ? 'text-[var(--accent-text)]' : ''}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Content Pane */}
        <div className="md:col-span-9 glass-panel p-5 sm:p-6 space-y-6">
          
          {/* =========================================================================
              SECTION 1: APPEARANCE & THEMES
             ========================================================================= */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Appearance
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Pick a theme and a light or dark mode. Press Save All Settings to keep them.
                </p>
              </div>

              {/* 4 Theme Cards */}
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  {
                    id: 'modern' as ThemeId,
                    name: 'Modern',
                    desc: 'Flat panels and one teal signal colour. The log form and your tasks sit side by side.',
                    font: 'Instrument Sans',
                    swatch: '#14b8a6',
                  },
                  {
                    id: 'minimalist' as ThemeId,
                    name: 'Minimalist',
                    desc: 'Paper and ink. A serif for headings, no brand colour, entries as lines in a ledger.',
                    font: 'Literata',
                    swatch: '#37352f',
                  },
                  {
                    id: 'compact' as ThemeId,
                    name: 'Compact',
                    desc: 'A dense table you can drive from the keyboard: j and k to move, e to edit.',
                    font: 'IBM Plex Sans',
                    swatch: '#2563eb',
                  },
                  {
                    id: 'matrix' as ThemeId,
                    name: 'Matrix',
                    desc: 'A terminal. Green on black, one monospace face, commands instead of forms.',
                    font: 'JetBrains Mono',
                    swatch: '#00ff66',
                  },
                ].map((th, thIndex, themeList) => {
                  const isSelected = selectedTheme === th.id;
                  const pickTheme = (id: ThemeId) => {
                    setSelectedTheme(id);
                  };

                  return (
                    <div
                      key={th.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => pickTheme(th.id)}
                      onKeyDown={(e) => {
                        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                        if (step) {
                          e.preventDefault();
                          const next = themeList[(thIndex + step + themeList.length) % themeList.length];
                          pickTheme(next.id);
                          (e.currentTarget.parentElement?.children[(thIndex + step + themeList.length) % themeList.length] as HTMLElement | undefined)?.focus();
                        } else if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          pickTheme(th.id);
                        }
                      }}
                      className={`p-4 rounded-[var(--radius-card)] border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--bg-surface)]'
                          : 'border-[var(--border-app)] bg-[var(--bg-subtle)]/40 hover:border-[var(--border-focus)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-xs sm:text-sm text-[var(--text-main)]">
                          {th.name}
                        </span>
                        <span
                          className="text-2xl leading-none text-[var(--text-main)]"
                          style={{ fontFamily: `'${th.font}', sans-serif` }}
                          aria-hidden="true"
                        >
                          Aa
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {th.desc}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono border-t border-[var(--border-app)] pt-2">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full border border-[var(--border-control)]" style={{ backgroundColor: th.swatch }} aria-hidden="true" />
                          {th.font}
                        </span>
                        {isSelected && <span className="font-semibold text-[var(--accent-text)]">Selected</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Independent Color Mode Toggle */}
              <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-main)]">
                      Light or dark
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {selectedTheme === 'matrix'
                        ? 'Matrix is always dark. Your light or dark choice comes back when you switch theme.'
                        : 'Works with any theme except Matrix.'}
                    </p>
                  </div>

                  {selectedTheme !== 'matrix' ? (
                    <div className="flex items-center gap-1 p-1 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-app)]">
                      <button
                        type="button"
                        onClick={() => setSelectedColorMode('light')}
                        className={`px-3 py-1.5 rounded-[var(--radius-btn)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          selectedColorMode === 'light'
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Light</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedColorMode('dark')}
                        className={`px-3 py-1.5 rounded-[var(--radius-btn)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          selectedColorMode === 'dark'
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Dark</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-success font-semibold px-2.5 py-1 rounded bg-[var(--bg-app)] border border-success">
                      Always dark
                    </span>
                  )}
                </div>
              </div>

              {selectedTheme === 'matrix' && (
                <label className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCrt}
                    onChange={(e) => setSelectedCrt(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--accent)] cursor-pointer"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text-main)]">Scanlines</span>
                    <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                      Draws CRT scanlines over the screen. Off by default because they make small text harder to read.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          {/* =========================================================================
              SECTION 2: CLOUD SYNC (GOOGLE SHEETS)
             ========================================================================= */}
          {activeSection === 'sheets' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Google Sheet
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Send your logs to the shared Google Sheet your lead reads. Only new and edited logs are sent.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[var(--text-main)]">
                  Google Apps Script Web App Deployment URL:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={googleScriptUrl}
                    onChange={(e) => setGoogleScriptUrl(e.target.value)}
                    aria-label="Google Apps Script web app URL"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 text-xs font-mono text-[var(--text-main)] focus:border-[var(--border-focus)]"
                  />
                  <button
                    type="button"
                    onClick={handleTestSheet}
                    disabled={isTestingSheet || !googleScriptUrl.trim()}
                    className="px-4 py-2 rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold shadow-xs hover:bg-[var(--accent-hover)] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isTestingSheet ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <span>Test Connection</span>
                    )}
                  </button>
                </div>

                {sheetTestResult && (
                  <div
                    className={`p-3 rounded-[var(--radius-btn)] text-xs border ${
                      sheetTestResult.success
                        ? 'bg-success/10 border-success/30 text-success'
                        : 'bg-danger/10 border-danger/30 text-danger'
                    }`}
                  >
                    <p className="font-bold flex items-center gap-1.5">
                      {sheetTestResult.success ? (
                        <>
                          <Check className="w-4 h-4 text-success shrink-0" />
                          <span>Connection Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                          <span>Connection Error</span>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 opacity-90">{sheetTestResult.message}</p>
                  </div>
                )}
              </div>

              {/* Instructions and Apps Script Code View */}
              <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Google Apps Script Code Template
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="px-3 py-1 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-control)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Open your Google Sheet, navigate to <strong>Extensions &gt; Apps Script</strong>, paste the code below, and deploy as a Web App with access set to <em>"Anyone"</em>.
                </p>

                <div className="bg-neutral-950 text-neutral-200 rounded-md p-3 text-xs font-mono max-h-48 overflow-y-auto border border-neutral-800">
                  <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              SECTION 3: AI & COMMUNICATIONS
             ========================================================================= */}
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Standup and AI
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Your Gemini key, the default tone and who the standup is addressed to. Without a key, standups use a template.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[var(--text-main)]">
                  Custom Gemini API Key (Optional):
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    aria-label="Gemini API key"
                    placeholder="AIzaSy... (leave blank to use server environment key)"
                    className="w-full bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 pr-10 text-xs font-mono text-[var(--text-main)] focus:border-[var(--border-focus)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Stored securely in your browser's encrypted local storage. If blank, WorkPulse uses the server's attached key.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-main)]">
                    Default Tone of Voice:
                  </label>
                  <select
                    value={defaultTone}
                    onChange={(e) => setDefaultTone(e.target.value as ReportTone)}
                    className="w-full bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 text-xs text-[var(--text-main)]"
                  >
                    <option value="casual" className="bg-[var(--bg-surface)]">Casual & Direct (Agile Standup)</option>
                    <option value="corporate" className="bg-[var(--bg-surface)]">Formal Corporate (Stakeholders)</option>
                    <option value="bullet" className="bg-[var(--bg-surface)]">Brief / Bullet-only (High Velocity)</option>
                    <option value="client" className="bg-[var(--bg-surface)]">Client-Facing (Deliverables Focus)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-main)]">
                    Default Superior / Lead Name:
                  </label>
                  <input
                    type="text"
                    value={defaultRecipientName}
                    onChange={(e) => setDefaultRecipientName(e.target.value)}
                    aria-label="Your name and role"
                    placeholder="e.g. Alex, Tech Lead, Engineering Team"
                    className="w-full bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 text-xs text-[var(--text-main)]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              SECTION 4: PROJECTS & TAGS
             ========================================================================= */}
          {activeSection === 'projects' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Projects and tags
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Add, archive and colour projects. Manage the tags you can attach to a log.
                </p>
              </div>

              {/* Add Project Form */}
              <form onSubmit={handleAddProject} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  aria-label="New project name"
                  placeholder="New project name..."
                  className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-2 text-xs text-[var(--text-main)]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newProjectColor}
                    onChange={(e) => setNewProjectColor(e.target.value)}
                    className="w-9 h-9 rounded border-0 cursor-pointer"
                    title="Marker Color"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Project</span>
                  </button>
                </div>
              </form>

              {/* Projects Table */}
              <div className="border border-[var(--border-app)] rounded-[var(--radius-card)] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-subtle)]/70 text-[var(--text-muted)] uppercase font-semibold text-xs border-b border-[var(--border-app)]">
                    <tr>
                      <th className="p-3">Color</th>
                      <th className="p-3">Project Name</th>
                      <th className="p-3">Logged Work</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-app)]">
                    {projects.map((p) => {
                      const count = logs.filter((l) => l.projectId === p.id).length;
                      return (
                        <tr key={p.id} className="hover:bg-[var(--bg-subtle)]/30">
                          <td className="p-3">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                          </td>
                          <td className="p-3 font-semibold text-[var(--text-main)]">
                            {p.name} {p.isArchived && <span className="text-xs text-warning font-mono">(Archived)</span>}
                          </td>
                          <td className="p-3 text-[var(--text-muted)] font-mono tabular-nums">
                            {count} logs recorded
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleArchiveProject(p.id)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                                title={p.isArchived ? 'Unarchive' : 'Archive'}
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(p.id)}
                                className="p-1 text-[var(--text-muted)] hover:text-danger cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tag Management */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Category Tags
                </span>
                <form onSubmit={handleAddTag} className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    aria-label="New custom tag"
                    placeholder="Add custom tag (e.g. #deep-work)..."
                    className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3 py-1.5 text-xs text-[var(--text-main)]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold cursor-pointer"
                  >
                    Add Tag
                  </button>
                </form>

                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-app)] text-xs text-[var(--text-main)] font-mono"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(t)}
                        className="text-[var(--text-muted)] hover:text-danger cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              SECTION 5: ACTIVITY SUGGESTIONS
             ========================================================================= */}
          {activeSection === 'activity' && (
            <ActivityFoldersSettings
              folders={activityFolders}
              sources={activitySources}
              ai={activityAi}
              projects={projects}
              onChange={(folders, sources, ai) => {
                setActivityFolders(folders);
                setActivitySources(sources);
                setActivityAi(ai);
              }}
            />
          )}

          {/* =========================================================================
              SECTION 6: DATA & BACKUP
             ========================================================================= */}
          {activeSection === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Your data
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Back up, export a CSV timesheet, or clear everything. Data lives only in this browser.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] space-y-2.5">
                  <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Export Full JSON Backup
                  </span>
                  <p className="text-xs text-[var(--text-muted)]">
                    Contains all work logs, tasks, projects, tags, and settings (never your Gemini API key). Importing replaces all current data.
                  </p>
                  <p className="text-xs font-semibold text-[var(--text-main)]" data-testid="last-backup">
                    {lastBackup}
                  </p>
                  <button
                    onClick={onBackupNow}
                    className="px-3.5 py-2 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-control)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                  <label className="px-3.5 py-2 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-app)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-main)] inline-flex items-center gap-1.5 transition-all cursor-pointer ml-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import JSON Backup</span>
                    <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
                  </label>
                </div>

                <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] space-y-2.5">
                  <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Export CSV Spreadsheet
                  </span>
                  <p className="text-xs text-[var(--text-muted)]">
                    Compatible with Excel, Google Sheets, Numbers, or data science notebooks.
                  </p>
                  <button
                    onClick={handleExportCSV}
                    className="px-3.5 py-2 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-control)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Logs</span>
                  </button>
                </div>
              </div>

              {misdatedLogs.length > 0 && (
                <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] space-y-2.5">
                  <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Fix Log Dates ({misdatedLogs.length})
                  </span>
                  <p className="text-xs text-[var(--text-muted)]">
                    {misdatedLogs.length} log(s) made between 00:00 and 06:00 local time were filed under the previous day
                    (older versions used the UTC date). Move them to the day you actually worked. Nothing changes until you confirm.
                  </p>
                  <button
                    type="button"
                    onClick={handleFixDates}
                    className="px-3.5 py-2 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-control)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-main)] transition-all cursor-pointer"
                  >
                    Review and fix dates
                  </button>
                </div>
              )}

              <div className="p-4 rounded-[var(--radius-card)] border border-danger/20 bg-danger/5 space-y-2">
                <span className="text-xs font-bold text-danger uppercase tracking-wider">
                  Start Fresh
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  Remove the demo logs, tasks and projects and start with an empty workspace and one "General" project.
                  Settings stay. A backup file is downloaded first.
                </p>
                <button
                  type="button"
                  onClick={onStartFresh}
                  className="px-3.5 py-1.5 rounded-[var(--radius-btn)] bg-danger-solid hover:bg-danger-solid-hover text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Start with empty data
                </button>
              </div>

              <div className="p-4 rounded-[var(--radius-card)] border border-danger/20 bg-danger/5 space-y-2">
                <span className="text-xs font-bold text-danger uppercase tracking-wider">
                  Reset Data
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  Replaces logs, tasks, projects and tags with the demo data. A backup file is downloaded first.
                </p>
                <button
                  type="button"
                  onClick={onResetSeedData}
                  className="px-3.5 py-1.5 rounded-[var(--radius-btn)] bg-danger-solid hover:bg-danger-solid-hover text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Reset to Seed Preset
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
