import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, BacklogTask, BackupData, Project, WorkLog, Workdays } from '../types';
import { getScriptVersion, saveBackupToSheet, type PhoneApiResult } from '../utils/phoneApi';
import {
  BACKUP_DEBOUNCE_MS,
  BACKUP_SCRIPT_VERSION,
  backupCounts,
  backupSignature,
  buildSheetBackup,
  hasRealData,
  shouldBackup,
} from '../utils/sheetBackup';
import { isRunningTask, sameTasksIgnoringLiveTime } from '../utils/timerStore';

// Keeps a full copy of the app's data in the Sheet (script version 4 and up). Active only when a Sheet
// URL and the desktop token are set and the stored data has loaded. Failures are quiet: they are
// written to settings.sheetBackupError for Settings to show, and the next cycle tries again.

const CHECK_EVERY_MS = 60_000;
const VERSION_RECHECK_MS = 10 * 60_000;
const MAX_BACKUP_CHARS = 20 * 1024 * 1024;

export interface SheetBackupStatus {
  lastAt?: string;
  lastError?: string;
  busy: boolean;
}

export interface SheetBackupArgs {
  /** False until the stored data has loaded: nothing is copied before that. */
  enabled: boolean;
  settings: AppSettings;
  /** Writes only these fields onto the latest settings. */
  updateSettings(patch: Partial<AppSettings>): void;
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  tags: string[];
  workdays: Workdays;
  /** True while the page is about to reload after a backup import: nothing may be copied then. */
  isLeaving(): boolean;
}

const dataOf = (a: SheetBackupArgs): BackupData => ({
  logs: a.logs,
  backlog: a.backlog,
  projects: a.projects,
  tags: a.tags,
  settings: a.settings,
  workdays: a.workdays,
});

export function useSheetBackup(args: SheetBackupArgs): {
  backupNow(): Promise<PhoneApiResult>;
  status: SheetBackupStatus;
} {
  const latest = useRef(args);
  latest.current = args;
  const { settings } = args;
  const url = settings.googleScriptUrl || '';
  const token = settings.phoneToken || '';
  const active = Boolean(args.enabled && url && token);

  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const supported = useRef(false);
  const versionCheckedAt = useRef(0);
  const baseline = useRef<string | null>(null);
  const loadSig = useRef<string | null>(null);
  const lastFailureAt = useRef<number | null>(null);
  const lastChangeAt = useRef(0);

  // Computed only when the data changes, not on every tick of a running timer.
  const sigCache = useRef<{ a: SheetBackupArgs; sig: string } | null>(null);
  let signature = '';
  if (active) {
    const c = sigCache.current?.a;
    if (
      c &&
      c.logs === args.logs &&
      c.projects === args.projects &&
      c.tags === args.tags &&
      c.workdays === args.workdays &&
      c.settings === args.settings &&
      sameTasksIgnoringLiveTime(c.backlog, args.backlog)
    ) {
      signature = sigCache.current!.sig;
    } else {
      signature = backupSignature(dataOf(args));
      sigCache.current = { a: args, sig: signature };
    }
  }

  const record = useCallback((patch: Partial<AppSettings>) => {
    const s = latest.current.settings;
    if ((Object.keys(patch) as (keyof AppSettings)[]).every((k) => s[k] === patch[k])) return;
    latest.current = { ...latest.current, settings: { ...s, ...patch } };
    latest.current.updateSettings(patch);
  }, []);

  const checkVersion = useCallback(async (): Promise<boolean> => {
    const s = latest.current.settings;
    versionCheckedAt.current = Date.now();
    const v = await getScriptVersion(s.googleScriptUrl || '');
    supported.current = v !== null && v >= BACKUP_SCRIPT_VERSION;
    return supported.current;
  }, []);

  // One copy in flight at a time. `force` copies whatever the signature says (the button).
  const attempt = useCallback(
    (force: boolean): Promise<PhoneApiResult> => {
      const job = async (): Promise<PhoneApiResult> => {
        const quiet: PhoneApiResult = { ok: true, message: 'Nothing to copy.' };
        const a = latest.current;
        const s = a.settings;
        if (!a.enabled || !s.googleScriptUrl || !s.phoneToken || a.isLeaving()) return quiet;
        if (force || !supported.current) {
          if (!(await checkVersion()) && !force) return quiet;
          if (!supported.current) {
            return { ok: false, message: 'Your Sheet script is older than version 4. Update it and redeploy to back up here.' };
          }
        }
        const cur = latest.current;
        if (cur.isLeaving()) return quiet;
        const data = dataOf(cur);
        const sig = backupSignature(data);
        const nowMs = Date.now();
        const base = baseline.current ?? (loadSig.current !== null && sig !== loadSig.current ? loadSig.current : null);
        if (!force) {
          if (!hasRealData(data)) return quiet;
          const due = shouldBackup({
            signature: sig,
            baseline: base,
            lastBackupAtMs: cur.settings.sheetBackupAt ? Date.parse(cur.settings.sheetBackupAt) || null : null,
            lastFailureAtMs: lastFailureAt.current,
            nowMs,
            running: cur.backlog.some(isRunningTask),
          });
          if (!due) {
            if (baseline.current === null && base === null) baseline.current = sig;
            return quiet;
          }
        }
        setBusy(true);
        try {
          const text = buildSheetBackup(data);
          let r: PhoneApiResult;
          if (text.length > MAX_BACKUP_CHARS) {
            r = { ok: false, message: 'Your data is larger than 20 MB, which is too big for the Sheet. Use Download JSON backup instead.' };
          } else {
            r = await saveBackupToSheet(s.googleScriptUrl as string, s.phoneToken as string, text, {
              counts: backupCounts(data),
              exportedAt: new Date(nowMs).toISOString(),
            });
          }
          if (latest.current.isLeaving()) return r;
          if (r.ok) {
            baseline.current = sig;
            lastFailureAt.current = null;
            record({ sheetBackupAt: new Date().toISOString(), sheetBackupError: undefined });
          } else {
            lastFailureAt.current = Date.now();
            record({ sheetBackupError: r.message });
          }
          return r;
        } finally {
          setBusy(false);
        }
      };
      if (inFlight.current && !force) return Promise.resolve({ ok: true, message: 'Already copying.' });
      inFlight.current = true;
      const p = queue.current.then(job).finally(() => {
        inFlight.current = false;
      });
      queue.current = p.catch(() => undefined);
      return p.catch(() => {
        lastFailureAt.current = Date.now();
        const message = 'Could not copy to the Sheet just now.';
        record({ sheetBackupError: message });
        return { ok: false, message };
      });
    },
    [checkVersion, record],
  );

  // A new script or token: start again from scratch.
  useEffect(() => {
    baseline.current = null;
    loadSig.current = null;
    lastFailureAt.current = null;
    supported.current = false;
  }, [url, token]);

  // The data as first seen is the starting point; the first copy at load only follows the 1 hour rule.
  useEffect(() => {
    if (active && loadSig.current === null) loadSig.current = signature;
  }, [active, signature]);

  // 30 s after the data changes (and once after load, where the 1 hour rule decides).
  useEffect(() => {
    if (!active) return;
    lastChangeAt.current = Date.now();
    const t = setTimeout(() => void attempt(false), BACKUP_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [active, signature, attempt]);

  // Every minute: a running timer's 10 minute copy, a retry after a failure, a script that was updated.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (inFlight.current) return;
      if (Date.now() - lastChangeAt.current < BACKUP_DEBOUNCE_MS) return;
      if (!supported.current && Date.now() - versionCheckedAt.current < VERSION_RECHECK_MS) return;
      void attempt(false);
    }, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [active, attempt]);

  const backupNow = useCallback(() => attempt(true), [attempt]);

  return { backupNow, status: { lastAt: settings.sheetBackupAt, lastError: settings.sheetBackupError, busy } };
}
