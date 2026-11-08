import { BacklogTask, TaskStage } from '../../types';

// Normalizes any task to one of the 5 canonical stages
export function getTaskStage(task: BacklogTask): TaskStage {
  if (task.stage) return task.stage;
  if (task.completed) return 'done';
  return 'planned';
}

// Digital clock format: 00:14:22
export function formatDigitalTimer(seconds: number = 0): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
