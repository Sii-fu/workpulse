import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SyncState {
  /** False when no Sheet URL is set: the button is not shown. */
  hasSheet: boolean;
  /** Logs not in the Sheet yet. */
  unsynced: number;
  syncing: boolean;
  onSync(): void;
}

/** "Sync N" sends the unsynced logs to the Google Sheet; "Synced" (disabled) when there is nothing to send. */
export const SyncButton: React.FC<SyncState & { className?: string }> = ({ hasSheet, unsynced, syncing, onSync, className = '' }) => {
  if (!hasSheet) return null;
  const idle = unsynced === 0 && !syncing;
  return (
    <button
      type="button"
      onClick={onSync}
      disabled={syncing || unsynced === 0}
      aria-busy={syncing || undefined}
      className={`v2-btn inline-flex items-center justify-center gap-1.5 min-h-11 px-4 cursor-pointer transition-colors disabled:cursor-default ${
        idle ? 'disabled:opacity-60' : ''
      } ${className}`}
    >
      {syncing ? (
        <>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Syncing…
        </>
      ) : idle ? (
        'Synced'
      ) : (
        <>
          Sync <span className="num">{unsynced}</span>
          <span className="sr-only"> {unsynced === 1 ? 'log' : 'logs'} to the Sheet</span>
        </>
      )}
    </button>
  );
};
