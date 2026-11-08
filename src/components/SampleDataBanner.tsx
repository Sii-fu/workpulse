import React from 'react';

interface SampleDataBannerProps {
  logCount: number;
  taskCount: number;
  onClear: () => void;
  onOpenSetup: () => void;
}

// What a new colleague sees first: the data is a demo, how to get rid of it, and where setup lives.
// It goes away by itself once the sample items are gone, so there is nothing to dismiss.
export const SampleDataBanner: React.FC<SampleDataBannerProps> = ({ logCount, taskCount, onClear, onOpenSetup }) => (
  <div
    role="region"
    aria-label="Sample data"
    className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border-control)] bg-[var(--bg-surface)]"
  >
    <p className="text-sm text-[var(--text-main)] flex-1 min-w-[16rem]">
      <strong className="font-semibold">Sample data.</strong>{' '}
      <span className="text-[var(--text-muted)]">
        {logCount} logs and {taskCount} tasks are here so you can try things. Your own work shows up beside them.
        Clearing them keeps everything you add.
      </span>
    </p>
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onOpenSetup}
        className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline cursor-pointer"
      >
        Set up Sheet and Gemini
      </button>
      <button
        type="button"
        onClick={onClear}
        className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--text-main)] text-[var(--bg-app)] hover:opacity-90 cursor-pointer"
      >
        Clear sample data
      </button>
    </div>
  </div>
);
