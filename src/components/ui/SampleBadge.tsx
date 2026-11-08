import React from 'react';

// Marks the demo logs and tasks a new colleague starts with, so nobody mistakes them for their own work.
export const SampleBadge: React.FC<{ show: boolean }> = ({ show }) =>
  show ? (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-btn)] border border-dashed border-[var(--border-control)] text-xs font-medium text-[var(--text-muted)] whitespace-nowrap"
      title="Part of the sample data. Clear it from the banner at the top when you are ready."
    >
      Sample data
    </span>
  ) : null;
