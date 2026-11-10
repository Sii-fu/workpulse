import React from 'react';
import { CalendarCheck, History, ListChecks, Settings, type LucideIcon } from 'lucide-react';
import { V2_TABS, type V2Tab } from './NavTabs';

interface BottomNavProps {
  active: V2Tab;
  onChange(t: V2Tab): void;
  openTasks: number;
}

const ICONS: Record<V2Tab, LucideIcon> = {
  today: CalendarCheck,
  tasks: ListChecks,
  history: History,
  settings: Settings,
};

// Phones only (under 640 px): the four screens, fixed to the bottom, 44 px targets.
export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange, openTasks }) => (
  <nav
    aria-label="Main"
    className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-app)] pb-[env(safe-area-inset-bottom)]"
  >
    <ul className="grid grid-cols-4">
      {V2_TABS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const current = active === id;
        return (
          <li key={id}>
            <button
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => onChange(id)}
              className={`w-full min-h-14 flex flex-col items-center justify-center gap-0.5 text-[length:var(--fs-small)] font-semibold cursor-pointer transition-colors ${
                current
                  ? 'text-[var(--accent-text)] shadow-[inset_0_2px_0_var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Icon size={20} aria-hidden="true" />
              <span>
                {label}
                {id === 'tasks' && openTasks > 0 && (
                  <span className="num">
                    {' '}
                    {openTasks}
                    <span className="sr-only"> open</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);
