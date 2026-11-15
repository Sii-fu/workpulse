import React from 'react';
import type { AppSettings, WidgetsSettings } from '../../../types';
import { desktopBridge } from '../../../utils/desktopBridge';
import { widgetConfig, type WidgetKind } from '../../../utils/widgets';

const WIDGETS: { kind: WidgetKind; title: string; blurb: string }[] = [
  { kind: 'time', title: 'Time widget', blurb: 'How long you have worked today and the time left in your workday.' },
  { kind: 'tasks', title: 'Tasks widget', blurb: 'The running task with its clock, and your open tasks with Start, Pause and Resume.' },
];

const HINT = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';

// Settings > Widgets. Changes apply at once (no Save needed): the shell opens, closes or re-pins the windows.
export const WidgetsSection: React.FC<{
  settings: AppSettings;
  onUpdateSettings(patch: Partial<AppSettings>): void;
}> = ({ settings, onUpdateSettings }) => {
  const cfg = widgetConfig(settings.widgets);

  if (!desktopBridge()) {
    return (
      <p className={HINT}>
        Widgets are small always-visible windows for the WorkPulse desktop app. Open WorkPulse from the desktop app to turn them on.
      </p>
    );
  }

  const set = (kind: WidgetKind, next: { on?: boolean; top?: boolean }) => {
    const w: WidgetsSettings = { ...settings.widgets, [kind]: { ...cfg[kind], ...next } };
    onUpdateSettings({ widgets: w });
  };

  return (
    <div className="flex flex-col gap-6">
      {WIDGETS.map(({ kind, title, blurb }) => (
        <fieldset key={kind} className="flex flex-col gap-2 border-t border-[var(--border-app)] pt-5 first:border-t-0 first:pt-0">
          <legend className="sr-only">{title}</legend>
          <label className="flex items-center gap-2 text-[length:var(--fs-body)] font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={cfg[kind].on}
              onChange={(e) => set(kind, { on: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent-text)]"
            />
            {title}
          </label>
          <p className={HINT}>{blurb}</p>
          <div role="radiogroup" aria-label={`${title} placement`} className="flex flex-col gap-1.5 pl-6">
            {[
              { top: true, label: 'Always on top', note: 'Stays above other windows.' },
              { top: false, label: 'On the desktop', note: 'Sits with your other windows, so an open window can cover it.' },
            ].map((o) => (
              <label key={String(o.top)} className="flex items-start gap-2 text-[length:var(--fs-body)] cursor-pointer">
                <input
                  type="radio"
                  name={`widget-${kind}-place`}
                  checked={cfg[kind].top === o.top}
                  disabled={!cfg[kind].on}
                  onChange={() => set(kind, { top: o.top })}
                  className="mt-1 w-4 h-4 accent-[var(--accent-text)]"
                />
                <span>
                  {o.label} <span className={HINT}>{o.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className={HINT}>Drag a widget by its body to move it; WorkPulse remembers the spot. Hover a widget and press × to hide it.</p>
    </div>
  );
};
