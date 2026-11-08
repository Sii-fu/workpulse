import React from 'react';
import { Project } from '../../types';
import { readableOn } from '../../utils/color';
import { getTaskStage } from './helpers';
import { TaskClock, GroupClock } from './Clock';
import { LogDetailsButton } from './LogDetailsButton';
import { SampleBadge } from '../ui/SampleBadge';
import { isSampleTask } from '../../data/sampleData';
import type { TasksModel } from './useTasksModel';
import {
  Play,
  CheckCircle2,
  Pause,
  PauseCircle,
  AlertOctagon,
  Ban,
  RotateCcw,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
  Flame,
  Search,
  ListTodo,
} from 'lucide-react';

// Modern: project workspaces or the two-column command centre, per the grouping switch.
export const ModernTasksView: React.FC<{ m: TasksModel }> = ({ m }) => {
  const {
    projects,
    onUpdateTaskStage,
    onDeleteTask,
    onLogWithDetails,
    onReopenTask,
    selectedTaskIds,
    handleToggleSelectTask,
    activeProjects,
    mobileTab,
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
    inProgress,
    paused,
    blocked,
    planned,
    done,
    tasksByProject,
    filteredPlannedTasks,
    handleStartBlocking,
    handleConfirmBlocking,
  } = m;

  return (
    groupingMode === 'project' ? (

      /* ---------------- 4A. MODERN SAAS: PROJECT WORKSPACES GRID ---------------- */
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {tasksByProject.map((group) => (
          <div
            key={group.project.id}
            className="glass-panel p-4 sm:p-5 shadow-xs transition-all space-y-4 border border-[var(--border-app)] relative overflow-hidden"
          >
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
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-[var(--bg-subtle)] border border-[var(--border-app)] text-[var(--text-muted)] shrink-0">
                  {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              {/* Total Time Logged Today Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/25 text-warning font-mono text-xs font-bold shrink-0">
                <Clock className="w-3 h-3" />
                <span>{<GroupClock tasks={group.tasks} />}</span>
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
                              className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                              title="Select task for EOD synthesis"
                            />
                            <span
                              className={`text-xs font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
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
                                className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Logged to Sheet</span>
                              </span>
                            )}
                          </div>

                          {task.blockReason && (
                            <p className="text-xs text-danger font-mono">
                              Blocker: {task.blockReason}
                            </p>
                          )}
                        </div>

                        {/* Running or Recorded Timer */}
                        {task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded font-bold shrink-0 ${
                              isRunning
                                ? 'bg-warning/15 text-warning animate-pulse'
                                : 'text-[var(--text-muted)] bg-[var(--bg-subtle)]'
                            }`}
                          >
                            {<TaskClock task={task} />}
                          </span>
                        ) : null}
                      </div>

                      {/* Inline Blocker Form */}
                      {isBlocking && (
                        <div className="p-2 rounded bg-danger/10 border border-danger/30 space-y-1.5">
                          <label className="text-xs font-bold text-danger font-mono">
                            What is blocking this task?
                          </label>
                          <input
                            type="text"
                            value={blockerReasonInput}
                            onChange={(e) => setBlockerReasonInput(e.target.value)}
                            aria-label="Reason for blocking"
                            placeholder="e.g. Awaiting backend deployment..."
                            className="w-full px-2 py-1 text-xs bg-[var(--bg-surface)] border border-danger/40 rounded text-[var(--text-main)]"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBlockingTaskId(null)}
                              className="px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmBlocking(task.id)}
                              className="px-2.5 py-0.5 text-xs font-bold rounded bg-danger-solid hover:bg-danger-solid-hover text-white cursor-pointer"
                            >
                              Confirm Blocked
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-[var(--border-app)]/40 text-xs">
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
                                className="px-2.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-bold cursor-pointer"
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
                          <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="icon" />
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
            <div className="glass-panel p-4 sm:p-5 shadow-xs transition-all space-y-4 border border-[var(--border-app)]">
              
              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-app)] pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning shrink-0" />
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    Running now
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
                        className={`p-4 rounded-[var(--radius-card)] border bg-[var(--bg-surface-elevated)] transition-all space-y-3 ${
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
                              className="w-4 h-4 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                              title="Select task for EOD synthesis"
                            />
                            {project && (
                              <span
                                className="text-xs px-2.5 py-0.5 rounded-full font-bold font-mono shadow-xs inline-flex items-center gap-1"
                                style={{ backgroundColor: project.color, color: readableOn(project.color) }}
                              >
                                <span>{project.name}</span>
                              </span>
                            )}
                            {task.isSynthesized && (
                              <span
                                className="text-xs text-success font-mono flex items-center gap-1 bg-success/10 border border-success/25 px-2 py-0.5 rounded-full font-bold"
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
                            <span className="tabular-nums">{<TaskClock task={task} />}</span>
                          </div>
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-[var(--text-main)] leading-snug">
                          {task.title}
                        </h4>

                        {/* Blocker input */}
                        {isBlockingThis && (
                          <div className="p-2.5 rounded-[var(--radius-btn)] bg-danger/10 border border-danger/30 space-y-2 animate-in fade-in duration-150">
                            <label className="text-xs font-bold text-danger flex items-center gap-1">
                              <Ban className="w-3.5 h-3.5" />
                              <span>What is blocking this task?</span>
                            </label>
                            <input
                              type="text"
                              value={blockerReasonInput}
                              onChange={(e) => setBlockerReasonInput(e.target.value)}
                              aria-label="Reason for blocking"
                              placeholder="e.g. Awaiting PR review from backend team..."
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] border border-danger/40 rounded text-[var(--text-main)]"
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
                              className="px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-control)] hover:border-[var(--text-main)] bg-[var(--bg-subtle)] text-xs text-[var(--text-main)] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Pause timer and move back into Planned Queue"
                            >
                              <RotateCcw className="w-4 h-4 mr-1.5" />
                              <span>Back to Queue</span>
                            </button>

                            {/* Pause */}
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStage(task.id, 'paused')}
                              className="px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-control)] hover:border-info bg-[var(--bg-subtle)] hover:bg-info/10 text-xs text-[var(--text-main)] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Pause this task temporarily"
                            >
                              <Pause className="w-3 h-3 text-info" />
                              <span>Pause</span>
                            </button>

                            {/* Block */}
                            <button
                              type="button"
                              onClick={() => handleStartBlocking(task)}
                              className="px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-control)] hover:border-danger bg-[var(--bg-subtle)] hover:bg-danger/10 text-xs text-[var(--text-main)] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark task as blocked"
                            >
                              <Ban className="w-3 h-3 text-danger" />
                              <span>Block</span>
                            </button>

                            {/* Delete */}
                            <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="icon" />
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
                    <h4 className="text-xs font-bold text-info flex items-center gap-1.5">
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
                            className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                            title="Select task for EOD synthesis"
                          />
                          <span className="font-semibold truncate">{task.title}</span>
                          {task.isSynthesized && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
                            className="px-2.5 py-1 rounded bg-info-solid text-white font-bold text-xs cursor-pointer"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'planned')}
                            className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs cursor-pointer"
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
                    <h4 className="text-xs font-bold text-danger flex items-center gap-1.5">
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
                                className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Logged to Sheet</span>
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                            className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold text-xs cursor-pointer shrink-0"
                          >
                            Unblock & Resume
                          </button>
                        </div>
                        <p className="text-xs text-danger">Blocker: {task.blockReason || 'Dependency halted'}</p>
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
                            className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                            title="Select task for EOD synthesis"
                          />
                          <span className="line-through text-[var(--text-muted)] truncate">{task.title}</span>
                          {task.isSynthesized && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
                            className="text-xs text-[var(--accent-text)] hover:underline cursor-pointer shrink-0"
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
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
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
                  aria-label="Filter task queue"
                  placeholder="Filter queue..."
                  className="w-full bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] pl-7 pr-2 py-1 text-xs text-[var(--text-main)]"
                />
              </div>
              <select
                value={queueProjectFilter}
                onChange={(e) => setQueueProjectFilter(e.target.value)}
                className="bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] px-2 py-1 text-xs text-[var(--text-main)] cursor-pointer"
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
                            className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                            title="Select task for EOD synthesis"
                          />
                          {project && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
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
                            <span className="text-xs text-warning font-bold font-mono bg-warning/10 px-1.5 py-0.2 rounded">
                              Rolled over
                            </span>
                          )}
                          {task.isSynthesized && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
                          <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="icon" />
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
    )
  );
};
