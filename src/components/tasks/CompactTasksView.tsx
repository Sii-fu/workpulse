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
  ChevronDown,
  ChevronRight,
  Zap,
  Check,
  ListTodo,
} from 'lucide-react';

// Compact: sectioned high-density table.
export const CompactTasksView: React.FC<{ m: TasksModel }> = ({ m }) => {
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
    collapsedStages,
    toggleStageCollapse,
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

      /* ---------------- 2. COMPACT: LINEAR HIGH-DENSITY DATA TABLE (SECTIONED) ---------------- */
      <div className="glass-panel overflow-x-auto shadow-xs border border-[var(--border-app)]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] font-mono uppercase text-xs h-8 tracking-wider">
              <th className="p-2 w-28">Stage</th>
              <th className="p-2 w-36">Project</th>
              <th className="p-2">Task Description</th>
              <th className="p-2 w-28 text-center font-mono">Timer</th>
              <th className="p-2 w-52 text-right font-mono">Actions / Hotkeys</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-app)] font-mono text-xs">
            {groupingMode === 'project' ? (
              /* Compact: Sectioned by Project */
              tasksByProject.map((group) => {
                const isCollapsed = collapsedStages[`proj_${group.project.id}`];
                return (
                  <React.Fragment key={group.project.id}>
                    {/* Project Header Bar */}
                    <tr
                      onClick={() => toggleStageCollapse(`proj_${group.project.id}`)}
                      tabIndex={0}
                      aria-expanded={!isCollapsed}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStageCollapse(`proj_${group.project.id}`); } }}
                      className="h-7 bg-[var(--bg-subtle)]/80 hover:bg-[var(--bg-subtle-hover)] cursor-pointer select-none border-t-2 border-[var(--border-app)]"
                    >
                      <td colSpan={5} className="px-2 py-1 font-bold text-xs text-[var(--text-main)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: group.project.color }} />
                            <span className="uppercase tracking-wider font-mono">{group.project.name}</span>
                            <span className="text-xs px-1.5 py-0.2 rounded bg-[var(--bg-app)] text-[var(--text-muted)]">
                              {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)] pr-2">
                            <span>TOTAL TIME TODAY:</span>
                            <span className="text-warning font-bold">{<GroupClock tasks={group.tasks} />}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Project Tasks */}
                    {!isCollapsed && (
                      group.tasks.length === 0 ? (
                        <tr className="h-7 border-b border-[var(--border-app)]">
                          <td colSpan={5} className="p-2 text-center text-[var(--text-subtle)] text-xs font-mono">
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
                                      className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                                      title="Select task for EOD synthesis"
                                    />
                                    <span className={stage === 'done' ? 'line-through opacity-60' : ''}>
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
                                    {task.blockReason && (
                                      <span className="text-xs text-danger font-mono">
                                        (Blocker: {task.blockReason})
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Timer */}
                                <td className="p-2 text-center tabular-nums whitespace-nowrap">
                                  {isRunning ? (
                                    <span className="text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded">
                                      {<TaskClock task={task} />}
                                    </span>
                                  ) : task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                                    <span className="text-[var(--text-muted)]">
                                      {<TaskClock task={task} />}
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
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] text-xs cursor-pointer"
                                          title="Back to Queue [Q]"
                                        >
                                          [Q] QUEUE
                                        </button>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                          className="px-1.5 py-0.5 rounded bg-info/20 text-info text-xs cursor-pointer"
                                          title="Pause [P]"
                                        >
                                          [P] PAUSE
                                        </button>
                                        <button
                                          onClick={() => handleStartBlocking(task)}
                                          className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-xs cursor-pointer"
                                          title="Block [B]"
                                        >
                                          [B] BLOCK
                                        </button>
                                      </>
                                    ) : isBlocked ? (
                                      <>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold cursor-pointer"
                                          title="Resume [R]"
                                        >
                                          [R] RESUME
                                        </button>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-xs cursor-pointer"
                                          title="Queue [Q]"
                                        >
                                          [Q] QUEUE
                                        </button>
                                      </>
                                    ) : stage === 'paused' ? (
                                      <>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                          className="px-1.5 py-0.5 rounded bg-info-solid hover:bg-info-solid-hover text-white text-xs font-bold cursor-pointer"
                                          title="Resume [R]"
                                        >
                                          [R] RESUME
                                        </button>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-xs cursor-pointer"
                                          title="Queue [Q]"
                                        >
                                          [Q] QUEUE
                                        </button>
                                      </>
                                    ) : stage === 'planned' ? (
                                      <>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold cursor-pointer"
                                          title="Start Work [S]"
                                        >
                                          [S] START
                                        </button>
                                        <button
                                          onClick={() => handleStartBlocking(task)}
                                          className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-xs cursor-pointer"
                                          title="Block [B]"
                                        >
                                          [B] BLOCK
                                        </button>
                                      </>
                                    ) : null}

                                    {stage !== 'done' && (
                                      <button
                                        onClick={() => onUpdateTaskStage(task.id, 'done')}
                                        className="px-1.5 py-0.5 rounded bg-success/20 hover:bg-success/30 text-success text-xs font-bold cursor-pointer"
                                        title="Done & Log [D]"
                                      >
                                        [D] DONE
                                      </button>
                                    )}

                                    {stage === 'done' && onReopenTask && (
                                      <button
                                        onClick={() => onReopenTask(task.id)}
                                        className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--accent-text)] text-xs cursor-pointer"
                                        title="Reopen"
                                      >
                                        [REOPEN]
                                      </button>
                                    )}

                                    <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="text" />
                                    <button
                                      onClick={() => onDeleteTask(task.id)}
                                      className="px-1 py-0.5 text-[var(--text-muted)] hover:text-danger text-xs cursor-pointer"
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
                                      <span className="text-xs font-mono text-danger font-bold whitespace-nowrap">BLOCK REASON:</span>
                                      <input
                                        type="text"
                                        value={blockerReasonInput}
                                        onChange={(e) => setBlockerReasonInput(e.target.value)}
                                        aria-label="Reason for blocking"
                                        placeholder="e.g. Awaiting PR review or backend endpoint..."
                                        className="flex-1 bg-black/40 border border-danger/40 rounded px-2 py-0.5 text-xs text-[var(--text-main)]"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleConfirmBlocking(task.id)}
                                        className="px-2 py-0.5 text-xs font-bold rounded bg-danger-solid text-white cursor-pointer"
                                      >
                                        CONFIRM
                                      </button>
                                      <button
                                        onClick={() => setBlockingTaskId(null)}
                                        className="px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
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
                      tabIndex={0}
                      aria-expanded={!collapsedStages[`stage_${section.key}`]}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStageCollapse(`stage_${section.key}`); } }}
                      className={`h-7 cursor-pointer select-none transition-colors border-t-2 border-[var(--border-app)] ${
                        section.key === 'in_progress' ? 'bg-warning/10 hover:bg-warning/15' :
                        section.key === 'blocked' ? 'bg-danger/10 hover:bg-danger/15' :
                        section.key === 'paused' ? 'bg-info/10 hover:bg-info/15' :
                        'bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)]'
                      }`}
                    >
                      <td colSpan={5} className="px-2 py-1 font-bold text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                            <SectionIcon className="w-3.5 h-3.5" />
                            <span className="tracking-wider">{section.label}</span>
                            <span className="text-xs px-1.5 py-0.2 rounded-full font-mono bg-black/20 text-[var(--text-main)]">
                              {section.count}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-[var(--text-muted)] pr-2">
                            {isCollapsed ? '[COLLAPSED - CLICK TO EXPAND]' : '[COLLAPSIBLE]'}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Section Tasks */}
                    {!isCollapsed && (
                      section.tasks.length === 0 ? (
                        <tr className="h-7 border-b border-[var(--border-app)]">
                          <td colSpan={5} className="p-2 text-center text-[var(--text-subtle)] text-xs font-mono">
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
                                      className="w-3.5 h-3.5 rounded border-[var(--border-control)] accent-warning cursor-pointer shrink-0"
                                      title="Select task for EOD synthesis"
                                    />
                                    <span className={stage === 'done' ? 'line-through opacity-60' : ''}>
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
                                    {task.blockReason && (
                                      <span className="text-xs text-danger font-mono">
                                        (Blocker: {task.blockReason})
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Timer */}
                                <td className="p-2 text-center tabular-nums whitespace-nowrap">
                                  {isRunning ? (
                                    <span className="text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded">
                                      {<TaskClock task={task} />}
                                    </span>
                                  ) : task.elapsedSeconds && task.elapsedSeconds > 0 ? (
                                    <span className="text-[var(--text-muted)]">
                                      {<TaskClock task={task} />}
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
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle-hover)] text-[var(--text-main)] text-xs cursor-pointer"
                                          title="Back to Queue [Q]"
                                        >
                                          [Q] QUEUE
                                        </button>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'paused')}
                                          className="px-1.5 py-0.5 rounded bg-info/20 text-info text-xs cursor-pointer"
                                          title="Pause [P]"
                                        >
                                          [P] PAUSE
                                        </button>
                                        <button
                                          onClick={() => handleStartBlocking(task)}
                                          className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-xs cursor-pointer"
                                          title="Block [B]"
                                        >
                                          [B] BLOCK
                                        </button>
                                      </>
                                    ) : isBlocked ? (
                                      <>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold cursor-pointer"
                                          title="Resume [R]"
                                        >
                                          [R] RESUME
                                        </button>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-xs cursor-pointer"
                                          title="Queue [Q]"
                                        >
                                          [Q] QUEUE
                                        </button>
                                      </>
                                    ) : stage === 'paused' ? (
                                      <>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                          className="px-1.5 py-0.5 rounded bg-info-solid hover:bg-info-solid-hover text-white text-xs font-bold cursor-pointer"
                                          title="Resume [R]"
                                        >
                                          [R] RESUME
                                        </button>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'planned')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)] text-xs cursor-pointer"
                                          title="Queue [Q]"
                                        >
                                          [Q] QUEUE
                                        </button>
                                      </>
                                    ) : stage === 'planned' ? (
                                      <>
                                        <button
                                          onClick={() => onUpdateTaskStage(task.id, 'in_progress')}
                                          className="px-1.5 py-0.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold cursor-pointer"
                                          title="Start Work [S]"
                                        >
                                          [S] START
                                        </button>
                                        <button
                                          onClick={() => handleStartBlocking(task)}
                                          className="px-1.5 py-0.5 rounded bg-danger/20 text-danger text-xs cursor-pointer"
                                          title="Block [B]"
                                        >
                                          [B] BLOCK
                                        </button>
                                      </>
                                    ) : null}

                                    {stage !== 'done' && (
                                      <button
                                        onClick={() => onUpdateTaskStage(task.id, 'done')}
                                        className="px-1.5 py-0.5 rounded bg-success/20 hover:bg-success/30 text-success text-xs font-bold cursor-pointer"
                                        title="Done & Log [D]"
                                      >
                                        [D] DONE
                                      </button>
                                    )}

                                    {stage === 'done' && onReopenTask && (
                                      <button
                                        onClick={() => onReopenTask(task.id)}
                                        className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--accent-text)] text-xs cursor-pointer"
                                        title="Reopen"
                                      >
                                        [REOPEN]
                                      </button>
                                    )}

                                    <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="text" />
                                    <button
                                      onClick={() => onDeleteTask(task.id)}
                                      className="px-1 py-0.5 text-[var(--text-muted)] hover:text-danger text-xs cursor-pointer"
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
                                      <span className="text-xs font-mono text-danger font-bold whitespace-nowrap">BLOCK REASON:</span>
                                      <input
                                        type="text"
                                        value={blockerReasonInput}
                                        onChange={(e) => setBlockerReasonInput(e.target.value)}
                                        aria-label="Reason for blocking"
                                        placeholder="e.g. Awaiting PR review or backend endpoint..."
                                        className="flex-1 bg-black/40 border border-danger/40 rounded px-2 py-0.5 text-xs text-[var(--text-main)]"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleConfirmBlocking(task.id)}
                                        className="px-2 py-0.5 text-xs font-bold rounded bg-danger-solid text-white cursor-pointer"
                                      >
                                        CONFIRM
                                      </button>
                                      <button
                                        onClick={() => setBlockingTaskId(null)}
                                        className="px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
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
  );
};
