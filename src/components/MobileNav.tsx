import React from 'react';
import { AppNavTab } from '../types';
import { NAV_TABS } from '../utils/nav';

interface MobileNavProps {
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  pendingTasksCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onTabChange, pendingTasksCount }) => {
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-app)] px-2 py-1 shadow-2xl no-print"
    >
      <div className="flex items-center justify-around">
        {NAV_TABS.map(({ id, short, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] py-1 text-xs font-semibold rounded-md transition-all cursor-pointer relative ${
              activeTab === id ? 'text-[var(--accent-text)] font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Icon className="w-4 h-4 mb-0.5" aria-hidden="true" />
            <span className="text-[11px]">{short}</span>
            {id === 'backlog' && pendingTasksCount && pendingTasksCount > 0 ? (
              <span className="absolute top-1 right-2.5 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[9px] flex items-center justify-center font-mono font-bold">
                {pendingTasksCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </nav>
  );
};
