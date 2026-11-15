import type { BacklogTask, Project, ThemeId, WidgetsSettings, Workdays } from '../types';
import { getTaskStage } from '../components/tasks/helpers';
import { currentWorkday, DEFAULT_WORKDAY_HOURS, validWorkdayHours } from './workday';
import { isPendingTask } from './taskLogging';
import { isRunningTask, liveSecondsOf } from './timerStore';

// What the desktop widgets show. The app builds this and sends it to the widget windows (Electron only);
// the widgets draw it and send back "start / pause / resume this task". Plain data, no React or window.

export type WidgetKind = 'time' | 'tasks';
export const WIDGET_KINDS: WidgetKind[] = ['time', 'tasks'];

export interface WidgetConfig {
  time: { on: boolean; top: boolean };
  tasks: { on: boolean; top: boolean };
}

/** Both widgets off by default; "on top" is the default placement once one is on. */
export function widgetConfig(w: WidgetsSettings | undefined): WidgetConfig {
  return {
    time: { on: w?.time?.on === true, top: w?.time?.top !== false },
    tasks: { on: w?.tasks?.on === true, top: w?.tasks?.top !== false },
  };
}

export type WidgetTaskState = 'running' | 'paused' | 'blocked' | 'planned';

export interface WidgetTask {
  id: string;
  title: string;
  project: string;
  color: string;
  state: WidgetTaskState;
  /** Tracked seconds when the snapshot was made; a running task keeps counting from `WidgetSnapshot.at`. */
  seconds: number;
}

export interface WidgetSnapshot {
  theme: ThemeId;
  /** Date.now() when this was built. */
  at: number;
  hours: number;
  clockIn: string | null;
  clockOut: string | null;
  tasks: WidgetTask[];
}

export type WidgetCommand =
  | { type: 'start' | 'pause' | 'resume'; id: string }
  | { type: 'open' }
  | { type: 'close'; kind: WidgetKind };

const RANK: Record<WidgetTaskState, number> = { running: 0, paused: 1, blocked: 2, planned: 3 };
const MAX_TASKS = 30;

/** Open work: running, paused and blocked tasks of any date, and planned tasks due today or earlier. */
export function buildWidgetSnapshot(input: {
  theme: ThemeId;
  backlog: BacklogTask[];
  projects: Project[];
  workdays: Workdays;
  workdayHours: number | undefined;
  today: string;
  nowMs: number;
}): WidgetSnapshot {
  const { backlog, projects, workdays, today } = input;
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tasks: WidgetTask[] = [];
  for (const t of backlog) {
    if (!isPendingTask(t)) continue;
    const stage = getTaskStage(t);
    const state: WidgetTaskState = isRunningTask(t)
      ? 'running'
      : stage === 'blocked'
        ? 'blocked'
        : stage === 'planned'
          ? 'planned'
          : 'paused';
    if (state === 'planned' && t.dueDate > today) continue;
    const p = byId.get(t.projectId);
    tasks.push({
      id: t.id,
      title: t.title,
      project: p && !p.trashedAt ? p.name : '',
      color: p && !p.trashedAt ? p.color : '',
      state,
      seconds: Math.floor(liveSecondsOf(t)),
    });
  }
  tasks.sort((a, b) => RANK[a.state] - RANK[b.state]);
  const day = currentWorkday(workdays, today);
  return {
    theme: input.theme,
    at: input.nowMs,
    hours: validWorkdayHours(input.workdayHours) ?? DEFAULT_WORKDAY_HOURS,
    clockIn: day?.rec.clockIn ?? null,
    clockOut: day?.rec.clockOut ?? null,
    tasks: tasks.slice(0, MAX_TASKS),
  };
}

/** Everything in a snapshot except the moment it was built and the live seconds of running tasks. */
export function snapshotSignature(s: WidgetSnapshot): string {
  return JSON.stringify([
    s.theme,
    s.hours,
    s.clockIn,
    s.clockOut,
    s.tasks.map((t) => [t.id, t.title, t.project, t.color, t.state, t.state === 'running' ? 0 : t.seconds]),
  ]);
}
