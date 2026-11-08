import React from 'react';
import { Project } from '../../types';
import { getTaskStage } from './helpers';
import { TaskClock, GroupClock } from './Clock';
import { LogDetailsButton } from './LogDetailsButton';
import { SampleBadge } from '../ui/SampleBadge';
import { isSampleTask } from '../../data/sampleData';
import type { TasksModel } from './useTasksModel';
import {
  CheckCircle2,
  Pause,
  PauseCircle,
  AlertOctagon,
  Trash2,
  Clock,
  Check,
  Flame,
  ListTodo,
  CornerUpLeft,
} from 'lucide-react';

// Minimalist: the tasks as a quiet document.
export const MinimalistTasksView: React.FC<{ m: TasksModel }> = ({ m }) => {
  const {
    projects,
    onUpdateTaskStage,
    onDeleteTask,
    onLogWithDetails,
    onReopenTask,
    selectedTaskIds,
    handleToggleSelectTask,
    blockingTaskId,
    setBlockingTaskId,
    blockerReasonInput,
    setBlockerReasonInput,
    groupingMode,
    inProgress,
    paused,
    blocked,
    planned,
    done,
    tasksByProject,
    handleStartBlocking,
    handleConfirmBlocking,
  } = m;

  return (
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
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      · {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-[var(--text-muted)]">Logged:</span>
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] font-semibold">
                      {<GroupClock tasks={group.tasks} />}
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
                                className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              <span className={`text-xs font-mono px-1.5 py-0.2 rounded font-bold ${
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
                                  className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                  title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                                >
                                  <Check className="w-2.5 h-2.5" />
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

                          <div className="flex items-center gap-2.5 shrink-0 text-xs">
                            {task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                              <span className="font-mono text-xs text-[var(--text-muted)]">
                                {<TaskClock task={task} />}
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
              <h2 className="text-xs font-bold text-warning flex items-center gap-1.5">
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
                                className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                                title="Select task for EOD synthesis"
                              />
                              <span className="font-semibold text-[var(--text-main)]">{task.title}</span>
                              {proj && (
                                <span className="text-xs text-[var(--text-muted)]">· {proj.name}</span>
                              )}
                              {task.isSynthesized && (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
                              <span>{<TaskClock task={task} />}</span>
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
                              aria-label="Reason for blocking"
                              placeholder="e.g. Waiting on PR review or backend endpoint..."
                              className="flex-1 min-w-[200px] bg-[var(--bg-surface)] border border-danger/40 rounded px-2.5 py-1 text-xs text-[var(--text-main)]"
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
              <h2 className="text-xs font-bold text-danger flex items-center gap-1.5">
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
                            {proj && <span className="text-xs text-[var(--text-muted)]">· {proj.name}</span>}
                            {task.isSynthesized && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
                                title={task.synthesizedAt ? `Logged to Sheet at ${new Date(task.synthesizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Logged to Sheet'}
                              >
                                <Check className="w-2.5 h-2.5 text-success" />
                                <span>Logged to Sheet</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-danger font-mono">
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
                          <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="icon" />
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
                <h2 className="text-xs font-bold text-info flex items-center gap-1.5">
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
                          className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                          title="Select task for EOD synthesis"
                        />
                        <span className="truncate text-[var(--text-muted)]">{task.title}</span>
                        {task.isSynthesized && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
              <h2 className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1.5">
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
                              className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                              title="Select task for EOD synthesis"
                            />
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] shrink-0" />
                            <span className="font-medium text-[var(--text-main)] truncate">{task.title}</span>
                            {proj && <span className="text-xs text-[var(--text-muted)] shrink-0">· {proj.name}</span>}
                            {task.isSynthesized && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
                            <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="icon" />
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
                              aria-label="Reason for blocking"
                              placeholder="e.g. Waiting on PR review or backend endpoint..."
                              className="flex-1 min-w-[200px] bg-[var(--bg-surface)] border border-danger/40 rounded px-2.5 py-1 text-xs text-[var(--text-main)]"
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
                <h2 className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1.5">
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
                          className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                          title="Select task for EOD synthesis"
                        />
                        <span className="line-through text-[var(--text-muted)] truncate">{task.title}</span>
                        {task.isSynthesized && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold shrink-0"
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
                          className="text-xs text-[var(--accent-text)] hover:underline cursor-pointer"
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
  );
};
