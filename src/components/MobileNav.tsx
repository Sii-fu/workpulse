import React from 'react';
import { AppNavTab } from '../types';
import { Layers, ListTodo, BarChart3, Settings } from 'lucide-react';

interface MobileNavProps {
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  pendingTasksCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onTabChange,
  pendingTasksCount,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-xl border-t border-[var(--border-app)] px-2 py-1 shadow-2xl no-print">
      <div className="flex items-center justify-around">
        <button
          onClick={() => onTabChange('feed')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'feed'
              ? 'text-[var(--accent)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Timeline</span>
        </button>

        <button
          onClick={() => onTabChange('backlog')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] py-1 text-xs font-semibold rounded-md transition-all cursor-pointer relative ${
            activeTab === 'backlog'
              ? 'text-[var(--accent)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <ListTodo className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Tasks</span>
          {pendingTasksCount && pendingTasksCount > 0 ? (
            <span className="absolute top-1 right-2.5 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] flex items-center justify-center font-mono font-bold">
              {pendingTasksCount}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => onTabChange('analytics')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'text-[var(--accent)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Stats</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-[var(--accent)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>
    </nav>
  );
};
