import React, { useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { desktopBridge, type UpdateState } from '../../../utils/desktopBridge';

const HINT = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';
const BTN =
  'v2-btn inline-flex items-center justify-center gap-1.5 min-h-11 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// Settings > App updates (desktop app only). The shell does the work; this shows where it stands.
export const UpdatesSection: React.FC = () => {
  const bridge = desktopBridge();
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    bridge.getUpdateState().then((s) => live && s && setState(s));
    const off = bridge.onUpdateState((s) => live && setState(s));
    return () => {
      live = false;
      off();
    };
  }, [bridge]);

  if (!bridge) {
    return <p className={HINT}>Updates are for the WorkPulse desktop app. In a browser, you are always on the version this page serves.</p>;
  }
  if (!state) return <p className={HINT}>Reading the update status…</p>;

  const busy = state.status === 'checking' || state.status === 'downloading';
  const line =
    state.status === 'checking'
      ? 'Checking for updates…'
      : state.status === 'downloading'
        ? `Downloading version ${state.newVersion ?? ''} (${state.percent ?? 0}%)…`
        : state.status === 'ready'
          ? `Version ${state.newVersion ?? ''} is ready to install.`
          : state.status === 'current'
            ? `You have the latest version${state.checkedAt ? ` (checked ${new Date(state.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}.`
            : state.status === 'unavailable'
              ? 'Updates only work in the installed app, not in a development run.'
              : state.status === 'error'
                ? state.message || 'Could not check for updates.'
                : 'Press the button to look for a newer version.';

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[length:var(--fs-body)]">
        Version <span className="num font-semibold">{state.version}</span>
      </p>
      <p role="status" className={state.status === 'error' ? 'text-[length:var(--fs-small)] text-danger' : HINT}>
        {line}
      </p>
      {state.status === 'ready' ? (
        <button type="button" onClick={() => bridge.installUpdate()} className={`${BTN} v2-btn-strong`}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Restart and update
        </button>
      ) : (
        <button type="button" disabled={busy || state.status === 'unavailable'} onClick={() => bridge.checkForUpdates()} className={BTN}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Check for updates
        </button>
      )}
    </div>
  );
};
