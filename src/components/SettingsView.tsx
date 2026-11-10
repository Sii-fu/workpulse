import React, { useEffect, useId, useRef, useState } from 'react';
import { localDateStr } from '../utils/dates';
import {
  Project,
  AppSettings,
  WorkLog,
  BacklogTask,
  ReportTone,
  BackupData,
  ToastMessage,
} from '../types';
import { parseBackup } from '../utils/backup';
import { ActivityFoldersSettings } from './activity/ActivityFoldersSettings';
import { ThemePicker } from './v2/settings/ThemePicker';
import { ProjectsSection } from './v2/settings/ProjectsSection';
import { IconButton } from './ui/IconButton';
import { normalizeTheme, type V2ThemeId } from '../utils/theme';
import { activityFieldsFromSources, aiField, aiFromSettings, sourcesFromSettings } from '../utils/activity/settings';
import type { ActivityAi, ActivityFolder, ActivitySources } from '../utils/activity/types';
import { backupStatus, describeBackupAge } from '../utils/backupReminder';
import { findMisdatedLogs, DateFix } from '../utils/logDates';
import { logsToCsv } from '../utils/exportLogs';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptTemplate';
import { testSheetConnection } from '../utils/sheetsSync';
import { Check, Copy, Loader2, Download, Upload, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  /** Applies at once; the caller stores it. */
  onThemeChange: (theme: V2ThemeId) => void;
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

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'office', label: 'Office day' },
  { id: 'projects', label: 'Projects & tags' },
  { id: 'sheet', label: 'Google Sheet' },
  { id: 'ai', label: 'AI' },
  { id: 'activity', label: 'Activity suggestions' },
  { id: 'data', label: 'Data & backup' },
  { id: 'sample', label: 'Sample data' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const DEFAULT_WORKDAY_HOURS = 8;

const LABEL = 'block mb-1 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)]';
const FIELD = 'v2-input w-full h-11 px-3 text-[length:var(--fs-body)]';
const BTN =
  'v2-btn inline-flex items-center justify-center gap-1.5 min-h-11 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const DANGER_BTN =
  'inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--radius-btn)] bg-danger-solid hover:bg-danger-solid-hover text-white text-[length:var(--fs-small)] font-semibold cursor-pointer';
const HINT = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';

const Section: React.FC<{ id: SectionId; title: string; intro?: string; children: React.ReactNode }> = ({
  id,
  title,
  intro,
  children,
}) => (
  <section id={`settings-${id}`} aria-labelledby={`settings-${id}-h`} className="scroll-mt-24">
    <h2 id={`settings-${id}-h`} tabIndex={-1} className="v2-head">
      <span>{title}</span>
    </h2>
    <div className="flex flex-col gap-5">
      {intro && <p className={HINT}>{intro}</p>}
      {children}
    </div>
  </section>
);

// One action in Data & backup or Sample data: what it does, then the button.
const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col items-start gap-2 border-t border-[var(--border-app)] pt-5 first:border-t-0 first:pt-0">
    <h3 className="text-[length:var(--fs-body)] font-bold text-[var(--text-main)]">{title}</h3>
    {children}
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onThemeChange,
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
  const uid = useId();
  const [current, setCurrent] = useState<SectionId>('appearance');
  const importRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);

  // Office day state
  const [workdayHours, setWorkdayHours] = useState<string>(String(settings.workdayHours ?? DEFAULT_WORKDAY_HOURS));
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Google Sheets state
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(settings.googleScriptUrl || '');
  const [isTestingSheet, setIsTestingSheet] = useState<boolean>(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // AI state
  const [geminiApiKey, setGeminiApiKey] = useState<string>(settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [defaultTone, setDefaultTone] = useState<ReportTone>(settings.defaultTone || 'casual');
  const [defaultRecipientName, setDefaultRecipientName] = useState<string>(settings.defaultRecipientName || '');

  // Activity suggestions state
  const [activityFolders, setActivityFolders] = useState<ActivityFolder[]>(settings.activityFolders ?? []);
  const [activitySources, setActivitySources] = useState<ActivitySources>(sourcesFromSettings(settings));
  const [activityAi, setActivityAi] = useState<ActivityAi>(aiFromSettings(settings));

  // The anchor list marks the section that is at the top of the screen.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Infinity);
        const first = SECTIONS.find((s) => (seen.get(`settings-${s.id}`) ?? Infinity) !== Infinity);
        if (first) setCurrent(first.id);
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`settings-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const goTo = (id: SectionId) => {
    const el = document.getElementById(`settings-${id}`);
    if (!el) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    document.getElementById(`settings-${id}-h`)?.focus({ preventScroll: true });
    setCurrent(id);
  };

  const handleSaveAll = () => {
    const hours = Number(workdayHours);
    if (!workdayHours.trim() || !Number.isFinite(hours) || hours < 1 || hours > 16) {
      setHoursError('Enter the hours in your workday as a number from 1 to 16.');
      hoursRef.current?.focus();
      return;
    }
    setHoursError(null);
    const updated: AppSettings = {
      ...settings,
      workdayHours: hours,
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
    const csv = logsToCsv(logs);

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
    <div className="mx-auto max-w-[1040px] px-4 sm:px-8 py-6 sm:py-7">
      <h1 className="sr-only">Settings</h1>
      <div className="grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#settings-${s.id}`}
                  aria-current={current === s.id ? 'location' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(s.id);
                  }}
                  className={`block min-h-9 rounded-[var(--radius-btn)] px-3 py-2 text-[length:var(--fs-small)] font-semibold ${
                    current === s.id
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-main)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 max-w-[44rem] flex-col gap-10">
          <Section id="appearance" title="Appearance" intro="Pick how WorkPulse looks. It changes as soon as you choose.">
            <ThemePicker value={normalizeTheme(settings.theme)} onChange={onThemeChange} />
          </Section>

          <Section
            id="office"
            title="Office day"
            intro="How long your workday is. The clock at the top counts toward it, and History draws it as a target line."
          >
            <div>
              <label htmlFor={`${uid}-hours`} className={LABEL}>
                Hours in your workday
              </label>
              <input
                ref={hoursRef}
                id={`${uid}-hours`}
                type="number"
                inputMode="decimal"
                min={1}
                max={16}
                step={0.5}
                value={workdayHours}
                onChange={(e) => {
                  setWorkdayHours(e.target.value);
                  setHoursError(null);
                }}
                aria-invalid={hoursError ? true : undefined}
                aria-describedby={hoursError ? `${uid}-hours-err` : undefined}
                className={`${FIELD} num !w-28`}
              />
              {hoursError && (
                <p id={`${uid}-hours-err`} role="alert" className="mt-1 text-[length:var(--fs-small)] text-danger">
                  {hoursError}
                </p>
              )}
            </div>
          </Section>

          <Section id="projects" title="Projects & tags">
            <ProjectsSection
              projects={projects}
              tags={tags}
              onUpdateProjects={onUpdateProjects}
              onUpdateTags={onUpdateTags}
            />
          </Section>

          <Section
            id="sheet"
            title="Google Sheet"
            intro="Send your logs to the shared Google Sheet your lead reads. Only new and edited logs are sent."
          >
            <div>
              <label htmlFor={`${uid}-sheet`} className={LABEL}>
                Google Apps Script web app URL
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${uid}-sheet`}
                  type="url"
                  value={googleScriptUrl}
                  onChange={(e) => setGoogleScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  autoComplete="off"
                  className={`${FIELD} flex-1 font-mono`}
                />
                <button
                  type="button"
                  onClick={handleTestSheet}
                  disabled={isTestingSheet || !googleScriptUrl.trim()}
                  className={`${BTN} shrink-0`}
                >
                  {isTestingSheet ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Testing…</span>
                    </>
                  ) : (
                    <span>Test connection</span>
                  )}
                </button>
              </div>
            </div>

            {sheetTestResult && (
              <div
                role="status"
                className={`rounded-[var(--radius-btn)] border p-3 text-[length:var(--fs-small)] ${
                  sheetTestResult.success
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-danger/30 bg-danger/10 text-danger'
                }`}
              >
                <p className="flex items-center gap-1.5 font-bold">
                  {sheetTestResult.success ? (
                    <>
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Connection verified</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Connection error</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5">{sheetTestResult.message}</p>
              </div>
            )}

            <details className="group">
              <summary className="min-h-11 cursor-pointer list-none py-2 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 [&::-webkit-details-marker]:hidden">
                Set up the sheet: Apps Script code
              </summary>
              <div className="flex flex-col gap-3 pt-2">
                <p className={HINT}>
                  Open your Google Sheet, go to <strong>Extensions &gt; Apps Script</strong>, paste the code below and
                  deploy it as a Web App with access set to <em>Anyone</em>.
                </p>
                <div>
                  <button type="button" onClick={handleCopyAppsScript} className={BTN}>
                    {copiedCode ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                    <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
                  </button>
                </div>
                <pre
                  tabIndex={0}
                  aria-label="Apps Script code"
                  className="max-h-56 overflow-auto rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-subtle)] p-3 text-[length:var(--fs-small)] text-[var(--text-main)] [font-family:var(--font-mono)]"
                >
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </details>
          </Section>

          <Section
            id="ai"
            title="AI"
            intro="Your Gemini key, the default tone and who the standup is addressed to. Without a key, standups use a template."
          >
            <div>
              <label htmlFor={`${uid}-key`} className={LABEL}>
                Gemini API key (optional)
              </label>
              <div className="flex items-center gap-1">
                <input
                  id={`${uid}-key`}
                  type={showApiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy… (leave blank to use the server's key)"
                  autoComplete="off"
                  className={`${FIELD} flex-1 font-mono`}
                />
                <IconButton
                  label={showApiKey ? 'Hide key' : 'Show key'}
                  aria-pressed={showApiKey}
                  onClick={() => setShowApiKey((s) => !s)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </IconButton>
              </div>
              <p className={`${HINT} mt-1`}>
                Kept in this browser only and never written into backups. If blank, WorkPulse uses the key set on the server.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-tone`} className={LABEL}>
                  Default tone
                </label>
                <select
                  id={`${uid}-tone`}
                  value={defaultTone}
                  onChange={(e) => setDefaultTone(e.target.value as ReportTone)}
                  className={FIELD}
                >
                  <option value="casual">Casual and direct (agile standup)</option>
                  <option value="corporate">Formal corporate (stakeholders)</option>
                  <option value="bullet">Brief, bullets only</option>
                  <option value="client">Client-facing (deliverables)</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-to`} className={LABEL}>
                  Default recipient
                </label>
                <input
                  id={`${uid}-to`}
                  type="text"
                  value={defaultRecipientName}
                  onChange={(e) => setDefaultRecipientName(e.target.value)}
                  placeholder="e.g. Alex, Tech Lead"
                  autoComplete="off"
                  className={FIELD}
                />
              </div>
            </div>
          </Section>

          <Section
            id="activity"
            title="Activity suggestions"
            intro="At the end of the day WorkPulse can suggest logs from your work. Only the folders listed here are read."
          >
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
          </Section>

          <Section
            id="data"
            title="Data & backup"
            intro="Your data lives only in this browser. Back it up, or take a timesheet out as a spreadsheet."
          >
            <Block title="JSON backup">
              <p className={HINT}>
                Contains all work logs, tasks, projects, tags and settings, never your Gemini API key. Importing replaces
                all current data.
              </p>
              <p className="text-[length:var(--fs-small)] font-semibold text-[var(--text-main)]" data-testid="last-backup">
                {lastBackup}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onBackupNow} className={BTN}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download JSON backup</span>
                </button>
                <button type="button" onClick={() => importRef.current?.click()} className={BTN}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>Import JSON backup</span>
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={handleImportFile}
                />
              </div>
            </Block>

            <Block title="CSV spreadsheet">
              <p className={HINT}>Opens in Excel, Google Sheets or Numbers.</p>
              <button type="button" onClick={handleExportCSV} className={BTN}>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download CSV logs</span>
              </button>
            </Block>

            {misdatedLogs.length > 0 && (
              <Block title={`Fix log dates (${misdatedLogs.length})`}>
                <p className={HINT}>
                  {misdatedLogs.length} log(s) made between 00:00 and 06:00 local time were filed under the previous day
                  (older versions used the UTC date). Move them to the day you actually worked. Nothing changes until you
                  confirm.
                </p>
                <button type="button" onClick={handleFixDates} className={BTN}>
                  Review and fix dates
                </button>
              </Block>
            )}
          </Section>

          <Section
            id="sample"
            title="Sample data"
            intro="The demo logs, tasks and projects WorkPulse starts with. Both actions download a backup file first."
          >
            <Block title="Start fresh">
              <p className={HINT}>
                Remove the demo logs, tasks and projects and start with an empty workspace and one &ldquo;General&rdquo;
                project. Settings stay.
              </p>
              <button type="button" onClick={onStartFresh} className={DANGER_BTN}>
                Start with empty data
              </button>
            </Block>

            <Block title="Reset to demo data">
              <p className={HINT}>Replaces logs, tasks, projects and tags with the demo data.</p>
              <button type="button" onClick={onResetSeedData} className={DANGER_BTN}>
                Reset to demo data
              </button>
            </Block>
          </Section>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 sm:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-[var(--border-control)] bg-[var(--bg-surface-elevated)] px-4 py-3">
              <p className={HINT}>Theme, projects and tags apply as you change them. The rest waits for Save.</p>
              <button type="button" onClick={handleSaveAll} className={`${BTN} v2-btn-strong`}>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Save All Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
