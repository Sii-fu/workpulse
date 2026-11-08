import React, { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { ThemeId } from '../../types';

export const THEMES: { id: ThemeId; name: string; note: string }[] = [
  { id: 'modern', name: 'Modern', note: 'Calm panels, teal signal' },
  { id: 'minimalist', name: 'Minimalist', note: 'Paper and ink, serif headings' },
  { id: 'compact', name: 'Compact', note: 'Dense grid, keyboard first' },
  { id: 'matrix', name: 'Matrix', note: 'Terminal, green on black' },
];

interface ThemeMenuProps {
  activeTheme: ThemeId;
  onChange: (theme: ThemeId) => void;
}

// A theme switch that lives in the top bar and applies at once. A menu of radio items:
// arrows move, Enter or Space picks, Escape closes and returns focus to the button.
export const ThemeMenu: React.FC<ThemeMenuProps> = ({ activeTheme, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = THEMES.find((t) => t.id === activeTheme) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const selected = Math.max(0, THEMES.findIndex((t) => t.id === activeTheme));
    itemRefs.current[selected]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, activeTheme]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + THEMES.length) % THEMES.length;
      itemRefs.current[next]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch theme"
        className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] border border-transparent hover:border-[var(--border-control)] transition-colors cursor-pointer"
      >
        <Palette className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">{current.name}</span>
        <span className="sr-only lg:hidden">Theme: {current.name}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute right-0 top-full mt-1.5 z-50 w-60 p-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-control)] rounded-[var(--radius-card)] shadow-2xl"
        >
          {THEMES.map((t, i) => {
            const selected = t.id === activeTheme;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={-1}
                onKeyDown={(e) => onItemKeyDown(e, i)}
                onClick={() => {
                  onChange(t.id);
                  close();
                }}
                className={`w-full text-left px-2.5 py-2 rounded-[var(--radius-btn)] flex flex-col cursor-pointer hover:bg-[var(--bg-subtle)] ${
                  selected ? 'bg-[var(--bg-subtle)]' : ''
                }`}
              >
                <span className="text-sm font-semibold text-[var(--text-main)] flex items-center justify-between">
                  {t.name}
                  {selected && <span className="text-xs text-[var(--accent-text)] font-semibold">Current</span>}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t.note}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
