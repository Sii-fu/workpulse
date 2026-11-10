import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, BacklogTask, Project, WorkLog, Workdays } from '../types';
import { buildSnapshot, mergeInbox, snapshotSignature, type InboxItem } from '../utils/phoneSync';
import { ackInbox, pullInbox, pushState, type PhoneApiResult } from '../utils/phoneApi';
import { ensureDeviceId } from '../utils/phoneSettings';
import { isRunningTask, sameTasksIgnoringLiveTime } from '../utils/timerStore';

// Keeps the phone page and the evening email up to date (push) and takes the tasks added on the
// phone (pull). Active only when a Sheet URL and the desktop token are set. Failures are quiet: they
// are written to settings.phoneLastError for Settings to show, and the next cycle tries again.

export const PUSH_DEBOUNCE_MS = 5_000;
export const RUNNING_PUSH_MS = 5 * 60_000;
export const PULL_EVERY_MS = 60_000;
const FOCUS_PULL_GAP_MS = 10_000;

const SAVE_FAILED = 'Could not save the phone tasks on this computer. They stay waiting in the Sheet.';
const PULL_FAILED = 'Could not add the phone tasks just now. They stay waiting in the Sheet.';

/** Push when what the phone shows changed, or every 5 minutes while a timer runs (tracked minutes move). */
export function shouldPush(i: {
  signature: string;
  lastSignature: string | null;
  lastPushAtMs: number | null;
  nowMs: number;
  running: boolean;
}): boolean {
  if (i.signature !== i.lastSignature) return true;
  return i.running && i.lastPushAtMs !== null && i.nowMs - i.lastPushAtMs >= RUNNING_PUSH_MS;
}

export interface PullDeps {
  pull(): Promise<PhoneApiResult<{ items?: InboxItem[] }>>;
  merge(items: InboxItem[]): { backlog: BacklogTask[]; added: BacklogTask[]; takenIds: string[] };
  /** True only when the merged tasks are safely stored. */
  save(next: BacklogTask[]): boolean;
  ack(ids: string[]): Promise<PhoneApiResult>;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

// Whatever the Sheet sent, as clean inbox items; an item without an id is skipped, odd fields become ''.
function cleanItems(raw: unknown): InboxItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InboxItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) continue;
    const due = text(o.dueDate);
    out.push({
      id: o.id,
      title: text(o.title),
      projectId: text(o.projectId),
      projectName: text(o.projectName),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
      createdAt: text(o.createdAt),
    });
  }
  return out;
}

/**
 * One pull: read the inbox, merge, save, and only after a successful save mark the items taken.
 * If the ack fails the tasks stay here and the next pull skips them (their ids already exist).
 */
export async function pullAndMerge(deps: PullDeps): Promise<{ added: BacklogTask[]; error?: string }> {
  const r = await deps.pull();
  if (!r.ok) return { added: [], error: r.message };
  const items = cleanItems(r.data?.items);
  if (items.length === 0) return { added: [] };
  const merged = deps.merge(items);
  if (!deps.save(merged.backlog)) return { added: [], error: SAVE_FAILED };
  if (merged.takenIds.length > 0) {
    const a = await deps.ack(merged.takenIds);
    if (!a.ok) return { added: merged.added, error: a.message };
  }
  return { added: merged.added };
}

export interface PhoneSyncStatus {
  /** ISO time of the last successful push from this computer. */
  lastPushAt?: string;
  lastError?: string;
  busy: boolean;
  /** The latest push found that another computer pushed before it. */
  deviceChanged: boolean;
}

export interface PhoneSyncArgs {
  settings: AppSettings;
  saveSettings(next: AppSettings): void;
  backlog: BacklogTask[];
  logs: WorkLog[];
  projects: Project[];
  workdays: Workdays;
  today: string;
  /** Adds the new tasks in `next` to the current backlog and saves; true only when the save worked. */
  mergeAndSaveBacklog(next: BacklogTask[]): boolean;
  onTasksAdded(added: BacklogTask[]): void;
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const snapshotOf = (a: PhoneSyncArgs, deviceId: string) =>
  buildSnapshot({
    backlog: a.backlog,
    logs: a.logs,
    projects: a.projects,
    workdays: a.workdays,
    workdayHours: a.settings.workdayHours,
    tz: zone(),
    deviceId,
    today: a.today,
  });

export function usePhoneSync(args: PhoneSyncArgs): {
  syncNow(): Promise<void>;
  pullNow(): Promise<BacklogTask[]>;
  status: PhoneSyncStatus;
} {
  const latest = useRef(args);
  latest.current = args;
  const { settings } = args;
  const url = settings.googleScriptUrl || '';
  const token = settings.phoneToken || '';
  const active = Boolean(url && token);

  const [busy, setBusy] = useState(false);
  const [deviceChanged, setDeviceChanged] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);
  const lastSig = useRef<string | null>(null);
  const lastPushAt = useRef<number | null>(null);
  const lastPullAt = useRef(0);

  // The signature only changes when the phone's view does; computing it is skipped while only the
  // running timers' seconds move (App re-renders every second then).
  const sigCache = useRef<{ a: PhoneSyncArgs; sig: string } | null>(null);
  let signature = '';
  if (active) {
    const c = sigCache.current?.a;
    if (
      c &&
      c.logs === args.logs &&
      c.projects === args.projects &&
      c.workdays === args.workdays &&
      c.today === args.today &&
      c.settings.workdayHours === settings.workdayHours &&
      sameTasksIgnoringLiveTime(c.backlog, args.backlog)
    ) {
      signature = sigCache.current!.sig;
    } else {
      signature = snapshotSignature(snapshotOf(args, ''));
      sigCache.current = { a: args, sig: signature };
    }
  }

  // Writes status fields into settings, only when they change. The ref is updated at once, so two
  // writes before the next render do not undo each other.
  const record = useCallback((patch: Partial<AppSettings>) => {
    const s = latest.current.settings;
    if ((Object.keys(patch) as (keyof AppSettings)[]).every((k) => s[k] === patch[k])) return;
    const next = { ...s, ...patch };
    latest.current = { ...latest.current, settings: next };
    latest.current.saveSettings(next);
  }, []);

  // One pull or push in flight at a time.
  const run = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    inFlight.current += 1;
    setBusy(true);
    const p = queue.current.then(job).finally(() => {
      inFlight.current -= 1;
      if (inFlight.current === 0) setBusy(false);
    });
    queue.current = p.catch(() => undefined);
    return p;
  }, []);

  const push = useCallback(
    () =>
      run(async () => {
        let s = latest.current.settings;
        if (!s.googleScriptUrl || !s.phoneToken) return;
        if (!s.phoneDeviceId) {
          s = ensureDeviceId(s);
          record({ phoneDeviceId: s.phoneDeviceId });
        }
        const a = latest.current;
        const snap = snapshotOf(a, s.phoneDeviceId as string);
        // The signature ignores the device id, so it matches the one computed at render.
        const sig = snapshotSignature(snap);
        const nowMs = Date.now();
        const running = a.backlog.some(isRunningTask);
        if (!shouldPush({ signature: sig, lastSignature: lastSig.current, lastPushAtMs: lastPushAt.current, nowMs, running })) return;
        const r = await pushState(s.googleScriptUrl, s.phoneToken as string, snap);
        if (r.ok) {
          lastSig.current = sig;
          lastPushAt.current = nowMs;
          setDeviceChanged((r.data as { deviceChanged?: unknown } | undefined)?.deviceChanged === true);
          record({ phoneSyncAt: new Date(nowMs).toISOString(), phoneLastError: undefined });
        } else {
          record({ phoneLastError: r.message });
        }
      }),
    [run, record],
  );

  const pull = useCallback(
    (): Promise<BacklogTask[]> =>
      run(async () => {
        const s = latest.current.settings;
        const scriptUrl = s.googleScriptUrl || '';
        const tok = s.phoneToken || '';
        if (!scriptUrl || !tok) return [];
        lastPullAt.current = Date.now();
        let out: { added: BacklogTask[]; error?: string };
        try {
          out = await pullAndMerge({
            pull: () => pullInbox(scriptUrl, tok),
            merge: (items) => {
              const a = latest.current;
              return mergeInbox(a.backlog, a.projects, items, a.today);
            },
            save: (next) => latest.current.mergeAndSaveBacklog(next),
            ack: (ids) => ackInbox(scriptUrl, tok, ids),
          });
        } catch {
          out = { added: [], error: PULL_FAILED };
        }
        record({ phoneLastError: out.error });
        if (out.added.length > 0) latest.current.onTasksAdded(out.added);
        return out.added;
      }),
    [run, record],
  );

  // A new script or token: push the full state again.
  useEffect(() => {
    lastSig.current = null;
    lastPushAt.current = null;
  }, [url, token]);

  // Pull once at load (or when the link is first set up).
  useEffect(() => {
    if (active) void pull();
  }, [active, pull]);

  // Push a few seconds after the phone's view changes.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [active, signature, push]);

  // Every minute: pull while the page is visible, and push if due (a running timer every 5 minutes).
  // Pull again when the window gets focus.
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (inFlight.current > 0) return;
      if (document.visibilityState === 'visible') void pull();
      void push();
    };
    const onFocus = () => {
      if (inFlight.current > 0 || Date.now() - lastPullAt.current < FOCUS_PULL_GAP_MS) return;
      void pull();
    };
    const id = setInterval(tick, PULL_EVERY_MS);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [active, pull, push]);

  const syncNow = useCallback(async () => {
    lastSig.current = null;
    await push();
    await pull();
  }, [push, pull]);

  return {
    syncNow,
    pullNow: pull,
    status: { lastPushAt: settings.phoneSyncAt, lastError: settings.phoneLastError, busy, deviceChanged },
  };
}
