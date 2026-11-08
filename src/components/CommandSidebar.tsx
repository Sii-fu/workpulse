import React, { useState } from 'react';
import { defaultProject } from '../utils/projects';
import { localDateStr } from '../utils/dates';
import { BacklogTask, Project, ThemeId, WorkLog } from '../types';
import {
  ListTodo,
  Layers,
  Sparkles,
  Plus,
  CheckCircle2,
  Circle,
  ArrowRight,
  Trash2,
  RotateCcw,
  ChevronRight,
  Send,
  Zap,
  FileEdit,
  CloudUpload,
  X,
  Check,
  Pause,
  AlertOctagon,
} from 'lucide-react';

interface CommandSidebarProps {
  backlog: BacklogTask[];
  projects: Project[];
  logs: WorkLog[];
  activeTheme: ThemeId;
  onAddTask: (title: string, projectId: string) => void;
  onToggleTask: (taskId: string) => void;
  onConvertTaskToLog: (task: BacklogTask) => void;
  onLogWithDetails?: (task: BacklogTask) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenAiStandup: () => void;
}

export const CommandSidebar: React.FC<CommandSidebarProps> = ({
  backlog,
  projects,
  logs,
  activeTheme,
  onAddTask,
  onToggleTask,
  onConvertTaskToLog,
  onLogWithDetails,
  onDeleteTask,
  onOpenAiStandup,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'standup'>('tasks');
  const [newTitle, setNewTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProject(projects)?.id || '');
  const [recentlyCompletedTaskId, setRecentlyCompletedTaskId] = useState<string | null>(null);

  const todayStr = localDateStr();
  const pendingTasks = backlog.filter((t) => !t.completed);
  const rolledOverCount = pendingTasks.filter((t) => t.isRolledOver).length;
  const todayLogs = logs.filter((l) => l.date === todayStr);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), selectedProjectId || defaultProject(projects)?.id || 'default');
    setNewTitle('');
  };

  return (
    <aside className="glass-panel overflow-hidden transition-all flex flex-col">
      {/* Widget Header with Sleek Segmented Switcher */}
      <div className="p-3 border-b border-[var(--border-app)] flex items-center justify-between gap-2 bg-[var(--bg-subtle)]/40">
        <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-app)]">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ListTodo className="w-3 h-3" />
            <span>Tasks</span>
            {pendingTasks.length > 0 && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-[var(--accent)] text-white font-mono leading-none">
                {pendingTasks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'projects'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Projects</span>
          </button>

          <button
            onClick={() => setActiveTab('standup')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-btn)] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'standup'
                ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[var(--accent)]" />
            <span>Standup</span>
          </button>
        </div>

        {activeTheme === 'matrix' && (
          <span className="font-mono text-[10px] text-[var(--accent)] tracking-wider">
            [CMD_DOCK]
          </span>
        )}
      </div>

      {/* Widget Body */}
      <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[500px]">
        
        {/* TAB 1: PLANNED TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {/* Rollover notice banner if any */}
            {rolledOverCount > 0 && (
              <div className="p-2 rounded-[var(--radius-btn)] border border-amber-500/20 bg-amber-500/10 text-amber-500 dark:text-amber-400 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>{rolledOverCount} task(s) rolled over from yesterday</span>
                </span>
              </div>
            )}

            {/* Quick add input */}
            <form onSubmit={handleAddTask} className="flex gap-1.5">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New planned task for today... (Enter)"
                className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] px-2.5 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)]/60 focus:outline-hidden focus:border-[var(--border-focus)] transition-all"
              />
              <button
                type="submit"
                className="p-1.5 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                title="Add planned task"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {/* Tasks listing */}
            <div className="space-y-2">
              {pendingTasks.length === 0 && !recentlyCompletedTaskId ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-app)] rounded-[var(--radius-card)]">
                  All tasks completed for today!
                </div>
              ) : (
                backlog
                  .filter((t) => !t.completed || t.id === recentlyCompletedTaskId)
                  .map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const isJustCompleted = recentlyCompletedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`group flex flex-col p-2 rounded-[var(--radius-btn)] border transition-all ${
                          task.isSynthesized
                            ? 'opacity-80 border-emerald-500/25 bg-[var(--bg-subtle)]/30'
                            : task.completed
                            ? 'bg-[var(--bg-subtle)]/30 border-[var(--border-app)]'
                            : 'bg-[var(--bg-subtle)]/40 hover:bg-[var(--bg-subtle-hover)] border-[var(--border-app)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (!task.completed) {
                                  onToggleTask(task.id);
                                  setRecentlyCompletedTaskId(task.id);
                                } else {
                                  onToggleTask(task.id);
                                  if (recentlyCompletedTaskId === task.id) {
                                    setRecentlyCompletedTaskId(null);
                                  }
                                }
                              }}
                              className="text-[var(--text-muted)] hover:text-[var(--accent)] shrink-0 cursor-pointer"
                              title={task.completed ? 'Mark pending' : 'Check off task'}
                            >
                              {task.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs font-medium truncate ${
                                  task.completed
                                    ? 'line-through text-[var(--text-muted)]'
                                    : 'text-[var(--text-main)]'
                                }`}
                              >
                                {task.title}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] flex-wrap">
                                {project && (
                                  <span className="flex items-center gap-1">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full inline-block"
                                      style={{ backgroundColor: project.color }}
                                    />
                                    <span>{project.name}</span>
                                  </span>
                                )}
                                {task.isSynthesized && (
                                  <span
                                    className="text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded-full text-[9px] flex items-center gap-1"
                                    title={task.synthesizedAt ? `Logged to Sheet on ${new Date(task.synthesizedAt).toLocaleTimeString()}` : 'Logged to Sheet'}
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Logged to Sheet</span>
                                  </span>
                                )}
                                {task.stage === 'in_progress' && (
                                  <span className="text-amber-400 font-mono font-bold bg-amber-500/10 px-1 py-0.2 rounded flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5 fill-current" />
                                    <span>Active</span>
                                  </span>
                                )}
                                {task.stage === 'paused' && (
                                  <span className="text-blue-400 font-mono bg-blue-500/10 px-1 py-0.2 rounded flex items-center gap-1">
                                    <Pause className="w-2.5 h-2.5" />
                                    <span>Paused</span>
                                  </span>
                                )}
                                {task.stage === 'blocked' && (
                                  <span className="text-rose-400 font-mono font-bold bg-rose-500/10 px-1 py-0.2 rounded flex items-center gap-1">
                                    <AlertOctagon className="w-2.5 h-2.5" />
                                    <span>Blocked</span>
                                  </span>
                                )}
                                {task.isRolledOver && (
                                  <span className="text-amber-500 font-mono">
                                    · Rolled over
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Explicit Actions: [Log Work] and [Log with Details] */}
                          <div className="flex items-center gap-1 shrink-0">
                            {!task.completed && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onConvertTaskToLog(task)}
                                  className="px-2 py-0.5 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[10px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                  title="Instantly convert task into official Work Log (syncs to Google Sheet)"
                                >
                                  <Zap className="w-2.5 h-2.5 fill-current" />
                                  <span>Log</span>
                                </button>

                                {onLogWithDetails && (
                                  <button
                                    type="button"
                                    onClick={() => onLogWithDetails(task)}
                                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-[var(--radius-btn)] transition-colors cursor-pointer"
                                    title="Log with Details (copies task into Daily Logger)"
                                  >
                                    <FileEdit className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
                              title="Delete task"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Interactive Checkbox Flow: Prompt on Completion */}
                        {isJustCompleted && (
                          <div className="mt-2 p-1.5 rounded-[var(--radius-btn)] bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-1 text-[11px] text-emerald-400 animate-in fade-in slide-in-from-top-1 duration-150">
                            <span className="truncate flex items-center gap-1">
                              <CloudUpload className="w-3 h-3 shrink-0" />
                              <span>Completed! Push to log?</span>
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onConvertTaskToLog(task);
                                  setRecentlyCompletedTaskId(null);
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                              >
                                <Zap className="w-2.5 h-2.5 fill-current" />
                                <span>Push</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecentlyCompletedTaskId(null)}
                                className="p-0.5 text-emerald-400 hover:text-emerald-200 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE PROJECTS */}
        {activeTab === 'projects' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pb-1">
              <span>Initiative</span>
              <span className="font-mono">Logs</span>
            </div>

            {projects
              .filter((p) => !p.isArchived)
              .map((p) => {
                const count = logs.filter((l) => l.projectId === p.id).length;
                const totalLogs = logs.length || 1;
                const pct = Math.round((count / totalLogs) * 100);

                return (
                  <div
                    key={p.id}
                    className="p-2 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)]/30 border border-[var(--border-app)] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span>{p.name}</span>
                      </span>
                      <span className="font-mono text-[var(--text-muted)] text-[11px] tabular-nums">
                        {count} logs ({pct}%)
                      </span>
                    </div>

                    <div className="h-1 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: p.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 3: STANDUP PREVIEW & TRIGGER */}
        {activeTab === 'standup' && (
          <div className="space-y-3">
            <div className="p-3 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)]/40 border border-[var(--border-app)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-main)]">
                  Today's Activity
                </span>
                <span className="text-xs font-mono text-[var(--accent)] font-semibold">
                  {todayLogs.length} Entries
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Gemini can automatically synthesize your tasks into polished WhatsApp messages, Slack standups, or Executive Memos.
              </p>
            </div>

            <button
              onClick={onOpenAiStandup}
              className="w-full py-2 px-3 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-md shadow-[var(--accent-glow)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch AI Standup Hub</span>
            </button>
          </div>
        )}

      </div>
    </aside>
  );
};
