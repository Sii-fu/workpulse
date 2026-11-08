import React from 'react';
import type { TasksModel } from './useTasksModel';
import {
  ClipboardCheck,
} from 'lucide-react';

// The bar that appears while tasks are selected for the end-of-day timesheet.
export const SelectionFloatingBar: React.FC<{ m: TasksModel }> = ({ m }) => {
  const {
    selectedTaskIds,
    handleClearSelection,
    handleSynthesizeSelected,
  } = m;

  if (selectedTaskIds.size === 0) return null;

  return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] shadow-2xl animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
          <span className="text-xs font-mono font-bold text-[var(--text-main)]">
            {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'task' : 'tasks'} selected
          </span>
        </div>
        <div className="h-4 w-px bg-[var(--border-app)]" />
        <button
          type="button"
          onClick={handleSynthesizeSelected}
          className="px-4 py-1.5 rounded-full bg-[var(--text-main)] hover:opacity-90 text-[var(--bg-app)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Timesheet from selected ({selectedTaskIds.size})</span>
        </button>
        <button
          type="button"
          onClick={handleClearSelection}
          className="px-2.5 py-1.5 rounded-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
        >
          Clear
        </button>
      </div>
  );
};
