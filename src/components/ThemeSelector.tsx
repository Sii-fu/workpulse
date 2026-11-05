import React, { useState, useRef, useEffect } from 'react';
import { ThemeId, ColorMode } from '../types';
import { Sparkles, FileText, Zap, Terminal, ChevronDown, Check, Sun, Moon } from 'lucide-react';

interface ThemeSelectorProps {
  activeTheme: ThemeId;
  colorMode: ColorMode;
  onThemeChange: (theme: ThemeId) => void;
  onColorModeChange: (mode: ColorMode) => void;
}

const THEMES: {
  id: ThemeId;
  name: string;
  badge: string;
  desc: string;
  icon: React.ReactNode;
  accentColor: string;
}[] = [
  {
    id: 'modern',
    name: 'Modern SaaS',
    badge: 'Raycast',
    desc: 'Glassmorphic floating cards with electric indigo glow & depth',
    icon: <Sparkles className="w-3.5 h-3.5 text-indigo-400" />,
    accentColor: '#6366f1',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    badge: 'Notion',
    desc: 'Distraction-free warm paper canvas, borderless inline editor',
    icon: <FileText className="w-3.5 h-3.5 text-neutral-500" />,
    accentColor: '#2383e2',
  },
  {
    id: 'compact',
    name: 'Compact',
    badge: 'Linear',
    desc: 'Dense tabular console, horizontal command bar, locked h-9 rows',
    icon: <Zap className="w-3.5 h-3.5 text-blue-400" />,
    accentColor: '#2563eb',
  },
  {
    id: 'matrix',
    name: 'Matrix CLI',
    badge: 'UNIX TUI',
    desc: 'OLED pitch-black, CRT scanlines, command-line prompt & Tmux bar',
    icon: <Terminal className="w-3.5 h-3.5 text-emerald-400" />,
    accentColor: '#00ff66',
  },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  activeTheme,
  colorMode,
  onThemeChange,
  onColorModeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeThemeMeta = THEMES.find((t) => t.id === activeTheme) || THEMES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] text-xs font-medium transition-all shadow-xs cursor-pointer select-none"
        title="Switch UI/UX Theme & Mode"
      >
        <span className="shrink-0">{activeThemeMeta.icon}</span>
        <span className="font-semibold tracking-tight hidden sm:inline">{activeThemeMeta.name}</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase opacity-70 bg-[var(--bg-surface)] border border-[var(--border-app)]">
          {activeThemeMeta.badge}
        </span>
        <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 rounded-[var(--radius-card)] border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl p-2 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          
          {/* Header & Quick Mode Switcher */}
          <div className="px-2 py-1.5 border-b border-[var(--border-app)] mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Appearance Engine
            </span>

            {/* Light / Dark Mode Toggle */}
            {activeTheme !== 'matrix' ? (
              <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-0.5 rounded-[var(--radius-btn)] border border-[var(--border-app)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onColorModeChange('light');
                  }}
                  className={`p-1 rounded-[var(--radius-btn)] text-[10px] font-semibold transition-colors cursor-pointer ${
                    colorMode === 'light' ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                  title="Light Mode"
                >
                  <Sun className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onColorModeChange('dark');
                  }}
                  className={`p-1 rounded-[var(--radius-btn)] text-[10px] font-semibold transition-colors cursor-pointer ${
                    colorMode === 'dark' ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                  title="Dark Mode"
                >
                  <Moon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400">OLED DARK</span>
            )}
          </div>

          {/* Theme List */}
          <div className="space-y-1">
            {THEMES.map((theme) => {
              const isSelected = theme.id === activeTheme;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    onThemeChange(theme.id);
                    if (theme.id === 'matrix') {
                      onColorModeChange('dark');
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-[var(--radius-btn)] text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--bg-subtle-hover)] border border-[var(--border-focus)]/40 text-[var(--text-main)]'
                      : 'hover:bg-[var(--bg-subtle)] border border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{theme.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[var(--text-main)] truncate">
                        {theme.name}
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--bg-subtle)] border border-[var(--border-app)] uppercase opacity-80">
                        {theme.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5 line-clamp-1">
                      {theme.desc}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
