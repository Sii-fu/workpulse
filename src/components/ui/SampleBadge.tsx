import React from 'react';

// Marks the demo logs and tasks a new colleague starts with, so nobody mistakes them for their own work.
export const SampleBadge: React.FC<{ show: boolean }> = ({ show }) =>
  show ? (
    <span
      className="text-xs text-[var(--text-muted)] whitespace-nowrap"
      title="Part of the sample data. Clear it from the banner at the top when you are ready."
    >
      Sample data
    </span>
  ) : null;
