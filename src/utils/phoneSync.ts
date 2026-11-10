import type { BacklogTask, Project, TaskStage, WorkLog, Workdays } from '../types';
import { isSampleLog, isSampleProject, isSampleTask } from '../data/sampleData';
import { lastNDays, localDateOfIso } from './dates';
import { defaultProject } from './projects';

// What the desktop pushes to the script so the phone page and the evening email can show it.
// The script reads these keys by name: do not rename them.

export interface SnapshotTask {
  id: string;
  title: string;
  projectId: string;
  project: string;
  dueDate: string;
  stage: TaskStage;
  trackedMinutes: number;
  completedAt?: string;
  fromPhone: boolean;
}

export interface SnapshotLog {
  id: string;
  date: string;
  time: string;
  project: string;
  projectId: string;
  description: string;
  status: string;
  minutes: number;
}

export interface PhoneSnapshot {
  tasks: SnapshotTask[];
  logs: SnapshotLog[];
  workdays: Workdays;
  projects: { id: string; name: string; color: string }[];
  workdayHours: number;
  tz: string;
  deviceId: string;
  today: string;
}

const DONE_DAYS = 7;
const LOG_DAYS = 14;
const DEFAULT_WORKDAY_HOURS = 8;
const NO_PROJECT = 'No project';

const stageOf = (t: BacklogTask): TaskStage => t.stage || (t.completed ? 'done' : 'planned');

export function buildSnapshot(i: {
  backlog: BacklogTask[];
  logs: WorkLog[];
  projects: Project[];
  workdays: Workdays;
  workdayHours?: number;
  tz: string;
  deviceId: string;
  today: string;
}): PhoneSnapshot {
  const names = new Map(i.projects.map((p) => [p.id, p.name]));
  const recentDone = new Set(lastNDays(i.today, DONE_DAYS));
  const logDays = lastNDays(i.today, LOG_DAYS);
  const logDaySet = new Set(logDays);

  const tasks: SnapshotTask[] = [];
  for (const t of i.backlog) {
    if (isSampleTask(t)) continue;
    const stage = stageOf(t);
    if (stage === 'done') {
      const doneOn = t.completedAt ? localDateOfIso(t.completedAt) : t.dueDate;
      if (!recentDone.has(doneOn)) continue;
    }
    const snap: SnapshotTask = {
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      project: names.get(t.projectId) ?? NO_PROJECT,
      dueDate: t.dueDate,
      stage,
      trackedMinutes: Math.floor((t.elapsedSeconds || 0) / 60),
      fromPhone: t.fromPhone === true,
    };
    if (t.completedAt) snap.completedAt = t.completedAt;
    tasks.push(snap);
  }

  const logs: SnapshotLog[] = i.logs
    .filter((l) => !isSampleLog(l) && logDaySet.has(l.date))
    .map((l) => ({
      id: l.id,
      date: l.date,
      time: l.time,
      project: l.projectName,
      projectId: l.projectId,
      description: l.description,
      status: l.status,
      minutes: l.durationMinutes || 0,
    }));

  const workdays: Workdays = {};
  for (const d of logDays) if (i.workdays[d]) workdays[d] = i.workdays[d];

  return {
    tasks,
    logs,
    workdays,
    projects: i.projects.filter((p) => !p.isArchived && !isSampleProject(p)).map((p) => ({ id: p.id, name: p.name, color: p.color })),
    workdayHours: i.workdayHours ?? DEFAULT_WORKDAY_HOURS,
    tz: i.tz,
    deviceId: i.deviceId,
    today: i.today,
  };
}

// Same string for the same content, so the app can skip a push when nothing the phone shows changed.
// Live tracked minutes, the zone and the device id are left out on purpose: they change without the
// phone view changing (minutes tick every second while a timer runs).
export function snapshotSignature(s: PhoneSnapshot): string {
  return JSON.stringify([
    s.today,
    s.workdayHours,
    s.tasks.map((t) => [t.id, t.title, t.projectId, t.project, t.dueDate, t.stage, t.completedAt ?? '', t.fromPhone]),
    s.logs.map((l) => [l.id, l.date, l.time, l.project, l.projectId, l.description, l.status, l.minutes]),
    Object.keys(s.workdays)
      .sort()
      .map((d) => [d, s.workdays[d].clockIn, s.workdays[d].clockOut ?? '']),
    s.projects.map((p) => [p.id, p.name, p.color]),
  ]);
}

// A task the phone page added while the desktop was off, as it sits in the Sheet inbox.
export interface InboxItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  dueDate: string;
  createdAt: string;
}

export function mergeInbox(
  backlog: BacklogTask[],
  projects: Project[],
  items: InboxItem[],
  today: string,
): { backlog: BacklogTask[]; added: BacklogTask[]; takenIds: string[] } {
  const active = projects.filter((p) => !p.isArchived);
  const known = new Set(backlog.map((t) => t.id));
  const added: BacklogTask[] = [];

  for (const item of items) {
    if (known.has(item.id)) continue;
    const title = (item.title || '').trim();
    if (!title) continue;
    const project =
      active.find((p) => p.id === item.projectId) ||
      active.find((p) => p.name === item.projectName) ||
      defaultProject(projects);
    const dueDate = item.dueDate || today;
    known.add(item.id);
    added.push({
      id: item.id,
      title,
      projectId: project ? project.id : item.projectId,
      dueDate,
      originalDate: dueDate,
      stage: 'planned',
      completed: false,
      isRolledOver: false,
      elapsedSeconds: 0,
      isRunning: false,
      fromPhone: true,
    });
  }

  return { backlog: [...backlog, ...added], added, takenIds: items.map((it) => it.id) };
}
