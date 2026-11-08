import { useState } from 'react';
import { Project, TaskStatus, WorkLog } from '../types';
import { defaultProject } from '../utils/projects';
import { localDateStr, localTimeStr } from '../utils/dates';

type NewLog = Omit<WorkLog, 'id' | 'createdAt'>;

// The state and submit logic behind the one-line "log it now" inputs in the Minimalist,
// Compact and Matrix timelines. Each theme draws its own controls on top of this.
export function useQuickLog(
  projects: Project[],
  onAddLog: (log: NewLog) => void,
  options: { withDuration?: boolean } = {}
) {
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProject(projects)?.id || '');
  const [status, setStatus] = useState<TaskStatus>('completed');
  const [tag, setTag] = useState('');
  const [duration, setDuration] = useState('30');

  const project = projects.find((p) => p.id === projectId) || defaultProject(projects);

  const reset = () => setDescription('');

  /** Writes the log. Returns false when there is nothing to write. */
  const submit = (): boolean => {
    const text = description.trim();
    if (!text) return false;
    onAddLog({
      date: localDateStr(),
      time: localTimeStr(),
      projectId: project?.id || 'default',
      projectName: project?.name || 'General',
      description: text,
      status,
      tags: tag ? [tag] : [],
      durationMinutes: options.withDuration ? parseInt(duration) || undefined : undefined,
      energyRating: 4,
    });
    reset();
    return true;
  };

  return {
    description, setDescription,
    projectId: project?.id || '', setProjectId,
    status, setStatus,
    tag, setTag,
    duration, setDuration,
    submit,
    /** What "Add details" hands to the full editor. */
    detailsDraft: () => ({ description: description.trim(), projectId: project?.id || '', status }),
  };
}
