import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

interface SelectionBarProps {
  visibleIds: string[];
  selectedIds: string[];
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
  onGenerateStandup: () => void;
  onOpenEod?: () => void;
  dense?: boolean;
}

// "Select all", the selected count, and the two things you can do with logs: write a standup from
// the selection, or synthesize the day's end-of-day logs.
export const SelectionBar: React.FC<SelectionBarProps> = ({
  visibleIds,
  selectedIds,
  onSelectAll,
  onClear,
  onGenerateStandup,
  onOpenEod,
  dense = false,
}) => {
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const btn = `${dense ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'} rounded-[var(--radius-btn)] font-semibold cursor-pointer`;

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[var(--text-muted)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (allSelected ? onClear() : onSelectAll(visibleIds))}
          aria-pressed={allSelected}
          className="flex items-center gap-1.5 hover:text-[var(--text-main)] transition-colors font-medium cursor-pointer"
        >
          {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" /> : <Square className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{allSelected ? 'Deselect all' : `Select all (${visibleIds.length})`}</span>
        </button>
        {selectedIds.length > 0 && (
          <span className="font-semibold text-[var(--text-main)]" aria-live="polite">
            {selectedIds.length} selected
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {selectedIds.length > 0 && (
          <>
            <button type="button" onClick={onGenerateStandup} className={`${btn} bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)]`}>
              Standup from {selectedIds.length}
            </button>
            <button type="button" onClick={onClear} className={`${btn} border border-[var(--border-control)] hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] font-normal`}>
              Clear
            </button>
          </>
        )}
        {onOpenEod && (
          <button
            type="button"
            onClick={onOpenEod}
            title="End of day: turn today's tasks into timesheet logs and push them to the Sheet"
            className={`${btn} bg-warning-solid hover:bg-warning-solid-hover text-on-solid`}
          >
            End of day
          </button>
        )}
      </div>
    </div>
  );
};
