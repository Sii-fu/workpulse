import React from 'react';
import { Project } from '../../types';
import { readableOn } from '../../utils/color';
import { getTaskStage } from './helpers';
import type { TasksModel } from './useTasksModel';
import {
  Play,
  CheckCircle2,
  Pause,
  Plus,
  FolderPlus,
  Zap,
  Check,
  Terminal,
  Flame,
  ClipboardCheck,
  ListTodo,
  Layers,
  Folder,
  LayoutGrid,
} from 'lucide-react';

// The banner, project picker and quick task creator shared by every theme.
export const TasksHeader: React.FC<{ m: TasksModel }> = ({ m }) => {
  const {
    backlog,
    activeTheme,
    onAddProject,
    onOpenEodSynthesizer,
    isMatrix,
    isMinimalist,
    selectedTaskIds,
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
    groupingMode,
    setGroupingMode,
    inProgress,
    paused,
    blocked,
    planned,
    done,
    handleQuickAdd,
    handleCreateNewProject,
  } = m;

  return (
<>
    
    {/* =========================================================================
        HERO BANNER & EOD SYNTHESIS TRIGGER
       ========================================================================= */}
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] shadow-xs">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center">
          <Zap className="w-5 h-5 text-warning mr-2 shrink-0" />
          <span>Tasks</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-[var(--accent)]/10 text-[var(--accent-text)] font-bold">
            {inProgress.length} running
          </span>
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Time is tracked while a task runs. Move tasks between planned, running, paused, blocked and done.
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
            className="px-4 py-2 rounded-[var(--radius-btn)] border border-[var(--border-control)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-main)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="End of day: turn today's tasks into timesheet logs and push them to the Sheet"
          >
            <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {selectedTaskIds.size > 0
                ? `Timesheet from selected (${selectedTaskIds.size})`
                : 'End of day'}
            </span>
          </button>
        )}
      </div>
    </div>

    {/* =========================================================================
        MODULE 1: PROJECT-FIRST QUICK TASK CREATOR
       ========================================================================= */}
    <div className="glass-panel p-4 sm:p-5 shadow-xs transition-all border border-[var(--border-app)] relative overflow-hidden">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-app)]/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              {isMatrix ? (
                <Terminal className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              ) : (
                <Layers className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              )}
              <span>Project:</span>
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
            {onAddProject && (
              <button
                type="button"
                onClick={() => setIsCreatingProject((v) => !v)}
                className="px-2 py-1 rounded-[var(--radius-btn)] border border-[var(--border-control)] hover:border-[var(--border-focus)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-subtle-hover)] text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
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
              aria-label="Project name"
              placeholder="Project Name (e.g. Mobile App Redesign)..."
              className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border-control)] rounded-[var(--radius-btn)] text-[var(--text-main)] focus:border-[var(--accent)]"
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
                    : 'border-[var(--border-control)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle-hover)]'
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
                    className={`text-xs px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
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
              aria-label="New task title"
              placeholder={`Add a task for "${selectedProject?.name || 'Project'}"... (Press Enter)`}
              className="w-full bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-3.5 py-2 text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:border-[var(--border-focus)] transition-colors pr-24"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-subtle)] hidden sm:inline pointer-events-none">
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
            ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-control)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
        }`}
      >
        <Flame className="w-3.5 h-3.5 text-warning" />
        <span>Running ({inProgress.length})</span>
      </button>

      <button
        onClick={() => setMobileTab('queue')}
        className={`flex-1 py-1.5 px-3 rounded-[var(--radius-btn)] whitespace-nowrap font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
          mobileTab === 'queue'
            ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-control)]'
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
            ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-control)]'
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
            ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs border border-[var(--border-control)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        <span>Done ({done.length})</span>
      </button>
    </div>

</>
  );
};
