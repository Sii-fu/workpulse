import React from 'react';

// The per-row checkbox that picks logs for a standup. The label around it makes the hit area
// 28 px square (36 on touch) while the box itself stays small.
export const SelectBox: React.FC<{ checked: boolean; onChange: () => void; what?: string }> = ({
  checked,
  onChange,
  what = 'log',
}) => (
  <label className="no-print inline-flex items-center justify-center w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 -m-1 cursor-pointer shrink-0">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={`Select ${what} for standup`}
      className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
    />
  </label>
);
