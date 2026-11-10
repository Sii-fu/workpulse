import React, { useId } from 'react';
import { Check } from 'lucide-react';
import { THEMES, type ThemeId } from '../../../utils/theme';

interface ThemePickerProps {
  value: ThemeId;
  onChange(t: ThemeId): void;
}

// Three tiles, one radio group. Choosing applies at once (the caller saves it), so there is no
// "apply" step. Each preview is a small static picture drawn with that theme's own tokens: the
// `data-theme` attribute on the preview scopes the theme's custom properties to it, so it keeps
// its own colours and faces whatever theme the page is in. The previews are decoration
// (aria-hidden); the radio's name and description carry the same facts in words.
const Preview: React.FC<{ theme: ThemeId }> = ({ theme }) => (
  <div
    data-theme={theme}
    aria-hidden="true"
    className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-app)] bg-[var(--bg-app)] text-[var(--text-main)] [font-family:var(--font-body)]"
  >
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--band-bg)] [border-bottom:var(--band-edge)]">
      <span className="text-xs text-[var(--band-muted)]">Today</span>
      <span className="num text-[22px] leading-none font-bold text-[var(--clock-calm)]">6:12</span>
    </div>
    <div className="bg-[var(--bg-surface)]">
      {[
        { color: '#2e86de', text: 'Fix date filter', time: '1:34' },
        { color: '#2aa876', text: 'Standup notes', time: '0:25' },
      ].map((r, i) => (
        <div
          key={r.text}
          className={`flex items-center gap-2 px-3 py-2 ${i === 0 ? 'border-b border-[var(--border-app)]' : ''}`}
        >
          <span className="h-4 w-1.5 shrink-0 rounded-[2px]" style={{ backgroundColor: r.color }} />
          <span className="min-w-0 flex-1 truncate text-[13px]">{r.text}</span>
          <span className="num text-[13px] text-[var(--text-muted)]">{r.time}</span>
        </div>
      ))}
    </div>
  </div>
);

export const ThemePicker: React.FC<ThemePickerProps> = ({ value, onChange }) => {
  const group = useId();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))] gap-3"
    >
      {THEMES.map((t) => {
        const selected = value === t.id;
        const nameId = `${group}-${t.id}-name`;
        const blurbId = `${group}-${t.id}-blurb`;
        return (
          <label
            key={t.id}
            className={`flex cursor-pointer flex-col gap-3 rounded-[var(--radius-card)] border-2 bg-[var(--bg-surface)] p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--accent-text)] ${
              selected ? 'border-[var(--text-main)]' : 'border-[var(--border-app)] hover:border-[var(--border-control)]'
            }`}
          >
            <input
              type="radio"
              name={group}
              value={t.id}
              checked={selected}
              onChange={() => onChange(t.id)}
              aria-labelledby={nameId}
              aria-describedby={blurbId}
              className="sr-only"
            />
            <Preview theme={t.id} />
            <span className="flex flex-col gap-1">
              <span id={nameId} className="flex items-center justify-between gap-2 text-[length:var(--fs-body)] font-bold text-[var(--text-main)]">
                {t.name}
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </span>
              <span id={blurbId} className="text-[length:var(--fs-small)] text-[var(--text-muted)]">
                {t.blurb}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
};
