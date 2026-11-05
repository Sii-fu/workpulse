import React, { useState } from 'react';
import { Project, ThemeId, AppSettings, WorkLog, BacklogTask } from '../types';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptTemplate';
import { testSheetConnection } from '../utils/sheetsSync';
import {
  X,
  FileSpreadsheet,
  Palette,
  Sparkles,
  Layers,
  Tag,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Trash2,
  Archive,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  projects: Project[];
  onUpdateProjects: (projects: Project[]) => void;
  tags: string[];
  onUpdateTags: (tags: string[]) => void;
  onResetSeedData: () => void;
  onNotify: (msg: string) => void;
  logs: WorkLog[];
  backlog: BacklogTask[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  projects,
  onUpdateProjects,
  tags,
  onUpdateTags,
  onResetSeedData,
  onNotify,
  logs,
  backlog,
}) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'sheets' | 'template' | 'gemini' | 'projects' | 'tags'>('sheets');
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(settings.googleScriptUrl || '');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isTestingSheet, setIsTestingSheet] = useState<boolean>(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Project manager inputs
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectColor, setNewProjectColor] = useState<string>('#6366f1');

  // Tag manager input
  const [newTagInput, setNewTagInput] = useState<string>('');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      ...settings,
      googleScriptUrl: googleScriptUrl.trim(),
      geminiApiKey: geminiApiKey.trim(),
    });
    onNotify('Settings saved successfully.');
    onClose();
  };

  const handleTestConnection = async () => {
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
    onNotify('Apps Script code copied to clipboard!');
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
    onNotify(`Project "${newProj.name}" created.`);
  };

  const handleToggleArchiveProject = (id: string) => {
    const updated = projects.map((p) => (p.id === id ? { ...p, isArchived: !p.isArchived } : p));
    onUpdateProjects(updated);
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      alert('You must maintain at least one project.');
      return;
    }
    const updated = projects.filter((p) => p.id !== id);
    onUpdateProjects(updated);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = newTagInput.trim();
    if (!cleaned) return;
    if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
    if (tags.includes(cleaned)) return;
    onUpdateTags([...tags, cleaned]);
    setNewTagInput('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    onUpdateTags(tags.filter((t) => t !== tagToDelete));
  };

  // Backup export
  const handleExportBackup = () => {
    const data = {
      logs,
      backlog,
      projects,
      tags,
      settings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workpulse-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-app)]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[var(--text-main)]">
              WorkPulse Settings & Integrations
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-4 sm:px-5 border-b border-[var(--border-app)] overflow-x-auto text-xs font-semibold bg-[var(--bg-subtle)]/40">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'border-[var(--accent)] text-[var(--text-main)] font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Google Sheets Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('template')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'template'
                ? 'border-[var(--accent)] text-[var(--text-main)] font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Apps Script Template</span>
          </button>

          <button
            onClick={() => setActiveTab('gemini')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'gemini'
                ? 'border-[var(--accent)] text-[var(--text-main)] font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI Key</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'theme'
                ? 'border-[var(--accent)] text-[var(--text-main)] font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme & Style</span>
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'projects'
                ? 'border-[var(--accent)] text-[var(--text-main)] font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Projects</span>
          </button>

          <button
            onClick={() => setActiveTab('tags')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tags'
                ? 'border-[var(--accent)] text-[var(--text-main)] font-bold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tags</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: GOOGLE SHEETS */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-[var(--border-app)] bg-[var(--bg-subtle)]/40">
                <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-1">
                  How Google Sheets Integration Works
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  WorkPulse uses a personal Google Apps Script Web App URL endpoint to record your daily work logs directly to your Google Sheet in real time. If not configured, WorkPulse operates seamlessly in offline local mode.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
                  Google Apps Script Web App URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={googleScriptUrl}
                    onChange={(e) => setGoogleScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-main)] focus:outline-hidden focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingSheet || !googleScriptUrl}
                    className="px-3.5 py-2 rounded-md bg-[var(--accent)] text-white text-xs font-semibold shadow-xs hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    {isTestingSheet ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <span>Test Connection</span>
                    )}
                  </button>
                </div>
              </div>

              {sheetTestResult && (
                <div
                  className={`p-3 rounded-md text-xs border ${
                    sheetTestResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1.5">
                    {sheetTestResult.success ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Connection Verified</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Connection Test Failed</span>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5">{sheetTestResult.message}</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('template')}
                  className="text-xs text-[var(--accent)] hover:underline font-semibold flex items-center gap-1"
                >
                  <span>Need the Google Apps Script code to paste into your Google Sheet? View instructions & code →</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: APPS SCRIPT TEMPLATE */}
          {activeTab === 'template' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Google Apps Script Code</h3>
                  <p className="text-xs text-[var(--text-muted)]">Paste this into your Google Sheet's script editor.</p>
                </div>
                <button
                  onClick={handleCopyAppsScript}
                  className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Script Code'}</span>
                </button>
              </div>

              <div className="bg-neutral-900 text-neutral-100 rounded-md p-3.5 text-xs font-mono overflow-x-auto max-h-64 border border-neutral-800">
                <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
              </div>

              <div className="space-y-1.5 text-xs text-[var(--text-muted)] border-t border-[var(--border-app)] pt-3">
                <p className="font-semibold text-[var(--text-main)]">Quick 4-Step Setup:</p>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                  <li>Open any Google Sheet, navigate to <strong>Extensions &gt; Apps Script</strong>.</li>
                  <li>Paste this code into the editor and click Save (Ctrl/Cmd + S).</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong>, select type <strong>Web app</strong>.</li>
                  <li>Set <em>Execute as: Me</em> and <em>Who has access: Anyone</em>, then click Deploy and paste the URL in the Google Sheets tab!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: GEMINI AI KEY */}
          {activeTab === 'gemini' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-[var(--border-app)] bg-[var(--bg-subtle)]/40">
                <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-1">
                  Gemini API Configuration
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  WorkPulse uses Gemini 3.8 Flash to transform raw bullet points and task logs into polished WhatsApp messages, Slack daily standups, and executive memoranda.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
                  Personal Gemini API Key:
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md px-3 py-2 pr-10 text-xs font-mono text-[var(--text-main)] focus:outline-hidden focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Your key is securely stored in your browser's local storage and used directly for AI generation. If omitted, WorkPulse uses the server's environment configuration or smart offline report templates.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: THEME & STYLE */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">Theme & Visual Personality</h3>
                <p className="text-xs text-[var(--text-muted)]">Choose your preferred workspace layout density and aesthetic.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'minimalist' as ThemeId,
                    title: 'Minimalist (Default)',
                    desc: 'Notion-inspired calm workspace, serene off-whites, distraction-free typography.',
                    previewColor: '#F7F7F5',
                    badge: 'Serene',
                  },
                  {
                    id: 'modern' as ThemeId,
                    title: 'Modern SaaS',
                    desc: 'Slate and zinc cards with glassmorphic accents and rounded corners.',
                    previewColor: '#F8FAFC',
                    badge: 'Refined',
                  },
                  {
                    id: 'compact' as ThemeId,
                    title: 'Compact',
                    desc: 'Linear and Jira power-user mode. High-density table layout and rapid scanning.',
                    previewColor: '#FFFFFF',
                    badge: 'Density',
                  },
                  {
                    id: 'matrix' as ThemeId,
                    title: 'Matrix Cyberpunk',
                    desc: 'Deep OLED black with glowing phosphor green accents and terminal scanlines.',
                    previewColor: '#050805',
                    badge: 'Neon',
                  },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => onSaveSettings({ ...settings, theme: th.id })}
                    className={`p-3.5 rounded-lg border text-left transition-all relative ${
                      settings.theme === th.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border-app)] bg-[var(--bg-subtle)] hover:border-[var(--border-focus)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[var(--text-main)]">{th.title}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-app)] text-[var(--text-muted)]">
                        {th.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{th.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <form onSubmit={handleAddProject} className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project name..."
                  className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-hidden"
                />
                <input
                  type="color"
                  value={newProjectColor}
                  onChange={(e) => setNewProjectColor(e.target.value)}
                  className="w-8 h-8 rounded border-0 cursor-pointer"
                  title="Choose marker color"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] shrink-0"
                >
                  Add Project
                </button>
              </form>

              <div className="space-y-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-md border border-[var(--border-app)] bg-[var(--bg-subtle)]/50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className={`font-medium ${p.isArchived ? 'line-through opacity-50' : ''}`}>
                        {p.name}
                      </span>
                      {p.isArchived && <span className="text-[10px] text-amber-600 font-mono">(Archived)</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleArchiveProject(p.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        title={p.isArchived ? 'Unarchive project' : 'Archive project'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(p.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-rose-600"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: TAGS */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Add custom tag (e.g. #marketing)..."
                  className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] shrink-0"
                >
                  Add Tag
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-app)] text-xs text-[var(--text-main)]"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(t)}
                      className="text-[var(--text-muted)] hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-[var(--border-app)] bg-[var(--bg-subtle)]/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] underline"
            >
              Export JSON Backup
            </button>
            <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onResetSeedData}
              className="text-xs text-rose-600 hover:underline"
            >
              Reset to Seed Preset
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
