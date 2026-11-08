import { useState, useMemo, useEffect } from 'react';
import { BacklogTask, Project, ThemeId, TaskStage } from '../../types';
import { getTaskStage } from './helpers';

export interface TasksProps {
  backlog: BacklogTask[];
  projects: Project[];
  activeTheme: ThemeId;
  onAddTask: (title: string, projectId: string, stage?: TaskStage) => void;
  onUpdateTaskStage: (taskId: string, stage: TaskStage, blockReason?: string) => void;
  onToggleTask?: (taskId: string) => void;
  onConvertTaskToLog: (task: BacklogTask) => void;
  onLogWithDetails?: (task: BacklogTask) => void;
  onDeleteTask: (taskId: string) => void;
  onAddProject?: (name: string, color: string) => void;
  onReopenTask?: (taskId: string) => void;
  onOpenEodSynthesizer?: (selectedTaskIds?: string[]) => void;
}

// All the state and handlers behind the Tasks screen. The themed views only draw what is in here.
export function useTasksModel(props: TasksProps) {
  const {
    backlog,
    projects,
    activeTheme,
    onAddTask,
    onUpdateTaskStage,
    onConvertTaskToLog,
    onLogWithDetails,
    onDeleteTask,
    onAddProject,
    onReopenTask,
    onOpenEodSynthesizer,
  } = props;
  const isMatrix = activeTheme === 'matrix';
  const isCompact = activeTheme === 'compact';
  const isMinimalist = activeTheme === 'minimalist';

  // Granular Task Multi-Selection State for EOD Synthesizer
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Drop selections for tasks that were deleted or have since been logged (e.g. after an EOD push).
  useEffect(() => {
    setSelectedTaskIds((prev) => {
      if (prev.size === 0) return prev;
      const selectable = new Set(backlog.filter((t) => !t.isSynthesized).map((t) => t.id));
      const next = new Set(Array.from(prev).filter((id) => selectable.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [backlog]);

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleSynthesizeSelected = () => {
    if (onOpenEodSynthesizer) {
      onOpenEodSynthesizer(Array.from(selectedTaskIds));
    }
  };

  // 1. Project-First Selection State (Sticky)
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return activeProjects[0]?.id || 'proj-1';
  });

  const selectedProject = useMemo(() => {
    return activeProjects.find((p) => p.id === selectedProjectId) || activeProjects[0];
  }, [activeProjects, selectedProjectId]);

  // Task Input Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [createStage, setCreateStage] = useState<'planned' | 'in_progress'>('planned');

  // Inline New Project Modal / Form
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#10b981');

  // Mobile / Tablet Tab Switcher (<1024px)
  const [mobileTab, setMobileTab] = useState<'focus' | 'queue' | 'paused_blocked' | 'done'>('focus');

  // Blocker reason prompt state
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null);
  const [blockerReasonInput, setBlockerReasonInput] = useState('');

  // Collapsible Completed Drawer
  const [isCompletedOpen, setIsCompletedOpen] = useState(true);

  // Queue Sidebar Search & Filter
  const [queueSearch, setQueueSearch] = useState('');
  const [queueProjectFilter, setQueueProjectFilter] = useState<string>('all');

  // Organization mode: by status vs by project
  const [groupingMode, setGroupingMode] = useState<'status' | 'project'>('status');

  // Collapsible stages in Compact view
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  const toggleStageCollapse = (stageKey: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageKey]: !prev[stageKey] }));
  };

  // 2. State Machine Categorization
  const categorizedTasks = useMemo(() => {
    const inProgress: BacklogTask[] = [];
    const paused: BacklogTask[] = [];
    const blocked: BacklogTask[] = [];
    const planned: BacklogTask[] = [];
    const done: BacklogTask[] = [];

    backlog.forEach((t) => {
      const stage = getTaskStage(t);
      if (stage === 'in_progress') inProgress.push(t);
      else if (stage === 'paused') paused.push(t);
      else if (stage === 'blocked') blocked.push(t);
      else if (stage === 'done') done.push(t);
      else planned.push(t);
    });

    return { inProgress, paused, blocked, planned, done };
  }, [backlog]);

  const { inProgress, paused, blocked, planned, done } = categorizedTasks;

  // 3. Project-Grouped Categorization (for "By Project" View)
  const tasksByProject = useMemo(() => {
    const projectMap = new Map<string, { project: Project; tasks: BacklogTask[]; totalSeconds: number }>();

    activeProjects.forEach((p) => {
      projectMap.set(p.id, { project: p, tasks: [], totalSeconds: 0 });
    });

    const fallbackProject: Project = { id: 'other', name: 'General / Unassigned', color: '#64748b', isArchived: false };

    backlog.forEach((task) => {
      let entry = projectMap.get(task.projectId);
      if (!entry) {
        if (!projectMap.has('other')) {
          projectMap.set('other', { project: fallbackProject, tasks: [], totalSeconds: 0 });
        }
        entry = projectMap.get('other')!;
      }
      entry.tasks.push(task);
      entry.totalSeconds += task.elapsedSeconds || 0;
    });

    const stageOrder: Record<TaskStage, number> = {
      in_progress: 1,
      paused: 2,
      blocked: 3,
      planned: 4,
      done: 5,
    };

    const list = Array.from(projectMap.values()).filter(
      (group) => group.tasks.length > 0 || activeProjects.some((ap) => ap.id === group.project.id)
    );

    list.forEach((group) => {
      group.tasks.sort((a, b) => {
        const orderA = stageOrder[getTaskStage(a)];
        const orderB = stageOrder[getTaskStage(b)];
        return orderA - orderB;
      });
    });

    return list;
  }, [backlog, activeProjects]);

  // Filtered Planned Queue
  const filteredPlannedTasks = useMemo(() => {
    return planned.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(queueSearch.toLowerCase());
      const matchesProject = queueProjectFilter === 'all' || task.projectId === queueProjectFilter;
      return matchesSearch && matchesProject;
    });
  }, [planned, queueSearch, queueProjectFilter]);

  // Handlers
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const targetProject = selectedProject?.id || activeProjects[0]?.id || 'default';
    onAddTask(taskTitle.trim(), targetProject, createStage);
    setTaskTitle('');
  };

  const handleCreateNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !onAddProject) return;
    onAddProject(newProjectName.trim(), newProjectColor);
    setNewProjectName('');
    setIsCreatingProject(false);
  };

  const handleStartBlocking = (task: BacklogTask) => {
    setBlockingTaskId(task.id);
    setBlockerReasonInput(task.blockReason || '');
  };

  const handleConfirmBlocking = (taskId: string) => {
    onUpdateTaskStage(taskId, 'blocked', blockerReasonInput.trim() || 'Waiting for resolution');
    setBlockingTaskId(null);
    setBlockerReasonInput('');
  };

  return {
    backlog,
    projects,
    activeTheme,
    onAddTask,
    onUpdateTaskStage,
    onConvertTaskToLog,
    onLogWithDetails,
    onDeleteTask,
    onAddProject,
    onReopenTask,
    onOpenEodSynthesizer,
    isMatrix,
    isCompact,
    isMinimalist,
    selectedTaskIds,
    setSelectedTaskIds,
    handleToggleSelectTask,
    handleClearSelection,
    handleSynthesizeSelected,
    activeProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    taskTitle,
    setTaskTitle,
    createStage,
    setCreateStage,
    isCreatingProject,
    setIsCreatingProject,
    newProjectName,
    setNewProjectName,
    newProjectColor,
    setNewProjectColor,
    mobileTab,
    setMobileTab,
    blockingTaskId,
    setBlockingTaskId,
    blockerReasonInput,
    setBlockerReasonInput,
    isCompletedOpen,
    setIsCompletedOpen,
    queueSearch,
    setQueueSearch,
    queueProjectFilter,
    setQueueProjectFilter,
    groupingMode,
    setGroupingMode,
    collapsedStages,
    setCollapsedStages,
    toggleStageCollapse,
    categorizedTasks,
    inProgress,
    paused,
    blocked,
    planned,
    done,
    tasksByProject,
    filteredPlannedTasks,
    handleQuickAdd,
    handleCreateNewProject,
    handleStartBlocking,
    handleConfirmBlocking,
  };
}

export type TasksModel = ReturnType<typeof useTasksModel>;
