import React from 'react';
import { ThemeId, ColorMode, AppNavTab } from '../types';
import {
  Sparkles,
  Search,
  Settings,
  Layers,
  BarChart3,
  ListTodo,
  FileSpreadsheet,
  Terminal,
  Sun,
  Moon,
} from 'lucide-react';

interface TopBarProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  activeTheme: ThemeId;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  onOpenSearch: () => void;
  onOpenAiStandup: () => void;
  hasGoogleSheetLinked: boolean;
  onSyncGoogleSheet?: () => void;
  unsyncedCount?: number;
  isSyncing?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  activeTheme,
  colorMode,
  onColorModeChange,
  onOpenSearch,
  onOpenAiStandup,
  hasGoogleSheetLinked,
  onSyncGoogleSheet,
  unsyncedCount = 0,
  isSyncing,
}) => {
  const isMatrix = activeTheme === 'matrix';

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b border-[var(--border-app)] bg-[var(--bg-surface)] backdrop-blur-xl px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-8">
        
        {/* Zone 1: Brand Wordmark / Terminal Prompt */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setActiveTab('feed')}
          >
            {isMatrix ? (
              <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--accent)] matrix-glow">
                <Terminal className="w-4 h-4" />
                <span className="font-bold tracking-wider hidden sm:inline">root@workpulse:~$</span>
                <span className="font-bold tracking-wider sm:hidden">~/pulse$</span>
                <span className="w-1.5 h-3.5 bg-[var(--accent)] animate-pulse inline-block" />
              </div>
            ) : (
              <>
                <div className="w-7 h-7 rounded-[var(--radius-btn)] bg-gradient-to-br from-[var(--accent)] to-cyan-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-[var(--accent-glow)]">
                  W
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm tracking-tight text-[var(--text-main)] whitespace-nowrap leading-none">
                    WorkPulse
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-mono mt-0.5 hidden sm:inline">
                    OS Hub
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Sheets Status Indicator */}
          <div
            className={`hidden xl:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-[var(--radius-btn)] border ${
              hasGoogleSheetLinked
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20'
                : 'border-[var(--border-app)] text-[var(--text-muted)] bg-[var(--bg-subtle)]'
            }`}
            title={hasGoogleSheetLinked ? 'Connected to Google Sheets' : 'Local storage mode'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium font-mono">
              {hasGoogleSheetLinked ? 'G-Sheet Live' : 'Local Mode'}
            </span>
            {hasGoogleSheetLinked && onSyncGoogleSheet && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSyncGoogleSheet();
                }}
                disabled={isSyncing}
                className="hover:underline ml-1 font-semibold text-[var(--accent)] disabled:opacity-50 cursor-pointer"
              >
                {isSyncing ? '...' : unsyncedCount > 0 ? `Sync (${unsyncedCount})` : 'Sync'}
              </button>
            )}
          </div>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-[var(--radius-btn)] border border-[var(--border-app)]">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => setActiveTab('backlog')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'backlog'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Tasks</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Zone 3: Actions (Search, AI Standup, Dark/Light Toggle) */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Quick AI Standup Trigger */}
          <button
            onClick={onOpenAiStandup}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-md shadow-[var(--accent-glow)] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Generate AI Standup report (WhatsApp, Slack, Executive)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Standup</span>
          </button>

          {/* Quick Search palette (Cmd+K) */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] transition-colors flex items-center gap-1 text-xs cursor-pointer border border-transparent hover:border-[var(--border-app)]"
            title="Search logs (Ctrl/Cmd + K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[10px] font-mono opacity-60">⌘K</span>
          </button>

          {/* Animated Sun / Moon Toggle Button (or Matrix CRT OLED badge) */}
          {isMatrix ? (
            <div
              className="px-2 py-1 rounded-[var(--radius-btn)] border border-[#183e1e] bg-[#060e07] text-[#00ff66] font-mono text-[10px] font-bold tracking-wider matrix-glow select-none cursor-default"
              title="Matrix theme is permanently locked to OLED Phosphor Dark mode"
            >
              [CRT: OLED]
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onColorModeChange(colorMode === 'dark' ? 'light' : 'dark')}
              className="relative p-2 rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] transition-all cursor-pointer flex items-center justify-center overflow-hidden"
              title={`Switch to ${colorMode === 'dark' ? 'Light' : 'Dark'} Mode (Theme remains preserved)`}
              aria-label="Toggle Light/Dark Mode"
            >
              <div
                className={`transition-all duration-300 transform ${
                  colorMode === 'dark'
                    ? 'rotate-0 scale-100 opacity-100'
                    : 'rotate-90 scale-0 opacity-0'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
              </div>
              <div
                className={`absolute transition-all duration-300 transform ${
                  colorMode === 'light'
                    ? 'rotate-0 scale-100 opacity-100'
                    : '-rotate-90 scale-0 opacity-0'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
            </button>
          )}

          {/* Settings Icon Quick Shortcut (Mobile & Tablet) */}
          <button
            onClick={() => setActiveTab('settings')}
            className="md:hidden p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-app)]"
            title="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
