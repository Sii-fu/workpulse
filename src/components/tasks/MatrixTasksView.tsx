import React from 'react';
import { Project } from '../../types';
import { getTaskStage } from './helpers';
import { TaskClock, GroupClock } from './Clock';
import { LogDetailsButton } from './LogDetailsButton';
import { SampleBadge } from '../ui/SampleBadge';
import { isSampleTask } from '../../data/sampleData';
import type { TasksModel } from './useTasksModel';

// Matrix: tasks as a process table.
export const MatrixTasksView: React.FC<{ m: TasksModel }> = ({ m }) => {
  const {
    projects,
    onUpdateTaskStage,
    onDeleteTask,
    onLogWithDetails,
    selectedTaskIds,
    handleToggleSelectTask,
    groupingMode,
    inProgress,
    paused,
    blocked,
    planned,
    done,
    tasksByProject,
  } = m;

  return (

      /* ---------------- 3. MATRIX CRT PROCESS TUI ---------------- */
      <div className="space-y-4 font-mono text-xs">
        
        {groupingMode === 'project' ? (
          /* Matrix: Sectioned by Project Domain */
          <div className="space-y-4">
            {tasksByProject.map((group) => (
              <div key={group.project.id} className="border border-[var(--accent)]/70 bg-[var(--bg-app)] p-4 space-y-3 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--accent)]/40 text-[var(--text-main)]">
                  <span className="font-bold">+--[ DOMAIN: {group.project.name.toUpperCase()} ]--+</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[var(--text-muted)]">THREADS: {group.tasks.length}</span>
                    <span className="text-warning font-bold">CPU_TIME: {<GroupClock tasks={group.tasks} />}</span>
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
                          <div className="flex items-center justify-between text-xs">
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
                                  className="text-xs text-success border border-success/50 bg-success/10 px-1 py-0.2 font-mono"
                                  title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                >
                                  [LOGGED_TO_SHEET]
                                </span>
                              )}
                            </div>
                            {task.elapsedSeconds && task.elapsedSeconds > 0 && (
                              <span className="text-warning font-bold">
                                {<TaskClock task={task} />}
                              </span>
                            )}
                          </div>

                          <p className="font-bold text-xs text-[var(--text-main)]">&gt; {task.title}</p>
                          {task.blockReason && (
                            <p className="text-danger text-xs">&gt;&gt; I/O WAIT: {task.blockReason}</p>
                          )}

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-app)] text-xs">
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
                            <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="bracket" />
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
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
                                className="text-xs text-success border border-success/50 bg-success/10 px-1.5 py-0.2 font-mono font-bold"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                [LOGGED_TO_SHEET]
                              </span>
                            )}
                          </div>
                          <span className="text-warning font-bold animate-pulse">
                            TIME: {<TaskClock task={task} />}
                          </span>
                        </div>

                        <p className="font-bold text-sm text-[var(--text-main)]">&gt; {task.title}</p>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-app)] text-xs">
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
                      className={`p-2 border border-danger/30 bg-danger/10 text-danger flex items-center justify-between gap-2 text-xs ${
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
                                className="text-xs text-success border border-success/50 bg-success/10 px-1 py-0.2 font-mono font-bold"
                                title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                              >
                                [LOGGED_TO_SHEET]
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-danger/80">&gt;&gt; REASON: {task.blockReason || 'Waiting on I/O lock'}</p>
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
                    className={`flex items-center justify-between gap-2 p-2 border border-[var(--border-app)] hover:border-[var(--accent)]/40 bg-[var(--bg-app)] text-xs ${
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
                          className="text-xs text-success border border-success/50 bg-success/10 px-1 py-0.2 font-mono font-bold shrink-0"
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
                      <SampleBadge show={isSampleTask(task)} />
<LogDetailsButton task={task} onLogWithDetails={onLogWithDetails} variant="bracket" />
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
            <div className="p-2 border border-[var(--border-app)] bg-[var(--bg-app)] text-[var(--text-muted)] flex justify-between text-xs">
              <span>[STATUS: NORMAL] -- {inProgress.length} RUNNING -- {planned.length} QUEUED</span>
              <span>EOD SYNTHESIS: READY</span>
            </div>
          </>
        )}

      </div>
  );
};
