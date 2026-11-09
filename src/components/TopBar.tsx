import React from 'react';
import { ThemeId, ColorMode, AppNavTab } from '../types';
import {
  Search,
  FileSpreadsheet,
  Terminal,
  Sun,
  Moon,
  RefreshCw,
  MessageSquareText,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { NAV_TABS } from '../utils/nav';
import { LogoMark } from './ui/LogoMark';
import { ThemeMenu } from './ui/ThemeMenu';

interface TopBarProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  activeTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  onOpenSearch: () => void;
  onOpenAiStandup: () => void;
  onOpenEod: () => void;
  onOpenActivity: () => void;
  hasGoogleSheetLinked: boolean;
  onSyncGoogleSheet?: () => void;
  unsyncedCount?: number;
  isSyncing?: boolean;
}

const SEARCH_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K';

// How the four tabs are drawn in each theme: a segmented control, ink underlines, flat tabs, or
// inverted terminal tabs. The behaviour is the same; the voice is the theme's.
function tabClass(theme: ThemeId, active: boolean): string {
  const base = 'text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer';
  switch (theme) {
    case 'minimalist':
      return `${base} px-3 py-2 -mb-px border-b-2 ${
        active ? 'border-[var(--text-main)] text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`;
    case 'compact':
      return `${base} px-2.5 py-1.5 rounded-[var(--radius-btn)] ${
        active ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
      }`;
    case 'matrix':
      return `${base} px-2.5 py-1 ${
        active ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`;
    default:
      return `${base} px-3 py-1.5 rounded-[var(--radius-btn)] ${
        active
          ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border-control)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] border border-transparent'
      }`;
  }
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  activeTheme,
  onThemeChange,
  colorMode,
  onColorModeChange,
  onOpenSearch,
  onOpenAiStandup,
  onOpenEod,
  onOpenActivity,
  hasGoogleSheetLinked,
  onSyncGoogleSheet,
  unsyncedCount = 0,
  isSyncing,
}) => {
  const isMatrix = activeTheme === 'matrix';
  const isMinimalist = activeTheme === 'minimalist';
  const isCompact = activeTheme === 'compact';

  const pairBtn =
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer';

  return (
    <header
      className={`no-print w-full border-b border-[var(--border-app)] px-3 sm:px-6 ${
        isCompact ? 'py-1.5' : 'py-2.5'
      } ${isMinimalist ? 'bg-[var(--bg-app)]' : 'bg-[var(--bg-surface)]'}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-8">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setActiveTab('feed')}
            aria-label="WorkPulse, go to Timeline"
          >
            {isMatrix ? (
              <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--accent-text)] matrix-glow">
                <Terminal className="w-4 h-4" aria-hidden="true" />
                <span className="font-bold tracking-wider hidden sm:inline">root@workpulse:~$</span>
                <span className="font-bold tracking-wider sm:hidden">~/pulse$</span>
                <span className="w-1.5 h-3.5 bg-[var(--accent)] inline-block" />
              </span>
            ) : (
              <>
                <LogoMark className="w-6 h-6 text-[var(--accent-text)]" />
                <span
                  className={`text-[var(--text-main)] whitespace-nowrap leading-none ${
                    isMinimalist ? 'text-lg font-semibold tracking-tight' : 'text-sm font-bold tracking-tight'
                  }`}
                  style={isMinimalist ? { fontFamily: 'var(--font-display)' } : undefined}
                >
                  WorkPulse
                </span>
              </>
            )}
          </button>

          {/* Sheet status: only worth a pill when a Sheet is linked */}
          {hasGoogleSheetLinked && (
            <div
              className="hidden xl:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-[var(--radius-btn)] border border-success/30 text-success bg-success/15"
              title="Connected to Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-medium">Sheet linked</span>
              {onSyncGoogleSheet && (
                <button
                  onClick={onSyncGoogleSheet}
                  disabled={isSyncing}
                  className="hover:underline ml-1 font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSyncing ? 'Syncing' : unsyncedCount > 0 ? `Sync (${unsyncedCount})` : 'Sync'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          aria-label="Main"
          className={`hidden md:flex items-center gap-1 ${
            activeTheme === 'modern' ? 'bg-[var(--bg-subtle)] p-1 rounded-[var(--radius-btn)] border border-[var(--border-app)]' : ''
          } ${isMinimalist ? 'self-stretch' : ''}`}
        >
          {NAV_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={tabClass(activeTheme, activeTab === id)}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* The two reports, side by side and clearly different jobs */}
          <div
            role="group"
            aria-label="Reports"
            className="flex items-stretch divide-x divide-[var(--border-control)] border border-[var(--border-control)] rounded-[var(--radius-btn)] overflow-hidden"
          >
            <button
              type="button"
              onClick={onOpenAiStandup}
              className={pairBtn}
              title="Draft standup: write a message for your team from your logs"
              aria-label="Standup"
            >
              <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Standup</span>
            </button>
            <button
              type="button"
              onClick={onOpenEod}
              className={pairBtn}
              title="End of day: turn today's tasks into timesheet logs and push them to the Sheet"
              aria-label="End of day"
            >
              <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">End of day</span>
            </button>
            <button
              type="button"
              onClick={onOpenActivity}
              // Phones have no room for a third report button (every control is 44 px wide there):
              // the same dialog opens from "Suggest from my activity" inside End of day.
              className={`${pairBtn} max-sm:hidden`}
              title="Suggest logs from your git commits and Claude Code history"
              aria-label="Suggest logs"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Suggest logs</span>
            </button>
          </div>

          {/* Sync, for screens too narrow for the status pill */}
          {hasGoogleSheetLinked && onSyncGoogleSheet && (
            <button
              type="button"
              onClick={onSyncGoogleSheet}
              disabled={isSyncing}
              className="xl:hidden relative p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] border border-transparent hover:border-[var(--border-control)] transition-colors cursor-pointer disabled:opacity-50"
              title={unsyncedCount > 0 ? `Sync ${unsyncedCount} unsynced logs to Google Sheet` : 'Google Sheet is up to date. Sync again.'}
              aria-label={unsyncedCount > 0 ? `Sync to Google Sheet, ${unsyncedCount} waiting` : 'Sync to Google Sheet'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {unsyncedCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold flex items-center justify-center"
                  aria-hidden="true"
                >
                  {unsyncedCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onOpenSearch}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] transition-colors flex items-center gap-1 text-xs cursor-pointer border border-transparent hover:border-[var(--border-control)]"
            title="Search logs (Ctrl/Cmd + K)"
            aria-label="Search logs"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xl:inline text-xs font-mono" aria-hidden="true">
              {SEARCH_KEY}
            </span>
          </button>

          <ThemeMenu activeTheme={activeTheme} onChange={onThemeChange} />

          {/* Light or dark. Matrix is always dark, so it has no switch. */}
          {!isMatrix && (
            <button
              type="button"
              onClick={() => onColorModeChange(colorMode === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-[var(--radius-btn)] border border-[var(--border-control)] text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer flex items-center justify-center"
              title={`Switch to ${colorMode === 'dark' ? 'Light' : 'Dark'} Mode (Theme remains preserved)`}
              aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
            >
              {colorMode === 'dark' ? (
                <Moon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
