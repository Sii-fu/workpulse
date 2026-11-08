import React, { useState, useMemo, useEffect } from 'react';
import { BacklogTask, Project, ThemeId, TaskStage } from '../types';
import { readableOn } from '../utils/color';
import {
  Play,
  CheckCircle2,
  Pause,
  PauseCircle,
  AlertOctagon,
  Ban,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FolderPlus,
  AlertTriangle,
  Zap,
  Check,
  FileEdit,
  Terminal,
  Flame,
  Search,
  Sparkles,
  Undo2,
  ListTodo,
  Layers,
  CornerUpLeft,
  Folder,
  LayoutGrid,
} from 'lucide-react';

interface BacklogSectionProps {
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

// Normalizes any task to one of the 5 canonical stages
function getTaskStage(task: BacklogTask): TaskStage {
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

export const BacklogSection: React.FC<BacklogSectionProps> = ({
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
}) => {
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

  return (
    <div className="space-y-6">
      
      {/* =========================================================================
          HERO BANNER & EOD SYNTHESIS TRIGGER
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center">
            <Zap className="w-5 h-5 text-warning mr-2 shrink-0" />
            <span>Task Focus Workspace & 5-Stage Lifecycle</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[var(--accent)]/10 text-[var(--accent-text)] font-bold">
              {inProgress.length} ACTIVE FOCUS
            </span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Automatic time tracking per task · Transition between Planned, In Progress, Paused, Blocked & Done
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Switcher: Group by Status vs Group by Project */}
          <div className="flex items-center p-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-app)] text-xs">
            <button
              type="button"
              onClick={() => setGroupingMode('status')}
              className={`px-3 py-1.5 rounded-[var(--radius-btn)] transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                groupingMode === 'status'
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              title="Organize tasks by 5 lifecycle stages (In Progress, Paused, Blocked, Queue, Done)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>By Status</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupingMode('project')}
              className={`px-3 py-1.5 rounded-[var(--radius-btn)] transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                groupingMode === 'project'
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              title="Organize tasks grouped by Project with total time tracked"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>By Project</span>
            </button>
          </div>

          {onOpenEodSynthesizer && (
            <button
              type="button"
              onClick={() => onOpenEodSynthesizer(selectedTaskIds.size > 0 ? Array.from(selectedTaskIds) : undefined)}
              className="px-4 py-2 rounded-[var(--radius-btn)] bg-warning-solid hover:bg-warning-solid-hover text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Synthesize touched tasks into executive project logs with Gemini"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {selectedTaskIds.size > 0
                  ? `Synthesize Selected (${selectedTaskIds.size})`
                  : 'Synthesize EOD Logs'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODULE 1: PROJECT-FIRST QUICK TASK CREATOR
         ========================================================================= */}
      <div className="glass-panel p-4 sm:p-5 shadow-xs transition-all border border-[var(--border-app)] relative overflow-hidden">
        {activeTheme === 'modern' && (
          <div
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: selectedProject?.color || '#6366f1' }}
          />
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-app)]/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                {isMatrix ? (
                  <Terminal className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                )}
                <span>1. Select Project Context:</span>
              </span>

              {selectedProject && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold font-mono shadow-xs inline-flex items-center gap-1.5"
                  style={{ backgroundColor: selectedProject.color, color: readableOn(selectedProject.color) }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  <span>{selectedProject.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)] font-mono hidden sm:inline">
                Sticky Context Locked
              </span>
              {onAddProject && (
                <button
                  type="button"
                  onClick={() => setIsCreatingProject((v) => !v)}
                  className="px-2 py-1 rounded-[var(--radius-btn)] border border-[var(--border-app)] hover:border-[var(--border-focus)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-subtle-hover)] text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                  title="Create new project"
                >
                  <FolderPlus className="w-3 h-3 text-[var(--accent-text)]" />
                  <span>+ Project</span>
                </button>
              )}
            </div>
          </div>

          {/* New Project Inline Drawer */}
          {isCreatingProject && (
            <form
              onSubmit={handleCreateNewProject}
              className="p-3 rounded-[var(--radius-card)] bg-[var(--bg-subtle)] border border-[var(--border-app)] flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project Name (e.g. Mobile App Redesign)..."
                className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-btn)] text-[var(--text-main)] focus:outline-hidden focus:border-[var(--accent)]"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                {['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewProjectColor(color)}
                    className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                      newProjectColor === color ? 'scale-125 ring-2 ring-white ring-offset-1' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Save Project
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingProject(false)}
                className="px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Project Picker Horizontal Grid / Pill Row */}
          <div className="flex flex-wrap items-center gap-2">
            {activeProjects.map((project) => {
              const isSelected = project.id === selectedProjectId;
              const projectTasksCount = backlog.filter(
                (t) => t.projectId === project.id && getTaskStage(t) !== 'done'
              ).length;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-btn)] text-xs font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? isMatrix
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-text)] shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                        : isMinimalist
                        ? 'border-[var(--text-main)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-none'
                        : 'border-[var(--border-focus)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-sm ring-2'
                      : 'border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle-hover)]'
                  }`}
                  style={{
                    borderColor: isSelected && !isMinimalist && !isMatrix ? project.color : undefined,
                    boxShadow: isSelected && activeTheme === 'modern' ? `0 0 12px ${project.color}30` : undefined,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate max-w-[160px]">{project.name}</span>
                  
                  {projectTasksCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                        isSelected
                          ? 'bg-[var(--text-main)] text-[var(--bg-app)]'
                          : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
                      }`}
                    >
                      {projectTasksCount}
                    </span>
                  )}

                  {isSelected && (
                    <Check className="w-3 h-3 text-[var(--accent-text)] ml-0.5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Task Creation Input Bar */}
          <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={`Add a task for "${selectedProject?.name || 'Project'}"... (Press Enter)`}
                className="w-full bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] px-3.5 py-2 text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-hidden focus:border-[var(--border-focus)] transition-colors pr-24"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-subtle)] hidden sm:inline pointer-events-none">
                [↵ Enter]
              </span>
            </div>

            {/* Target Stage Mode: Planned vs Start Immediately */}
            <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-app)] shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setCreateStage('planned')}
                className={`px-2.5 py-1.5 rounded-[var(--radius-btn)] transition-all cursor-pointer font-medium flex items-center gap-1 ${
                  createStage === 'planned'
                    ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
                title="Save into Planned Queue to work on later"
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>To Queue</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateStage('in_progress')}
                className={`px-2.5 py-1.5 rounded-[var(--radius-btn)] transition-all cursor-pointer font-medium flex items-center gap-1 ${
                  createStage === 'in_progress'
                    ? 'bg-warning/20 text-warning border border-warning/30 font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
                title="Start working on this task immediately"
              >
                <Flame className="w-3.5 h-3.5 text-warning" />
                <span>Start Now</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!taskTitle.trim()}
              className="px-4 py-2 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:pointer-events-none text-[var(--on-accent)] text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              {createStage === 'in_progress' ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Work</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to Queue</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* =========================================================================
          MODULE 2: MOBILE RESPONSIVE SEGMENTED SWITCHER (<1024px)
         ========================================================================= */}
      <div className="lg:hidden flex items-center gap-1 p-1 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-app)] text-xs overflow-x-auto">
        <button
          onClick={() => setMobileTab('focus')}
          className={`flex-1 py-1.5 px-3 rounded-[var(--radius-btn)] whitespace-nowrap font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'focus'
              ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-warning" />
          <span>Active Focus ({inProgress.length})</span>
        </button>

        <button
          onClick={() => setMobileTab('queue')}
          className={`flex-1 py-1.5 px-3 rounded-[var(--radius-btn)] whitespace-nowrap font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'queue'
              ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <span>Queue ({planned.length})</span>
        </button>

        <button
          onClick={() => setMobileTab('paused_blocked')}
          className={`flex-1 py-1.5 px-3 rounded-[var(--radius-btn)] whitespace-nowrap font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'paused_blocked'
              ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Pause className="w-3.5 h-3.5 text-info" />
          <span>Paused/Blocked ({paused.length + blocked.length})</span>
        </button>

        <button
          onClick={() => setMobileTab('done')}
          className={`flex-1 py-1.5 px-3 rounded-[var(--radius-btn)] whitespace-nowrap font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'done'
              ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-app)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          <span>Done ({done.length})</span>
        </button>
      </div>

      {/* =========================================================================
          STRUCTURAL BRANCHING PER THEME
         ========================================================================= */}

      {/* ---------------- 1. MINIMALIST: NOTION-INSPIRED DOCUMENT VIEW ---------------- */}
      {isMinimalist ? (
        <div className="space-y-6 max-w-4xl mx-auto py-2">
          {/* Document Title / Context */}
          <div className="border-b border-[var(--border-app)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-serif font-bold text-[var(--text-main)] tracking-tight">
                {groupingMode === 'project' ? 'Project Notebook & Timelines' : "Today's Focus & Planned Queue"}
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {groupingMode === 'project'
                  ? 'Organized by project domain · Accumulated time tracking · Calm editorial narrative'
                  : 'Notion editorial view · Inline active focus · Zero card distraction'}
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {groupingMode === 'project' ? `${tasksByProject.length} Projects` : `${inProgress.length} Working · ${blocked.length} Blocked`}
            </span>
          </div>

          {/* 1A. BY PROJECT VIEW IN MINIMALIST */}
          {groupingMode === 'project' ? (
            <div className="space-y-8">
              {tasksByProject.map((group) => (
                <div key={group.project.id} className="space-y-3 pb-6 border-b border-[var(--border-app)] last:border-b-0">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-app)]/60">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.project.color }} />
                      <h2 className="text-base font-serif font-bold text-[var(--text-main)]">
                        {group.project.name}
                      </h2>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        · {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[var(--text-muted)]">Logged:</span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] font-semibold">
                        {formatDigitalTimer(group.totalSeconds)}
                      </span>
                    </div>
                  </div>

                  {group.tasks.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic py-2">No tasks assigned to this project.</p>
                  ) : (
                    <div className="divide-y divide-[var(--border-app)]">
                      {group.tasks.map((task) => {
                        const stage = getTaskStage(task);
                        const isWorking = stage === 'in_progress';
                        const isBlocked = stage === 'blocked';

                        return (
                          <div key={task.id} className={`py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group transition-opacity ${task.isSynthesized ? 'opacity-75' : ''}`}>
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <input
                                  type="checkbox"
                                  checked={selectedTaskIds.has(task.id)}
                                  onChange={() => handleToggleSelectTask(task.id)}
                                  className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                  title="Select task for EOD synthesis"
                                />
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                  isWorking ? 'bg-warning/15 text-warning' :
                                  isBlocked ? 'bg-danger/15 text-danger' :
                                  stage === 'paused' ? 'bg-info/15 text-info' :
                                  stage === 'done' ? 'bg-success/15 text-success line-through' :
                                  'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                                }`}>
                                  {isWorking ? 'WORKING' : isBlocked ? 'BLOCKED' : stage.toUpperCase()}
                                </span>
                                <span className={`font-medium text-[var(--text-main)] ${stage === 'done' ? 'line-through opacity-60' : ''}`}>
                                  {task.title}
                                </span>
                                {task.isSynthesized && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                    title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Logged to Sheet</span>
                                  </span>
                                )}
                              </div>
                              {task.blockReason && (
                                <p className="text-[11px] text-danger font-mono">
                                  Blocker: {task.blockReason}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 text-xs">
                              {task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                                <span className="font-mono text-xs text-[var(--text-muted)]">
                                  {formatDigitalTimer(task.elapsedSeconds)}
                                </span>
                              ) : null}

                              {isWorking ? (
                                <>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                    className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline cursor-pointer"
                                  >
                                    To Queue
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                    className="text-info hover:underline cursor-pointer"
                                  >
                                    Pause
                                  </button>
                                  <button
                                    onClick={() => handleStartBlocking(task)}
                                    className="text-danger hover:underline cursor-pointer"
                                  >
                                    Block
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'done')}
                                    className="text-success font-bold hover:underline cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </>
                              ) : isBlocked ? (
                                <>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                    className="text-warning font-semibold hover:underline cursor-pointer"
                                  >
                                    Resume
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                    className="text-[var(--text-muted)] hover:underline cursor-pointer"
                                  >
                                    To Queue
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'done')}
                                    className="text-success font-bold hover:underline cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </>
                              ) : stage === 'paused' ? (
                                <>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                    className="text-info font-semibold hover:underline cursor-pointer"
                                  >
                                    Resume
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                    className="text-[var(--text-muted)] hover:underline cursor-pointer"
                                  >
                                    To Queue
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'done')}
                                    className="text-success font-bold hover:underline cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </>
                              ) : stage === 'planned' ? (
                                <>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                    className="text-[var(--accent-text)] font-semibold hover:underline cursor-pointer"
                                  >
                                    Start
                                  </button>
                                  <button
                                    onClick={() => handleStartBlocking(task)}
                                    className="text-danger hover:underline cursor-pointer"
                                  >
                                    Block
                                  </button>
                                  <button
                                    onClick={() => onUpdateTaskStage(task.id, 'done')}
                                    className="text-success hover:underline cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </>
                              ) : (
                                onReopenTask && (
                                  <button
                                    onClick={() => onReopenTask(task.id)}
                                    className="text-[var(--accent-text)] hover:underline cursor-pointer"
                                  >
                                    Reopen
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (

            /* 1B. BY STATUS VIEW IN MINIMALIST (With Restored Blocked Section) */
            <div className="space-y-6">
              
              {/* In Progress Section */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warning font-mono flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>In Progress ({inProgress.length})</span>
                </h2>

                {inProgress.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic py-2">
                    No active tasks. Click [Start] on any queued task below.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-app)]">
                    {inProgress.map((task) => {
                      const proj = projects.find((p) => p.id === task.projectId);
                      const isBlocking = blockingTaskId === task.id;

                      return (
                        <div key={task.id} className={`py-3 space-y-2 group transition-opacity ${task.isSynthesized ? 'opacity-80' : ''}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <input
                                  type="checkbox"
                                  checked={selectedTaskIds.has(task.id)}
                                  onChange={() => handleToggleSelectTask(task.id)}
                                  className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                  title="Select task for EOD synthesis"
                                />
                                <span className="font-semibold text-[var(--text-main)]">{task.title}</span>
                                {proj && (
                                  <span className="text-[10px] text-[var(--text-muted)]">· {proj.name}</span>
                                )}
                                {task.isSynthesized && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                    title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                                  >
                                    <Check className="w-2.5 h-2.5 text-success" />
                                    <span>Logged to Sheet</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* Live Digital Timer */}
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-warning/10 text-warning font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-spin" />
                                <span>{formatDigitalTimer(task.elapsedSeconds)}</span>
                              </span>

                              {/* Re-plan */}
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline flex items-center gap-1 cursor-pointer"
                                title="Revert task to planned queue"
                              >
                                <CornerUpLeft className="w-3 h-3" />
                                <span>Re-plan</span>
                              </button>

                              {/* Pause */}
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                className="text-xs text-[var(--text-muted)] hover:text-info hover:underline cursor-pointer"
                              >
                                Pause
                              </button>

                              {/* Block Action */}
                              <button
                                type="button"
                                onClick={() => handleStartBlocking(task)}
                                className="text-xs text-[var(--text-muted)] hover:text-danger hover:underline cursor-pointer"
                              >
                                Block
                              </button>

                              {/* Done */}
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'done')}
                                className="text-xs font-bold text-success hover:underline cursor-pointer"
                              >
                                Done
                              </button>
                            </div>
                          </div>

                          {/* Minimalist Inline Blocker Input */}
                          {isBlocking && (
                            <div className="py-2 px-3 rounded bg-danger/10 border border-danger/30 flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-bold text-danger font-mono">Block Reason:</span>
                              <input
                                type="text"
                                value={blockerReasonInput}
                                onChange={(e) => setBlockerReasonInput(e.target.value)}
                                placeholder="e.g. Waiting on PR review or backend endpoint..."
                                className="flex-1 min-w-[200px] bg-[var(--bg-surface)] border border-danger/40 rounded px-2.5 py-1 text-xs text-[var(--text-main)] focus:outline-hidden"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmBlocking(task.id)}
                                className="px-3 py-1 text-xs font-bold rounded bg-danger-solid text-white cursor-pointer"
                              >
                                Confirm Blocked
                              </button>
                              <button
                                type="button"
                                onClick={() => setBlockingTaskId(null)}
                                className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dedicated Blocked & Roadblocks Section */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-app)]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-danger font-mono flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-danger" />
                  <span>Blocked & Roadblocks ({blocked.length})</span>
                </h2>

                {blocked.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic py-1">
                    No blocked tasks. All roadblocks cleared.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-app)]">
                    {blocked.map((task) => {
                      const proj = projects.find((p) => p.id === task.projectId);
                      return (
                        <div key={task.id} className={`py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-opacity ${task.isSynthesized ? 'opacity-80' : ''}`}>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={() => handleToggleSelectTask(task.id)}
                                className="w-3.5 h-3.5 rounded border-danger/40 accent-danger cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              <span className="font-semibold text-[var(--text-main)] truncate">{task.title}</span>
                              {proj && <span className="text-[10px] text-[var(--text-muted)]">· {proj.name}</span>}
                              {task.isSynthesized && (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                  title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                                >
                                  <Check className="w-2.5 h-2.5 text-success" />
                                  <span>Logged to Sheet</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-danger font-mono">
                              Blocker: {task.blockReason || 'Dependency halted'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                              className="px-2.5 py-1 rounded bg-warning/15 text-warning hover:bg-warning/25 font-bold cursor-pointer transition-colors"
                            >
                              Resume
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStage(task.id, 'planned')}
                              className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline cursor-pointer"
                            >
                              To Queue
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStage(task.id, 'done')}
                              className="text-success font-bold hover:underline cursor-pointer"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 text-[var(--text-muted)] hover:text-danger cursor-pointer"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Paused Tasks Section */}
              {paused.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-app)]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-info font-mono flex items-center gap-1.5">
                    <PauseCircle className="w-3.5 h-3.5 text-info" />
                    <span>Paused Tasks ({paused.length})</span>
                  </h2>

                  <div className="divide-y divide-[var(--border-app)]">
                    {paused.map((task) => (
                      <div key={task.id} className={`py-2 flex items-center justify-between gap-2 text-xs transition-opacity ${task.isSynthesized ? 'opacity-80' : ''}`}>
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => handleToggleSelectTask(task.id)}
                            className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                            title="Select task for EOD synthesis"
                          />
                          <span className="truncate text-[var(--text-muted)]">{task.title}</span>
                          {task.isSynthesized && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                              title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                            >
                              <Check className="w-2.5 h-2.5 text-success" />
                              <span>Logged to Sheet</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                            className="text-info hover:underline cursor-pointer font-semibold"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                            className="text-[var(--text-muted)] hover:underline cursor-pointer"
                          >
                            To Queue
                          </button>
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'done')}
                            className="text-success hover:underline cursor-pointer font-bold"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Planned Queue Section */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-app)]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>Queue Backlog ({planned.length})</span>
                </h2>

                {planned.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic py-2">Queue is empty.</p>
                ) : (
                  <div className="divide-y divide-[var(--border-app)]">
                    {planned.map((task) => {
                      const proj = projects.find((p) => p.id === task.projectId);
                      const isBlocking = blockingTaskId === task.id;

                      return (
                        <div key={task.id} className={`py-2.5 space-y-1.5 group transition-opacity ${task.isSynthesized ? 'opacity-80' : ''}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs truncate">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={() => handleToggleSelectTask(task.id)}
                                className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] shrink-0" />
                              <span className="font-medium text-[var(--text-main)] truncate">{task.title}</span>
                              {proj && <span className="text-[10px] text-[var(--text-muted)] shrink-0">· {proj.name}</span>}
                              {task.isSynthesized && (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                  title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                                >
                                  <Check className="w-2.5 h-2.5 text-success" />
                                  <span>Logged to Sheet</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                              >
                                Start
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartBlocking(task)}
                                className="text-xs text-[var(--text-muted)] hover:text-danger hover:underline cursor-pointer"
                              >
                                Block
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'done')}
                                className="text-xs text-[var(--text-muted)] hover:text-success hover:underline cursor-pointer"
                              >
                                Done
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTask(task.id)}
                                className="p-1 text-[var(--text-muted)] hover:text-danger cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Minimalist Inline Blocker Input */}
                          {isBlocking && (
                            <div className="py-2 px-3 rounded bg-danger/10 border border-danger/30 flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-bold text-danger font-mono">Block Reason:</span>
                              <input
                                type="text"
                                value={blockerReasonInput}
                                onChange={(e) => setBlockerReasonInput(e.target.value)}
                                placeholder="e.g. Waiting on PR review or backend endpoint..."
                                className="flex-1 min-w-[200px] bg-[var(--bg-surface)] border border-danger/40 rounded px-2.5 py-1 text-xs text-[var(--text-main)] focus:outline-hidden"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmBlocking(task.id)}
                                className="px-3 py-1 text-xs font-bold rounded bg-danger-solid text-white cursor-pointer"
                              >
                                Confirm Blocked
                              </button>
                              <button
                                type="button"
                                onClick={() => setBlockingTaskId(null)}
                                className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Completed Drawer in Minimalist */}
              {done.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-[var(--border-app)]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span>Completed Today ({done.length})</span>
                  </h2>
                  <div className="divide-y divide-[var(--border-app)]">
                    {done.map((task) => (
                      <div key={task.id} className={`py-2 flex items-center justify-between gap-2 text-xs transition-opacity ${task.isSynthesized ? 'opacity-80' : ''}`}>
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => handleToggleSelectTask(task.id)}
                            className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                            title="Select task for EOD synthesis"
                          />
                          <span className="line-through text-[var(--text-muted)] truncate">{task.title}</span>
                          {task.isSynthesized && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                              title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                            >
                              <Check className="w-2.5 h-2.5 text-success" />
                              <span>Logged to Sheet</span>
                            </span>
                          )}
                        </div>
                        {onReopenTask && (
                          <button
                            onClick={() => onReopenTask(task.id)}
                            className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      ) : isCompact ? (

        /* ---------------- 2. COMPACT: LINEAR HIGH-DENSITY DATA TABLE (SECTIONED) ---------------- */
        <div className="glass-panel overflow-x-auto shadow-xs border border-[var(--border-app)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] font-mono uppercase text-[10px] h-8 tracking-wider">
                <th className="p-2 w-28">Stage</th>
                <th className="p-2 w-36">Project</th>
                <th className="p-2">Task Description</th>
                <th className="p-2 w-28 text-center font-mono">Timer</th>
                <th className="p-2 w-52 text-right font-mono">Actions / Hotkeys</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-app)] font-mono text-[11px]">
              {groupingMode === 'project' ? (
                /* Compact: Sectioned by Project */
                tasksByProject.map((group) => {
                  const isCollapsed = collapsedStages[`proj_${group.project.id}`];
                  return (
                    <React.Fragment key={group.project.id}>
                      {/* Project Header Bar */}
                      <tr
                        onClick={() => toggleStageCollapse(`proj_${group.project.id}`)}
                        className="h-7 bg-[var(--bg-subtle)]/80 hover:bg-[var(--bg-subtle-hover)] cursor-pointer select-none border-t-2 border-[var(--border-app)]"
                      >
                        <td colSpan={5} className="px-2 py-1 font-bold text-[11px] text-[var(--text-main)]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: group.project.color }} />
                              <span className="uppercase tracking-wider font-mono">{group.project.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-app)] text-[var(--text-muted)]">
                                {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)] pr-2">
                              <span>TOTAL TIME TODAY:</span>
                              <span className="text-warning font-bold">{formatDigitalTimer(group.totalSeconds)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Project Tasks */}
                      {!isCollapsed && (
                        group.tasks.length === 0 ? (
                          <tr className="h-7 border-b border-[var(--border-app)]">
                            <td colSpan={5} className="p-2 text-center text-[var(--text-subtle)] text-[10px] font-mono">
                              No tasks for this project
                            </td>
                          </tr>
                        ) : (
                          group.tasks.map((task) => {
                            const stage = getTaskStage(task);
                            const isRunning = stage === 'in_progress';
                            const isBlocked = stage === 'blocked';
                            const isBlocking = blockingTaskId === task.id;

                            return (
                              <React.Fragment key={task.id}>
                                <tr
                                  className={`h-8 hover:bg-[var(--bg-subtle-hover)] transition-colors ${
                                    task.isSynthesized ? 'opacity-80 bg-success-solid/[0.04]' : ''
                                  } ${
                                    isRunning ? 'bg-warning/5 font-semibold' : ''
                                  }`}
                                >
                                  {/* Stage Badge */}
                                  <td className="p-2 whitespace-nowrap">
                                    {isRunning ? (
                                      <span className="text-warning font-bold">[IN_PROG]</span>
                                    ) : stage === 'paused' ? (
                                      <span className="text-info">[PAUSED]</span>
                                    ) : isBlocked ? (
                                      <span className="text-danger font-bold">[BLOCKED]</span>
                                    ) : stage === 'done' ? (
                                      <span className="text-success">[DONE]</span>
                                    ) : (
                                      <span className="text-[var(--text-muted)]">[QUEUE]</span>
                                    )}
                                  </td>

                                  {/* Project */}
                                  <td className="p-2 whitespace-nowrap">
                                    <span className="flex items-center gap-1.5 font-sans font-medium text-[var(--text-main)]">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: group.project.color }}
                                      />
                                      <span className="truncate max-w-[120px]">{group.project.name}</span>
                                    </span>
                                  </td>

                                  {/* Description */}
                                  <td className="p-2 font-sans text-xs text-[var(--text-main)]">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedTaskIds.has(task.id)}
                                        onChange={() => handleToggleSelectTask(task.id)}
                                        className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                        title="Select task for EOD synthesis"
                                      />
                                      <span className={stage === 'done' ? 'line-through opacity-60' : ''}>
                                        {task.title}
                                      </span>
                                      {task.isSynthesized && (
                                        <span
                                          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                          title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                        >
                                          <Check className="w-2.5 h-2.5 text-success" />
                                          <span>Logged to Sheet</span>
                                        </span>
                                      )}
                                      {task.blockReason && (
                                        <span className="text-[10px] text-danger font-mono">
                                          (Blocker: {task.blockReason})
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Timer */}
                                  <td className="p-2 text-center tabular-nums whitespace-nowrap">
                                    {isRunning ? (
                                      <span className="text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded">
                                        {formatDigitalTimer(task.elapsedSeconds)}
                                      </span>
                                    ) : task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                                      <span className="text-[var(--text-muted)]">
                                        {formatDigitalTimer(task.elapsedSeconds)}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--text-subtle)]">--:--:--</span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="p-2 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                      {isRunning ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] text-[10px] cursor-pointer"
                                            title="Back to Queue [Q]"
                                          >
                                            [Q] QUEUE
                                          </button>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                            className="px-1.5 py-0.5 rounded bg-info/20 text-info text-[10px] cursor-pointer"
                                            title="Pause [P]"
                                          >
                                            [P] PAUSE
                                          </button>
                                          <button
                                            onClick={() => handleStartBlocking(task)}
                                            className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-[10px] cursor-pointer"
                                            title="Block [B]"
                                          >
                                            [B] BLOCK
                                          </button>
                                        </>
                                      ) : isBlocked ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                            className="px-1.5 py-0.5 rounded bg-warning-solid hover:bg-warning-solid-hover text-on-solid text-[10px] font-bold cursor-pointer"
                                            title="Resume [R]"
                                          >
                                            [R] RESUME
                                          </button>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-[10px] cursor-pointer"
                                            title="Queue [Q]"
                                          >
                                            [Q] QUEUE
                                          </button>
                                        </>
                                      ) : stage === 'paused' ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                            className="px-1.5 py-0.5 rounded bg-info-solid hover:bg-info-solid-hover text-white text-[10px] font-bold cursor-pointer"
                                            title="Resume [R]"
                                          >
                                            [R] RESUME
                                          </button>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-[10px] cursor-pointer"
                                            title="Queue [Q]"
                                          >
                                            [Q] QUEUE
                                          </button>
                                        </>
                                      ) : stage === 'planned' ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-[10px] font-bold cursor-pointer"
                                            title="Start Work [S]"
                                          >
                                            [S] START
                                          </button>
                                          <button
                                            onClick={() => handleStartBlocking(task)}
                                            className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-[10px] cursor-pointer"
                                            title="Block [B]"
                                          >
                                            [B] BLOCK
                                          </button>
                                        </>
                                      ) : null}

                                      {stage !== 'done' && (
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'done')}
                                          className="px-1.5 py-0.5 rounded bg-success/20 hover:bg-success/30 text-success text-[10px] font-bold cursor-pointer"
                                          title="Done & Log [D]"
                                        >
                                          [D] DONE
                                        </button>
                                      )}

                                      {stage === 'done' && onReopenTask && (
                                        <button
                                          onClick={() => onReopenTask(task.id)}
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--accent-text)] text-[10px] cursor-pointer"
                                          title="Reopen"
                                        >
                                          [REOPEN]
                                        </button>
                                      )}

                                      <button
                                        onClick={() => onDeleteTask(task.id)}
                                        className="px-1 py-0.5 text-[var(--text-muted)] hover:text-danger text-[10px] cursor-pointer"
                                        title="Delete [DEL]"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Inline Blocker Prompt Row in Compact */}
                                {isBlocking && (
                                  <tr className="bg-danger/10 border-b border-danger/30">
                                    <td colSpan={5} className="p-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-danger font-bold whitespace-nowrap">BLOCK REASON:</span>
                                        <input
                                          type="text"
                                          value={blockerReasonInput}
                                          onChange={(e) => setBlockerReasonInput(e.target.value)}
                                          placeholder="e.g. Awaiting PR review or backend endpoint..."
                                          className="flex-1 bg-black/40 border border-danger/40 rounded px-2 py-0.5 text-xs text-[var(--text-main)] focus:outline-hidden"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleConfirmBlocking(task.id)}
                                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-danger-solid text-white cursor-pointer"
                                        >
                                          CONFIRM
                                        </button>
                                        <button
                                          onClick={() => setBlockingTaskId(null)}
                                          className="px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                                        >
                                          CANCEL
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                /* Compact: 5 Distinct Collapsible Stage Sections */
                [
                  { key: 'in_progress', label: 'IN PROGRESS', icon: Zap, accent: 'text-warning bg-warning/10 border-warning/30', count: inProgress.length, tasks: inProgress },
                  { key: 'paused', label: 'PAUSED', icon: PauseCircle, accent: 'text-info bg-info/10 border-info/30', count: paused.length, tasks: paused },
                  { key: 'blocked', label: 'BLOCKED', icon: AlertOctagon, accent: 'text-danger bg-danger/10 border-danger/30', count: blocked.length, tasks: blocked },
                  { key: 'planned', label: 'PLANNED QUEUE', icon: ListTodo, accent: 'text-[var(--text-muted)] bg-[var(--bg-subtle)] border-[var(--border-app)]', count: planned.length, tasks: planned },
                  { key: 'done', label: 'DONE', icon: CheckCircle2, accent: 'text-success bg-success/10 border-success/30', count: done.length, tasks: done },
                ].map((section) => {
                  const isCollapsed = collapsedStages[`stage_${section.key}`];
                  const SectionIcon = section.icon;

                  return (
                    <React.Fragment key={section.key}>
                      {/* Section Header Row */}
                      <tr
                        onClick={() => toggleStageCollapse(`stage_${section.key}`)}
                        className={`h-7 cursor-pointer select-none transition-colors border-t-2 border-[var(--border-app)] ${
                          section.key === 'in_progress' ? 'bg-warning/10 hover:bg-warning/15' :
                          section.key === 'blocked' ? 'bg-danger/10 hover:bg-danger/15' :
                          section.key === 'paused' ? 'bg-info/10 hover:bg-info/15' :
                          'bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)]'
                        }`}
                      >
                        <td colSpan={5} className="px-2 py-1 font-bold text-[11px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                              <SectionIcon className="w-3.5 h-3.5" />
                              <span className="tracking-wider">{section.label}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/20 text-[var(--text-main)]">
                                {section.count}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] pr-2">
                              {isCollapsed ? '[COLLAPSED - CLICK TO EXPAND]' : '[COLLAPSIBLE]'}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Section Tasks */}
                      {!isCollapsed && (
                        section.tasks.length === 0 ? (
                          <tr className="h-7 border-b border-[var(--border-app)]">
                            <td colSpan={5} className="p-2 text-center text-[var(--text-subtle)] text-[10px] font-mono">
                              No tasks in this stage
                            </td>
                          </tr>
                        ) : (
                          section.tasks.map((task) => {
                            const stage = getTaskStage(task);
                            const proj = projects.find((p) => p.id === task.projectId);
                            const isRunning = stage === 'in_progress';
                            const isBlocked = stage === 'blocked';
                            const isBlocking = blockingTaskId === task.id;

                            return (
                              <React.Fragment key={task.id}>
                                <tr
                                  className={`h-8 hover:bg-[var(--bg-subtle-hover)] transition-colors ${
                                    task.isSynthesized ? 'opacity-80 bg-success-solid/[0.04]' : ''
                                  } ${
                                    isRunning ? 'bg-warning/5 font-semibold' : ''
                                  }`}
                                >
                                  {/* Stage Badge */}
                                  <td className="p-2 whitespace-nowrap">
                                    {isRunning ? (
                                      <span className="text-warning font-bold">[IN_PROG]</span>
                                    ) : stage === 'paused' ? (
                                      <span className="text-info">[PAUSED]</span>
                                    ) : isBlocked ? (
                                      <span className="text-danger font-bold">[BLOCKED]</span>
                                    ) : stage === 'done' ? (
                                      <span className="text-success">[DONE]</span>
                                    ) : (
                                      <span className="text-[var(--text-muted)]">[QUEUE]</span>
                                    )}
                                  </td>

                                  {/* Project */}
                                  <td className="p-2 whitespace-nowrap">
                                    <span className="flex items-center gap-1.5 font-sans font-medium text-[var(--text-main)]">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: proj?.color || '#6366f1' }}
                                      />
                                      <span className="truncate max-w-[120px]">{proj?.name || 'General'}</span>
                                    </span>
                                  </td>

                                  {/* Description */}
                                  <td className="p-2 font-sans text-xs text-[var(--text-main)]">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedTaskIds.has(task.id)}
                                        onChange={() => handleToggleSelectTask(task.id)}
                                        className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                        title="Select task for EOD synthesis"
                                      />
                                      <span className={stage === 'done' ? 'line-through opacity-60' : ''}>
                                        {task.title}
                                      </span>
                                      {task.isSynthesized && (
                                        <span
                                          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                          title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                        >
                                          <Check className="w-2.5 h-2.5 text-success" />
                                          <span>Logged to Sheet</span>
                                        </span>
                                      )}
                                      {task.blockReason && (
                                        <span className="text-[10px] text-danger font-mono">
                                          (Blocker: {task.blockReason})
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Timer */}
                                  <td className="p-2 text-center tabular-nums whitespace-nowrap">
                                    {isRunning ? (
                                      <span className="text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded">
                                        {formatDigitalTimer(task.elapsedSeconds)}
                                      </span>
                                    ) : task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                                      <span className="text-[var(--text-muted)]">
                                        {formatDigitalTimer(task.elapsedSeconds)}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--text-subtle)]">--:--:--</span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="p-2 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                      {isRunning ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] text-[10px] cursor-pointer"
                                            title="Back to Queue [Q]"
                                          >
                                            [Q] QUEUE
                                          </button>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                            className="px-1.5 py-0.5 rounded bg-info/20 text-info text-[10px] cursor-pointer"
                                            title="Pause [P]"
                                          >
                                            [P] PAUSE
                                          </button>
                                          <button
                                            onClick={() => handleStartBlocking(task)}
                                            className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-[10px] cursor-pointer"
                                            title="Block [B]"
                                          >
                                            [B] BLOCK
                                          </button>
                                        </>
                                      ) : isBlocked ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                            className="px-1.5 py-0.5 rounded bg-warning-solid hover:bg-warning-solid-hover text-on-solid text-[10px] font-bold cursor-pointer"
                                            title="Resume [R]"
                                          >
                                            [R] RESUME
                                          </button>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-[10px] cursor-pointer"
                                            title="Queue [Q]"
                                          >
                                            [Q] QUEUE
                                          </button>
                                        </>
                                      ) : stage === 'paused' ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                            className="px-1.5 py-0.5 rounded bg-info-solid hover:bg-info-solid-hover text-white text-[10px] font-bold cursor-pointer"
                                            title="Resume [R]"
                                          >
                                            [R] RESUME
                                          </button>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-[10px] cursor-pointer"
                                            title="Queue [Q]"
                                          >
                                            [Q] QUEUE
                                          </button>
                                        </>
                                      ) : stage === 'planned' ? (
                                        <>
                                          <button
                                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                            className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-[10px] font-bold cursor-pointer"
                                            title="Start Work [S]"
                                          >
                                            [S] START
                                          </button>
                                          <button
                                            onClick={() => handleStartBlocking(task)}
                                            className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-[10px] cursor-pointer"
                                            title="Block [B]"
                                          >
                                            [B] BLOCK
                                          </button>
                                        </>
                                      ) : null}

                                      {stage !== 'done' && (
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'done')}
                                          className="px-1.5 py-0.5 rounded bg-success/20 hover:bg-success/30 text-success text-[10px] font-bold cursor-pointer"
                                          title="Done & Log [D]"
                                        >
                                          [D] DONE
                                        </button>
                                      )}

                                      {stage === 'done' && onReopenTask && (
                                        <button
                                          onClick={() => onReopenTask(task.id)}
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--accent-text)] text-[10px] cursor-pointer"
                                          title="Reopen"
                                        >
                                          [REOPEN]
                                        </button>
                                      )}

                                      <button
                                        onClick={() => onDeleteTask(task.id)}
                                        className="px-1 py-0.5 text-[var(--text-muted)] hover:text-danger text-[10px] cursor-pointer"
                                        title="Delete [DEL]"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Inline Blocker Prompt Row in Compact */}
                                {isBlocking && (
                                  <tr className="bg-danger/10 border-b border-danger/30">
                                    <td colSpan={5} className="p-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-danger font-bold whitespace-nowrap">BLOCK REASON:</span>
                                        <input
                                          type="text"
                                          value={blockerReasonInput}
                                          onChange={(e) => setBlockerReasonInput(e.target.value)}
                                          placeholder="e.g. Awaiting PR review or backend endpoint..."
                                          className="flex-1 bg-black/40 border border-danger/40 rounded px-2 py-0.5 text-xs text-[var(--text-main)] focus:outline-hidden"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleConfirmBlocking(task.id)}
                                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-danger-solid text-white cursor-pointer"
                                        >
                                          CONFIRM
                                        </button>
                                        <button
                                          onClick={() => setBlockingTaskId(null)}
                                          className="px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                                        >
                                          CANCEL
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : isMatrix ? (

        /* ---------------- 3. MATRIX CRT PROCESS TUI ---------------- */
        <div className="space-y-4 font-mono text-xs">
          
          {groupingMode === 'project' ? (
            /* Matrix: Sectioned by Project Domain */
            <div className="space-y-4">
              {tasksByProject.map((group) => (
                <div key={group.project.id} className="border border-[var(--accent)]/70 bg-[var(--bg-app)] p-4 space-y-3 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--accent)]/40 text-[var(--text-main)]">
                    <span className="font-bold">+--[ DOMAIN: {group.project.name.toUpperCase()} ]--+</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-[var(--text-muted)]">THREADS: {group.tasks.length}</span>
                      <span className="text-warning font-bold">CPU_TIME: {formatDigitalTimer(group.totalSeconds)}</span>
                    </div>
                  </div>

                  {group.tasks.length === 0 ? (
                    <p className="text-[var(--text-muted)] py-2 text-center">[NO PROCESS THREADS REGISTERED IN THIS DOMAIN]</p>
                  ) : (
                    <div className="space-y-2">
                      {group.tasks.map((task, idx) => {
                        const stage = getTaskStage(task);
                        const isRunning = stage === 'in_progress';
                        const isBlocked = stage === 'blocked';

                        return (
                          <div
                            key={task.id}
                            className={`p-2 border space-y-1.5 transition-colors ${
                              task.isSynthesized ? 'opacity-75 border-success/40' : ''
                            } ${
                              isRunning
                                ? 'border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-main)]'
                                : isBlocked
                                ? 'border-danger/60 bg-[var(--bg-app)] text-danger'
                                : 'border-[var(--border-app)] bg-[var(--bg-app)] text-[var(--text-muted)]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTaskIds.has(task.id)}
                                  onChange={() => handleToggleSelectTask(task.id)}
                                  className="w-3 h-3 rounded border-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                                  title="Select process for EOD synthesis"
                                />
                                <span className="font-bold">
                                  PID {2048 + idx} | [{stage.toUpperCase()}]
                                </span>
                                {task.isSynthesized && (
                                  <span
                                    className="text-[9px] text-success border border-success/50 bg-success/10 px-1 py-0.2 font-mono"
                                    title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                  >
                                    [LOGGED_TO_SHEET]
                                  </span>
                                )}
                              </div>
                              {task.elapsedSeconds && task.elapsedSeconds > 0 && (
                                <span className="text-warning font-bold">
                                  {formatDigitalTimer(task.elapsedSeconds)}
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-xs text-[var(--text-main)]">&gt; {task.title}</p>
                            {task.blockReason && (
                              <p className="text-danger text-[10px]">&gt;&gt; I/O WAIT: {task.blockReason}</p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-app)] text-[10px]">
                              {stage !== 'in_progress' && (
                                <button
                                  onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                  className="text-info hover:underline cursor-pointer"
                                >
                                  [EXEC]
                                </button>
                              )}
                              {isRunning && (
                                <button
                                  onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                  className="hover:text-warning cursor-pointer"
                                >
                                  [QUEUE]
                                </button>
                              )}
                              {stage !== 'done' && (
                                <button
                                  onClick={() => onUpdateTaskStage(task.id, 'done')}
                                  className="text-[var(--text-main)] font-bold hover:underline cursor-pointer"
                                >
                                  [TERMINATE]
                                </button>
                              )}
                              <button
                                onClick={() => onDeleteTask(task.id)}
                                className="text-danger cursor-pointer"
                              >
                                [KILL]
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Matrix: By Status Lifecycle Process Monitors */
            <>
              {/* Active Process Frame */}
              <div className="border border-[var(--accent)] bg-[var(--bg-app)] p-4 space-y-3 shadow-[0_0_15px_rgba(0,255,102,0.15)]">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--accent)]/40 text-[var(--text-main)]">
                  <span className="font-bold">+--[ ACTIVE PROCESSES (PID MONITOR) ]--+</span>
                  <span className="text-[var(--text-muted)] tabular-nums">
                    RUNNING: {inProgress.length} | SPOOL: {planned.length}
                  </span>
                </div>

                {inProgress.length === 0 ? (
                  <p className="text-[var(--text-muted)] py-4 text-center">
                    [NO ACTIVE PROCESSES IN EXECUTION STACK - READY TO FORK THREAD]
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inProgress.map((task, idx) => {
                      const proj = projects.find((p) => p.id === task.projectId);
                      return (
                        <div
                          key={task.id}
                          className={`p-2.5 border border-[var(--accent)]/60 bg-[var(--bg-surface)] space-y-2 text-[var(--text-main)] ${
                            task.isSynthesized ? 'opacity-80 border-success/40' : ''
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={() => handleToggleSelectTask(task.id)}
                                className="w-3.5 h-3.5 rounded border-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                                title="Select process for EOD synthesis"
                              />
                              <span className="font-bold">
                                PID {1024 + idx} | {proj?.name.toUpperCase() || 'GENERAL'}
                              </span>
                              {task.isSynthesized && (
                                <span
                                  className="text-[10px] text-success border border-success/50 bg-success/10 px-1.5 py-0.2 font-mono font-bold"
                                  title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                >
                                  [LOGGED_TO_SHEET]
                                </span>
                              )}
                            </div>
                            <span className="text-warning font-bold animate-pulse">
                              TIME: {formatDigitalTimer(task.elapsedSeconds)}
                            </span>
                          </div>

                          <p className="font-bold text-sm text-[var(--text-main)]">&gt; {task.title}</p>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-app)] text-[10px]">
                            <button
                              onClick={() => onUpdateTaskStage(task.id, 'planned')}
                              className="hover:text-warning cursor-pointer"
                            >
                              [REVERT_TO_QUEUE]
                            </button>
                            <button
                              onClick={() => onUpdateTaskStage(task.id, 'paused')}
                              className="hover:text-info cursor-pointer"
                            >
                              [PAUSE_THREAD]
                            </button>
                            <button
                              onClick={() => onUpdateTaskStage(task.id, 'done')}
                              className="text-[var(--text-main)] font-bold hover:underline cursor-pointer"
                            >
                              [TERMINATE_SUCCESS]
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Blocked Frame if any */}
              {blocked.length > 0 && (
                <div className="border border-danger/70 bg-[var(--bg-app)] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-danger/40 text-danger">
                    <span className="font-bold">+--[ BLOCKED PROCESSES (I/O WAIT STATE) ]--+</span>
                    <span className="text-danger">{blocked.length} HALTED</span>
                  </div>
                  <div className="space-y-2">
                    {blocked.map((task) => (
                      <div
                        key={task.id}
                        className={`p-2 border border-danger/30 bg-danger/10 text-danger flex items-center justify-between gap-2 text-[11px] ${
                          task.isSynthesized ? 'opacity-80 border-success/40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => handleToggleSelectTask(task.id)}
                            className="w-3.5 h-3.5 rounded border-danger accent-danger cursor-pointer shrink-0"
                            title="Select process for EOD synthesis"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold truncate">&gt; {task.title}</p>
                              {task.isSynthesized && (
                                <span
                                  className="text-[9px] text-success border border-success/50 bg-success/10 px-1 py-0.2 font-mono font-bold"
                                  title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                >
                                  [LOGGED_TO_SHEET]
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-danger/80">&gt;&gt; REASON: {task.blockReason || 'Waiting on I/O lock'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                            className="text-warning hover:underline cursor-pointer"
                          >
                            [RESUME]
                          </button>
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                            className="text-[var(--text-main)] hover:underline cursor-pointer"
                          >
                            [QUEUE]
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Process Queue Frame */}
              <div className="border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)] text-[var(--text-main)]">
                  <span className="font-bold">+--[ PROCESS QUEUE (WAITING TO FORK) ]--+</span>
                  <span className="text-[var(--text-muted)]">{planned.length} QUEUED</span>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {planned.map((task, idx) => (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between gap-2 p-2 border border-[var(--border-app)] hover:border-[var(--accent)]/40 bg-[var(--bg-app)] text-[11px] ${
                        task.isSynthesized ? 'opacity-80 border-success/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => handleToggleSelectTask(task.id)}
                          className="w-3 h-3 rounded border-[var(--accent)] accent-[var(--accent)] cursor-pointer shrink-0"
                          title="Select process for EOD synthesis"
                        />
                        <span className="truncate text-[var(--text-main)]">
                          [{idx + 1}] {task.title}
                        </span>
                        {task.isSynthesized && (
                          <span
                            className="text-[9px] text-success border border-success/50 bg-success/10 px-1 py-0.2 font-mono font-bold shrink-0"
                            title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                          >
                            [LOGGED_TO_SHEET]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                          className="text-info hover:underline cursor-pointer font-bold"
                        >
                          [FORK_THREAD]
                        </button>
                        <button
                          onClick={() => onUpdateTaskStage(task.id, 'done')}
                          className="text-[var(--text-main)] hover:underline cursor-pointer"
                        >
                          [MARK_DONE]
                        </button>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="text-danger cursor-pointer"
                        >
                          [KILL]
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Footer */}
              <div className="p-2 border border-[var(--border-app)] bg-[var(--bg-app)] text-[var(--text-muted)] flex justify-between text-[11px]">
                <span>[STATUS: NORMAL] -- {inProgress.length} RUNNING -- {planned.length} QUEUED</span>
                <span>EOD SYNTHESIS: READY</span>
              </div>
            </>
          )}

        </div>
      ) : groupingMode === 'project' ? (

        /* ---------------- 4A. MODERN SAAS: PROJECT WORKSPACES GRID ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {tasksByProject.map((group) => (
            <div
              key={group.project.id}
              className="glass-panel p-4 sm:p-5 shadow-xs transition-all space-y-4 border border-[var(--border-app)] backdrop-blur-xl relative overflow-hidden"
            >
              {/* Subtle Project Background Glow */}
              <div
                className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-15 pointer-events-none"
                style={{ backgroundColor: group.project.color }}
              />

              {/* Project Header */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-app)] pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: group.project.color }}
                  />
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] truncate">
                    {group.project.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[var(--bg-subtle)] border border-[var(--border-app)] text-[var(--text-muted)] shrink-0">
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>

                {/* Total Time Logged Today Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/25 text-warning font-mono text-xs font-bold shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{formatDigitalTimer(group.totalSeconds)}</span>
                </div>
              </div>

              {/* Project Tasks */}
              {group.tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-app)] rounded-[var(--radius-card)]">
                  No tasks logged or queued for this project yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {group.tasks.map((task) => {
                    const stage = getTaskStage(task);
                    const isRunning = stage === 'in_progress';
                    const isBlocked = stage === 'blocked';
                    const isBlocking = blockingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-[var(--radius-btn)] border transition-all space-y-2 ${
                          task.isSynthesized ? 'opacity-80 border-success/30' : ''
                        } ${
                          isRunning
                            ? 'border-warning/40 bg-warning/5 shadow-xs'
                            : isBlocked
                            ? 'border-danger/30 bg-danger/5'
                            : stage === 'paused'
                            ? 'border-info/30 bg-info/5'
                            : stage === 'done'
                            ? 'border-[var(--border-app)]/50 bg-[var(--bg-subtle)]/30 opacity-70'
                            : 'border-[var(--border-app)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={() => handleToggleSelectTask(task.id)}
                                className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                                  isRunning
                                    ? 'bg-warning/20 text-warning'
                                    : isBlocked
                                    ? 'bg-danger/20 text-danger'
                                    : stage === 'paused'
                                    ? 'bg-info/20 text-info'
                                    : stage === 'done'
                                    ? 'bg-success/20 text-success'
                                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                                }`}
                              >
                                {isRunning ? 'FOCUS' : stage.toUpperCase()}
                              </span>
                              <span
                                className={`text-xs font-semibold text-[var(--text-main)] ${
                                  stage === 'done' ? 'line-through opacity-60' : ''
                                }`}
                              >
                                {task.title}
                              </span>
                              {task.isSynthesized && (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                  title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                >
                                  <Check className="w-2.5 h-2.5 text-success" />
                                  <span>Logged to Sheet</span>
                                </span>
                              )}
                            </div>

                            {task.blockReason && (
                              <p className="text-[10px] text-danger font-mono">
                                Blocker: {task.blockReason}
                              </p>
                            )}
                          </div>

                          {/* Running or Recorded Timer */}
                          {task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                            <span
                              className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold shrink-0 ${
                                isRunning
                                  ? 'bg-warning/15 text-warning animate-pulse'
                                  : 'text-[var(--text-muted)] bg-[var(--bg-subtle)]'
                              }`}
                            >
                              {formatDigitalTimer(task.elapsedSeconds)}
                            </span>
                          ) : null}
                        </div>

                        {/* Inline Blocker Form */}
                        {isBlocking && (
                          <div className="p-2 rounded bg-danger/10 border border-danger/30 space-y-1.5">
                            <label className="text-[10px] font-bold text-danger font-mono">
                              What is blocking this task?
                            </label>
                            <input
                              type="text"
                              value={blockerReasonInput}
                              onChange={(e) => setBlockerReasonInput(e.target.value)}
                              placeholder="e.g. Awaiting backend deployment..."
                              className="w-full px-2 py-1 text-xs bg-[var(--bg-surface)] border border-danger/40 rounded text-[var(--text-main)] focus:outline-hidden"
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setBlockingTaskId(null)}
                                className="px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmBlocking(task.id)}
                                className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-danger-solid hover:bg-danger-solid-hover text-white cursor-pointer"
                              >
                                Confirm Blocked
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-[var(--border-app)]/40 text-[11px]">
                          <div className="flex items-center gap-1">
                            {isRunning ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                  className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] font-medium cursor-pointer"
                                >
                                  Queue
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                  className="px-2 py-0.5 rounded bg-info/15 text-info hover:bg-info/25 cursor-pointer"
                                >
                                  Pause
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartBlocking(task)}
                                  className="px-2 py-0.5 rounded bg-danger/15 text-danger hover:bg-danger/25 cursor-pointer"
                                >
                                  Block
                                </button>
                              </>
                            ) : isBlocked ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                  className="px-2.5 py-0.5 rounded bg-warning-solid hover:bg-warning-solid-hover text-on-solid font-bold cursor-pointer"
                                >
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                  className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] cursor-pointer"
                                >
                                  To Queue
                                </button>
                              </>
                            ) : stage === 'paused' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                  className="px-2.5 py-0.5 rounded bg-info-solid hover:bg-info-solid-hover text-white font-bold cursor-pointer"
                                >
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                  className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] cursor-pointer"
                                >
                                  To Queue
                                </button>
                              </>
                            ) : stage === 'planned' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                  className="px-2.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-bold cursor-pointer flex items-center gap-1"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>Start</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartBlocking(task)}
                                  className="px-2 py-0.5 rounded bg-danger/15 text-danger hover:bg-danger/25 cursor-pointer"
                                >
                                  Block
                                </button>
                              </>
                            ) : (
                              onReopenTask && (
                                <button
                                  type="button"
                                  onClick={() => onReopenTask(task.id)}
                                  className="text-[var(--accent-text)] hover:underline cursor-pointer"
                                >
                                  Reopen
                                </button>
                              )
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {stage !== 'done' && (
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'done')}
                                className="px-2 py-0.5 rounded bg-success/20 hover:bg-success/30 text-success font-bold cursor-pointer"
                              >
                                Done
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 text-[var(--text-muted)] hover:text-danger cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (

        /* ---------------- 4B. MODERN SAAS: 2-COLUMN GLASS COMMAND CENTER ---------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Active Workspace (Left 7 Cols) */}
          <div className={`lg:col-span-7 space-y-6 ${mobileTab !== 'focus' && mobileTab !== 'paused_blocked' && mobileTab !== 'done' ? 'hidden lg:block' : ''}`}>
            
            {/* Active Focus Card */}
            {(mobileTab === 'focus' || window.innerWidth >= 1024) && (
              <div className="glass-panel p-4 sm:p-5 shadow-xs transition-all space-y-4 border border-[var(--border-app)] backdrop-blur-xl">
                
                {/* Header */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-app)] pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-warning shrink-0" />
                    <h3 className="text-sm font-bold text-[var(--text-main)]">
                      Currently Working (Active Focus)
                    </h3>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning font-mono font-bold">
                    {inProgress.length} ACTIVE
                  </span>
                </div>

                {/* Cards */}
                {inProgress.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-[var(--border-app)] rounded-[var(--radius-card)] bg-[var(--bg-subtle)]/40 text-[var(--text-muted)] space-y-2">
                    <Flame className="w-8 h-8 mx-auto text-warning/50 mb-1" />
                    <p className="text-xs sm:text-sm font-semibold text-[var(--text-main)]">
                      No active focus task right now
                    </p>
                    <p className="text-xs max-w-md mx-auto text-[var(--text-muted)]">
                      Pick a task from the <span className="text-[var(--accent-text)] font-semibold">Planned Queue</span> on the right and click <span className="font-mono font-bold text-[var(--text-main)]">[Start Work]</span> to enter high-velocity focus!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inProgress.map((task) => {
                      const project = projects.find((p) => p.id === task.projectId);
                      const isBlockingThis = blockingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-[var(--radius-card)] border bg-gradient-to-br from-[var(--bg-surface-elevated)] to-[var(--bg-subtle)] shadow-md transition-all space-y-3 ${
                            task.isSynthesized
                              ? 'opacity-85 border-success/40 '
                              : 'border-warning/30 '
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={() => handleToggleSelectTask(task.id)}
                                className="w-4 h-4 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              {project && (
                                <span
                                  className="text-[11px] px-2.5 py-0.5 rounded-full font-bold font-mono shadow-xs inline-flex items-center gap-1"
                                  style={{ backgroundColor: project.color, color: readableOn(project.color) }}
                                >
                                  <span>{project.name}</span>
                                </span>
                              )}
                              {task.isSynthesized && (
                                <span
                                  className="text-[10px] text-success font-mono flex items-center gap-1 bg-success/10 border border-success/25 px-2 py-0.5 rounded-full font-bold"
                                  title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                >
                                  <Check className="w-3 h-3 text-success" />
                                  <span>Logged to Sheet</span>
                                </span>
                              )}
                            </div>

                            {/* Live Running Digital Timer Badge */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 border border-warning/30 text-warning font-mono text-xs font-bold shadow-xs">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span className="tabular-nums">{formatDigitalTimer(task.elapsedSeconds)}</span>
                            </div>
                          </div>

                          <h4 className="text-sm sm:text-base font-bold text-[var(--text-main)] leading-snug">
                            {task.title}
                          </h4>

                          {/* Blocker input */}
                          {isBlockingThis && (
                            <div className="p-2.5 rounded-[var(--radius-btn)] bg-danger/10 border border-danger/30 space-y-2 animate-in fade-in duration-150">
                              <label className="text-[11px] font-bold text-danger flex items-center gap-1">
                                <Ban className="w-3.5 h-3.5" />
                                <span>What is blocking this task?</span>
                              </label>
                              <input
                                type="text"
                                value={blockerReasonInput}
                                onChange={(e) => setBlockerReasonInput(e.target.value)}
                                placeholder="e.g. Awaiting PR review from backend team..."
                                className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] border border-danger/40 rounded text-[var(--text-main)] focus:outline-hidden"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setBlockingTaskId(null)}
                                  className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmBlocking(task.id)}
                                  className="px-3 py-1 text-xs font-bold rounded bg-danger-solid hover:bg-danger-solid-hover text-white cursor-pointer"
                                >
                                  Confirm Blocked
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Action Toolbar with Missing State Transition [Back to Queue] */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-app)]/60">
                            
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStage(task.id, 'done')}
                              className="px-3.5 py-1.5 rounded-[var(--radius-btn)] bg-success-solid hover:bg-success-solid-hover text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Complete task and log"
                            >
                              <Check className="w-4 h-4 mr-1.5" />
                              <span>Mark Done</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {/* EXPLICIT [Back to Queue] BUTTON */}
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                className="px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-app)] hover:border-[var(--text-main)] bg-[var(--bg-subtle)] text-xs text-[var(--text-main)] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Pause timer and move back into Planned Queue"
                              >
                                <RotateCcw className="w-4 h-4 mr-1.5" />
                                <span>Back to Queue</span>
                              </button>

                              {/* Pause */}
                              <button
                                type="button"
                                onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                className="px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-app)] hover:border-info bg-[var(--bg-subtle)] hover:bg-info/10 text-xs text-[var(--text-main)] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Pause this task temporarily"
                              >
                                <Pause className="w-3 h-3 text-info" />
                                <span>Pause</span>
                              </button>

                              {/* Block */}
                              <button
                                type="button"
                                onClick={() => handleStartBlocking(task)}
                                className="px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-app)] hover:border-danger bg-[var(--bg-subtle)] hover:bg-danger/10 text-xs text-[var(--text-main)] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Mark task as blocked"
                              >
                                <Ban className="w-3 h-3 text-danger" />
                                <span>Block</span>
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => onDeleteTask(task.id)}
                                className="p-1.5 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-danger hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Paused & Blocked Drawers */}
            {(mobileTab === 'paused_blocked' || window.innerWidth >= 1024) && (
              <div className="space-y-4">
                {paused.length > 0 && (
                  <div className="glass-panel p-4 shadow-xs space-y-3 border border-info/20 bg-info/5">
                    <div className="flex items-center justify-between pb-2 border-b border-info/20">
                      <h4 className="text-xs font-bold text-info flex items-center gap-1.5 uppercase font-mono">
                        <PauseCircle className="w-3.5 h-3.5 text-info" />
                        <span>Paused Tasks ({paused.length})</span>
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {paused.map((task) => (
                        <div
                          key={task.id}
                          className={`p-2.5 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-app)] flex items-center justify-between gap-2 text-xs transition-all ${
                            task.isSynthesized ? 'opacity-80 border-success/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.has(task.id)}
                              onChange={() => handleToggleSelectTask(task.id)}
                              className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                              title="Select task for EOD synthesis"
                            />
                            <span className="font-semibold truncate">{task.title}</span>
                            {task.isSynthesized && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Logged to Sheet</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                              className="px-2.5 py-1 rounded bg-info-solid text-white font-bold text-[11px] cursor-pointer"
                            >
                              Resume
                            </button>
                            <button
                              onClick={() => onUpdateTaskStage(task.id, 'planned')}
                              className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-main)] text-[11px] cursor-pointer"
                            >
                              Queue
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {blocked.length > 0 && (
                  <div className="glass-panel p-4 shadow-xs space-y-3 border border-danger/25 bg-danger/5">
                    <div className="flex items-center justify-between pb-2 border-b border-danger/20">
                      <h4 className="text-xs font-bold text-danger flex items-center gap-1.5 uppercase font-mono">
                        <AlertOctagon className="w-3.5 h-3.5 text-danger" />
                        <span>Blocked Tasks ({blocked.length})</span>
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {blocked.map((task) => (
                        <div
                          key={task.id}
                          className={`p-3 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-danger/30 space-y-2 text-xs transition-all ${
                            task.isSynthesized ? 'opacity-80 border-success/30' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={() => handleToggleSelectTask(task.id)}
                                className="w-3.5 h-3.5 rounded border-danger/40 accent-danger cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              <span className="font-bold truncate">{task.title}</span>
                              {task.isSynthesized && (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                  title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                >
                                  <Check className="w-2.5 h-2.5 text-success" />
                                  <span>Logged to Sheet</span>
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                              className="px-3 py-1 rounded bg-warning-solid text-white font-bold text-[11px] cursor-pointer shrink-0"
                            >
                              Unblock & Resume
                            </button>
                          </div>
                          <p className="text-[11px] text-danger">Blocker: {task.blockReason || 'Dependency halted'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Completed Drawer */}
            {(mobileTab === 'done' || window.innerWidth >= 1024) && (
              <div className="glass-panel p-4 shadow-xs space-y-3 border border-[var(--border-app)]">
                <button
                  type="button"
                  onClick={() => setIsCompletedOpen((v) => !v)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-xs font-bold text-[var(--text-main)]">
                      Completed Today ({done.length})
                    </span>
                  </div>
                  {isCompletedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isCompletedOpen && (
                  <div className="space-y-2 pt-2 border-t border-[var(--border-app)]/60">
                    {done.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] text-center py-2 font-mono">
                        No tasks completed today yet.
                      </p>
                    ) : (
                      done.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded bg-[var(--bg-subtle)]/40 border border-[var(--border-app)] text-xs transition-all ${
                            task.isSynthesized ? 'opacity-80 border-success/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.has(task.id)}
                              onChange={() => handleToggleSelectTask(task.id)}
                              className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                              title="Select task for EOD synthesis"
                            />
                            <span className="line-through text-[var(--text-muted)] truncate">{task.title}</span>
                            {task.isSynthesized && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Logged to Sheet</span>
                              </span>
                            )}
                          </div>
                          {onReopenTask && (
                            <button
                              onClick={() => onReopenTask(task.id)}
                              className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer shrink-0"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Planned Queue Sidebar (Right 5 Cols) */}
          <div className={`lg:col-span-5 space-y-4 ${mobileTab !== 'queue' ? 'hidden lg:block' : ''}`}>
            <div className="glass-panel p-4 sm:p-5 shadow-xs transition-all space-y-3.5 border border-[var(--border-app)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-app)] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-[var(--accent-text)]" />
                    <span>The Planned Queue</span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Backlog awaiting active focus
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-app)] text-[var(--text-main)] font-mono font-bold">
                  {planned.length} QUEUED
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Filter queue..."
                    className="w-full bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] pl-7 pr-2 py-1 text-xs text-[var(--text-main)] focus:outline-hidden"
                  />
                </div>
                <select
                  value={queueProjectFilter}
                  onChange={(e) => setQueueProjectFilter(e.target.value)}
                  className="bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] px-2 py-1 text-xs text-[var(--text-main)] focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Items */}
              <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-0.5">
                {filteredPlannedTasks.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-[var(--border-app)] rounded-[var(--radius-card)] text-xs text-[var(--text-muted)] font-mono">
                    Queue is empty.
                  </div>
                ) : (
                  filteredPlannedTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)] transition-all space-y-2.5 ${
                          task.isSynthesized ? 'opacity-80 border-success/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.has(task.id)}
                              onChange={() => handleToggleSelectTask(task.id)}
                              className="w-3.5 h-3.5 rounded border-[var(--border-app)] accent-warning cursor-pointer shrink-0"
                              title="Select task for EOD synthesis"
                            />
                            {project && (
                              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-main)]">
                                <span
                                  className="w-2 h-2 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: project.color }}
                                />
                                <span className="truncate max-w-[140px]">{project.name}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {task.isRolledOver && (
                              <span className="text-[10px] text-warning font-bold font-mono bg-warning/10 px-1.5 py-0.2 rounded">
                                Rolled over
                              </span>
                            )}
                            {task.isSynthesized && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Logged to Sheet</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-[var(--text-main)] leading-snug">
                          {task.title}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-app)]/50">
                          <button
                            type="button"
                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                            className="px-3 py-1.5 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Start Work</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStage(task.id, 'done')}
                              className="p-1.5 text-[var(--text-muted)] hover:text-success rounded transition-colors cursor-pointer"
                              title="Complete & Log"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1.5 text-[var(--text-muted)] hover:text-danger rounded transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Granular Task Multi-Selection Floating Action Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-warning-solid animate-pulse" />
            <span className="text-xs font-mono font-bold text-[var(--text-main)]">
              {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'task' : 'tasks'} selected
            </span>
          </div>
          <div className="h-4 w-px bg-[var(--border-app)]" />
          <button
            type="button"
            onClick={handleSynthesizeSelected}
            className="px-4 py-1.5 rounded-full bg-warning-solid hover:bg-warning-solid-hover text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Synthesize Selected ({selectedTaskIds.size})</span>
          </button>
          <button
            type="button"
            onClick={handleClearSelection}
            className="px-2.5 py-1.5 rounded-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

    </div>
  );
};
