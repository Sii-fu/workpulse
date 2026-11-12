import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SheetBackupStatus } from '../../../hooks/useSheetBackup';
import { getBackupInfo, loadBackupFromSheet, type SheetBackupVersion } from '../../../utils/phoneApi';
import { localDateOfIso, localDateStr, localTimeStr } from '../../../utils/dates';
import { dayLabelLong } from '../../../utils/taskSections';
import { ModalShell } from '../../ui/ModalShell';

export interface SheetBackupControls {
  status: SheetBackupStatus;
  /** Copies to the Sheet now; the answer carries a plain message. */
  backupNow(): Promise<{ ok: boolean; message: string }>;
  /** Puts a backup text in place of all data here (downloads the current data first, then reloads). A string is the reason it did not work. */
  restore(text: string): Promise<string | null>;
}

interface Props {
  url: string;
  token: string;
  /** The script's version from its ping. */
  version: number;
  backup: SheetBackupControls;
  /** The steps to update the script (shown when it is older than version 4). */
  setupSteps: React.ReactNode;
}

const BTN =
  'v2-btn inline-flex items-center justify-center gap-1.5 min-h-11 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const TEXT_BTN =
  'min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed';
const HINT = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';
const SUB = 'text-[length:var(--fs-body)] font-bold text-[var(--text-main)]';

function when(iso: string): string {
  const d = new Date(iso);
  const date = localDateOfIso(iso);
  return date === localDateStr() ? localTimeStr(d) : `${dayLabelLong(date)} at ${localTimeStr(d)}`;
}

const nf = new Intl.NumberFormat('en-US');
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`;
export const countsText = (c: SheetBackupVersion['counts']) =>
  `${plural(c.logs, 'log', 'logs')}, ${plural(c.tasks, 'task', 'tasks')}, ${plural(c.projects, 'project', 'projects')}`;

export const SheetBackupBlock: React.FC<Props> = ({ url, token, version, backup, setupSteps }) => {
  const uid = useId();
  const supported = version >= 4;
  const { status } = backup;

  // undefined = loading, null = could not read
  const [versions, setVersions] = useState<SheetBackupVersion[] | null | undefined>(undefined);
  const [listError, setListError] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState<SheetBackupVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const listId = useRef(0);
  const refresh = useCallback(() => {
    const id = ++listId.current;
    if (!token || !supported) return;
    getBackupInfo(url, token).then((r) => {
      if (id !== listId.current) return;
      if (r.ok) {
        setVersions(r.data?.versions ?? []);
        setListError('');
      } else {
        setVersions(null);
        setListError(r.message);
      }
    });
  }, [url, token, supported]);

  // Read the saved copies on open and after each copy made from this computer.
  useEffect(() => {
    refresh();
    return () => {
      listId.current++;
    };
  }, [refresh, status.lastAt]);

  const saveNow = async () => {
    setSaving(true);
    setResult(null);
    const r = await backup.backupNow();
    setSaving(false);
    setResult({ ok: r.ok, message: r.ok ? 'Copied to the Sheet.' : r.message });
  };

  const confirmRestore = async () => {
    if (!pick) return;
    setRestoring(true);
    setRestoreError('');
    const r = await loadBackupFromSheet(url, token, pick.version);
    if (!r.ok || !r.data) {
      setRestoring(false);
      setRestoreError(r.message);
      return;
    }
    const problem = await backup.restore(r.data.backup);
    // On success the page reloads; nothing below matters then.
    setRestoring(false);
    if (problem) setRestoreError(problem);
  };

  const newest = versions && versions.length > 0 ? versions[0] : null;
  const titleId = `${uid}-restore`;

  return (
    <div className="flex flex-col items-start gap-3 border-t border-[var(--border-app)] pt-5">
      <h3 className={SUB}>Sheet backup</h3>
      {!supported ? (
        <>
          <p className="text-[length:var(--fs-body)] text-[var(--text-main)]">
            Your Sheet runs script version {version}. Backing up all your data to the Sheet needs version 4.
          </p>
          {setupSteps}
        </>
      ) : !token ? (
        <p className={HINT}>
          Set the phone PIN above first. On a new browser, enter your Sheet link above, then use Reset phone access with your PIN, and
          the saved copies will show here.
        </p>
      ) : (
        <>
          <p className={HINT}>
            A copy of your logs, tasks, projects, clock-ins and settings is kept in the Sheet after every change, so you do not lose
            them if this browser is cleared. The last 3 copies are kept. Screenshots on logs and your keys (Gemini, phone) are not
            copied.
          </p>
          {/* Not a live region: background copies would announce themselves. */}
          <div className="flex flex-col gap-1 text-[length:var(--fs-small)]" data-testid="sheet-backup-status">
            {status.lastAt ? (
              <p className="text-[var(--text-main)]">
                <span className="font-semibold">Last copy to the Sheet {when(status.lastAt)}</span>
                {newest && <span className="text-[var(--text-muted)]"> · {countsText(newest.counts)}</span>}
              </p>
            ) : (
              <p className="text-[var(--text-main)]">
                <span className="font-semibold">Not copied from this computer yet</span>
                {newest && <span className="text-[var(--text-muted)]"> · the Sheet has a copy from {when(newest.savedAt)}</span>}
              </p>
            )}
            {status.lastError && <p className="text-danger">The last try failed: {status.lastError}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveNow} disabled={saving || status.busy} className={BTN}>
              {(saving || status.busy) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>Back up to the Sheet now</span>
            </button>
          </div>
          {result && (
            <p role={result.ok ? 'status' : 'alert'} className={`text-[length:var(--fs-small)] ${result.ok ? 'text-success' : 'text-danger'}`}>
              {result.message}
            </p>
          )}

          <div className="w-full flex flex-col gap-2">
            <h4 className="text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)]">Restore from the Sheet</h4>
            {versions === undefined && (
              <p role="status" className={`${HINT} flex items-center gap-1.5`}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Looking in the Sheet…
              </p>
            )}
            {versions === null && (
              <p className="text-[length:var(--fs-small)] text-danger" role="alert">
                {listError || 'Could not read the Sheet.'}{' '}
                <button type="button" onClick={refresh} className={TEXT_BTN}>
                  Try again
                </button>
              </p>
            )}
            {versions && versions.length === 0 && <p className={HINT}>No copy in the Sheet yet.</p>}
            {versions && versions.length > 0 && (
              <ul className="flex flex-col gap-1" data-testid="sheet-backup-versions">
                {versions.map((v) => (
                  <li key={v.version} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border-app)] py-1.5 text-[length:var(--fs-small)]">
                    <span className="text-[var(--text-main)]">
                      <span className="font-semibold">{when(v.savedAt)}</span>
                      <span className="text-[var(--text-muted)]"> · {countsText(v.counts)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRestoreError('');
                        setPick(v);
                      }}
                      className={TEXT_BTN}
                    >
                      Restore this copy
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {pick && (
        <ModalShell
          onClose={() => !restoring && setPick(null)}
          labelledBy={titleId}
          className="w-full max-w-md p-6 bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border-app)] rounded-[var(--radius-card)]"
        >
          <h2 id={titleId} className="text-[length:var(--fs-body)] font-bold">
            Restore the copy from {when(pick.savedAt)}?
          </h2>
          <p className="mt-2 text-[length:var(--fs-body)]">{countsText(pick.counts)}.</p>
          <p className="mt-2 text-[length:var(--fs-small)] text-[var(--text-muted)]">
            This replaces everything on this computer: logs, tasks, projects, clock-ins and settings. Your current data is downloaded
            as a backup file first. Screenshots stay only on logs that are still here. Your keys and phone link stay as they are.
          </p>
          {restoreError && (
            <p role="alert" className="mt-3 text-[length:var(--fs-small)] text-danger">
              {restoreError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setPick(null)} disabled={restoring} className={BTN}>
              Cancel
            </button>
            <button type="button" data-autofocus onClick={confirmRestore} disabled={restoring} className={`${BTN} v2-btn-strong`}>
              {restoring && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>Replace everything and restore</span>
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
