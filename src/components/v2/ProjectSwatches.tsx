import React from 'react';

// The fixed project colours (spec Decision 4): Settings → Projects and the log form's "New project" use the same eight.
export const SWATCHES: { hex: string; name: string }[] = [
  { hex: '#2e86de', name: 'Blue' },
  { hex: '#e07a2f', name: 'Orange' },
  { hex: '#8e5bd6', name: 'Purple' },
  { hex: '#2aa876', name: 'Green' },
  { hex: '#d6455d', name: 'Red' },
  { hex: '#c9a227', name: 'Gold' },
  { hex: '#3a9ca8', name: 'Teal' },
  { hex: '#8a6d5b', name: 'Brown' },
];

const RING = 'shadow-[0_0_0_2px_var(--bg-app),0_0_0_4px_var(--text-main)]';

// Eight colours to pick from, plus a last "Custom" swatch that opens the system colour picker.
// The chosen one gets a ring that does not depend on colour to be seen.
export const Swatches: React.FC<{ value: string; label: string; onPick(hex: string): void }> = ({ value, label, onPick }) => {
  const custom = /^#[0-9a-f]{6}$/i.test(value) && !SWATCHES.some((s) => s.hex.toLowerCase() === value.toLowerCase());
  return (
  <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {SWATCHES.map((s) => {
      const on = s.hex.toLowerCase() === value.toLowerCase();
      return (
        <button
          key={s.hex}
          type="button"
          aria-label={s.name}
          aria-pressed={on}
          title={s.name}
          onClick={() => onPick(s.hex)}
          className={`h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11 rounded-[var(--radius-btn)] cursor-pointer ${
            on ? 'shadow-[0_0_0_2px_var(--bg-app),0_0_0_4px_var(--text-main)]' : ''
          }`}
          style={{ backgroundColor: s.hex }}
        />
      );
    })}
    <label
      title="Custom colour"
      className={`relative block h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11 rounded-[var(--radius-btn)] cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 ${
        custom ? RING : ''
      }`}
      style={{
        background: custom ? value : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
      }}
    >
      <input
        type="color"
        aria-label="Custom colour"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#2e86de'}
        onChange={(e) => onPick(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  </div>
  );
};
