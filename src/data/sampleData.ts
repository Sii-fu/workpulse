import { BacklogTask, Project, WorkLog } from '../types';
import { INITIAL_PROJECTS, getInitialSeedData } from './seedData';

// The demo data a new colleague sees is recognised by its fixed ids, so no field is added to any
// record and no stored data changes. Real items can never collide with these: their ids carry a
// 13-digit timestamp (log-1735689600000-ab12, task-..., proj-1735689600000).

const seed = getInitialSeedData();
const SAMPLE_LOG_IDS = new Set(seed.logs.map((l) => l.id));
const SAMPLE_TASK_IDS = new Set(seed.backlog.map((t) => t.id));
const SAMPLE_PROJECT_IDS = new Set(INITIAL_PROJECTS.map((p) => p.id));

export const isSampleLog = (l: Pick<WorkLog, 'id'>): boolean => SAMPLE_LOG_IDS.has(l.id);
export const isSampleTask = (t: Pick<BacklogTask, 'id'>): boolean => SAMPLE_TASK_IDS.has(t.id);
export const isSampleProject = (p: Pick<Project, 'id'>): boolean => SAMPLE_PROJECT_IDS.has(p.id);

export function sampleCounts(logs: WorkLog[], backlog: BacklogTask[]): { logs: number; tasks: number; total: number } {
  const l = logs.filter(isSampleLog).length;
  const t = backlog.filter(isSampleTask).length;
  return { logs: l, tasks: t, total: l + t };
}

/**
 * Everything except the demo items. A demo project is kept while a real log or task still points at
 * it (removing it would orphan that work), and if no project is left a "General" one is added so
 * there is always somewhere to log. Tags are kept: they are generic and free.
 */
export function withoutSampleData(
  logs: WorkLog[],
  backlog: BacklogTask[],
  projects: Project[],
  makeGeneral: () => Project,
): { logs: WorkLog[]; backlog: BacklogTask[]; projects: Project[] } {
  const realLogs = logs.filter((l) => !isSampleLog(l));
  const realTasks = backlog.filter((t) => !isSampleTask(t));
  const used = new Set<string>([...realLogs.map((l) => l.projectId), ...realTasks.map((t) => t.projectId)]);
  let keptProjects = projects.filter((p) => !isSampleProject(p) || used.has(p.id));
  if (keptProjects.length === 0) keptProjects = [makeGeneral()];
  return { logs: realLogs, backlog: realTasks, projects: keptProjects };
}
