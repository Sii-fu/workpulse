import React from 'react';
import { describeBackupAge } from '../utils/backupReminder';

interface BackupReminderProps {
  days: number | null;
  onBackup: () => void;
  onLater: () => void;
}

// Everything lives in this browser, so a file is the only safety net. Quiet on purpose: it never
// blocks work, "Later" hides it until the next visit, and a backup makes it disappear for a week.
export const BackupReminder: React.FC<BackupReminderProps> = ({ days, onBackup, onLater }) => (
  <div
    role="region"
    aria-label="Backup reminder"
    className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 rounded-[var(--radius-card)] border border-[var(--border-control)] bg-[var(--bg-surface)]"
  >
    <p className="text-sm text-[var(--text-main)] flex-1 min-w-[16rem]">
      <strong className="font-semibold">{describeBackupAge(days)}.</strong>{' '}
      <span className="text-[var(--text-muted)]">
        Your work is stored only in this browser. A backup file keeps it safe if the browser data is cleared.
      </span>
    </p>
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onLater}
        className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline cursor-pointer"
      >
        Later
      </button>
      <button
        type="button"
        onClick={onBackup}
        className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--text-main)] text-[var(--bg-app)] hover:opacity-90 cursor-pointer"
      >
        Back up now
      </button>
    </div>
  </div>
);
