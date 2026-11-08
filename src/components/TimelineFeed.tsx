import React, { useState, useMemo } from 'react';
import { localDateStr, rangeStart, DateRange } from '../utils/dates';
import { WorkLog, Project, TaskStatus, ThemeId } from '../types';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Copy,
  Pencil,
  Trash2,
  CopyCheck,
  CheckSquare,
  Square,
  Sparkles,
  Flame,
  Terminal,
  ChevronDown,
  ChevronUp,
  Layers,
  Send,
} from 'lucide-react';

interface TimelineFeedProps {
  logs: WorkLog[];
  projects: Project[];
  activeTheme: ThemeId;
  onEditLog: (log: WorkLog) => void;
  onDeleteLog: (id: string) => void;
  onDuplicateLog: (log: WorkLog) => void;
  onOpenImage: (base64: string) => void;
  selectedLogIds: string[];
  onToggleSelectLog: (id: string) => void;
  onSelectAllVisible: (ids: string[]) => void;
  onClearSelection: () => void;
  onOpenAiStandupWithSelected: () => void;
  onCopyText: (text: string) => void;
  onOpenEodSynthesizer?: () => void;
}

export const TimelineFeed: React.FC<TimelineFeedProps> = ({
  logs,
  projects,
  activeTheme,
  onEditLog,
  onDeleteLog,
  onDuplicateLog,
  onOpenImage,
  selectedLogIds,
  onToggleSelectLog,
  onSelectAllVisible,
  onClearSelection,
  onOpenAiStandupWithSelected,
  onCopyText,
  onOpenEodSynthesizer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [expandedMicroTaskLogs, setExpandedMicroTaskLogs] = useState<Set<string>>(new Set());

  const toggleMicroTasks = (logId: string) => {
    setExpandedMicroTaskLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const todayStr = localDateStr();
    const fromDate = rangeStart(selectedDateRange as DateRange, todayStr);

    return logs.filter((log) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDesc = log.description.toLowerCase().includes(query);
        const matchesProj = log.projectName.toLowerCase().includes(query);
        const matchesTag = log.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesDesc && !matchesProj && !matchesTag) return false;
      }

      if (selectedProject !== 'all' && log.projectId !== selectedProject) {
        return false;
      }

      if (selectedStatus !== 'all' && log.status !== selectedStatus) {
        return false;
      }

      if (selectedTag !== 'all' && !log.tags.includes(selectedTag)) {
        return false;
      }

      if (selectedDateRange === 'today') return log.date === todayStr;
      return fromDate === null || log.date >= fromDate;
    });
  }, [logs, searchQuery, selectedProject, selectedStatus, selectedTag, selectedDateRange]);

  const allVisibleIds = filteredLogs.map((l) => l.id);
  const areAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedLogIds.includes(id));

  const renderStatus = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-info">
            <Clock className="w-3.5 h-3.5" />
            <span>In Progress</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Blocked</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Filter and Search Bar */}
      <div className="no-print glass-panel p-3.5 space-y-3 transition-all">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search logs"
              placeholder="Search logs by keywords, projects, tags..."
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:border-[var(--border-focus)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-app)] text-xs shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            {(['today', 'week', 'month', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedDateRange(r)}
                className={`px-2.5 py-1 rounded-[var(--radius-btn)] capitalize transition-all cursor-pointer ${
                  selectedDateRange === r
                    ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-semibold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : `This ${r}`}
              </button>
            ))}
          </div>

        </div>

        {/* Second Row: Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-app)] text-xs">
          <div className="flex items-center gap-1 text-[var(--text-muted)]">
            <Filter className="w-3 h-3" />
            <span className="font-semibold text-[11px] uppercase tracking-wider">Filters:</span>
          </div>

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-[var(--bg-subtle)] border border-[var(--border-control)] text-[var(--text-main)] rounded-[var(--radius-btn)] px-2.5 py-1 text-xs cursor-pointer"
          >
            <option value="all" className="bg-[var(--bg-surface)]">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[var(--bg-subtle)] border border-[var(--border-control)] text-[var(--text-main)] rounded-[var(--radius-btn)] px-2.5 py-1 text-xs cursor-pointer"
          >
            <option value="all" className="bg-[var(--bg-surface)]">All Statuses</option>
            <option value="completed" className="bg-[var(--bg-surface)]">Completed</option>
            <option value="in_progress" className="bg-[var(--bg-surface)]">In Progress</option>
            <option value="blocked" className="bg-[var(--bg-surface)]">Blocked</option>
          </select>

          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border-control)] text-[var(--text-main)] rounded-[var(--radius-btn)] px-2.5 py-1 text-xs cursor-pointer"
            >
              <option value="all" className="bg-[var(--bg-surface)]">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag} className="bg-[var(--bg-surface)]">
                  {tag}
                </option>
              ))}
            </select>
          )}

          {(selectedProject !== 'all' ||
            selectedStatus !== 'all' ||
            selectedTag !== 'all' ||
            selectedDateRange !== 'all' ||
            searchQuery) && (
            <button
              onClick={() => {
                setSelectedProject('all');
                setSelectedStatus('all');
                setSelectedTag('all');
                setSelectedDateRange('all');
                setSearchQuery('');
              }}
              className="text-[var(--accent-text)] hover:underline ml-auto font-medium cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (areAllSelected) {
                onClearSelection();
              } else {
                onSelectAllVisible(allVisibleIds);
              }
            }}
            className="flex items-center gap-1.5 hover:text-[var(--text-main)] transition-colors font-medium cursor-pointer"
          >
            {areAllSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>
              {areAllSelected ? 'Deselect All' : `Select All (${filteredLogs.length})`}
            </span>
          </button>

          {selectedLogIds.length > 0 && (
            <span className="font-semibold text-[var(--text-main)]">
              {selectedLogIds.length} selected for AI report
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedLogIds.length > 0 && (
            <>
              <button
                onClick={onOpenAiStandupWithSelected}
                className="px-3 py-1 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-[var(--accent-glow)] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Standup ({selectedLogIds.length})</span>
              </button>

              <button
                onClick={onClearSelection}
                className="px-2 py-1 rounded-[var(--radius-btn)] border border-[var(--border-control)] hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-pointer"
              >
                Clear
              </button>
            </>
          )}

          {onOpenEodSynthesizer && (
            <button
              onClick={onOpenEodSynthesizer}
              className="px-3.5 py-1.5 rounded-[var(--radius-btn)] bg-warning-solid hover:bg-warning-solid-hover text-white font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Batch-synthesize daily micro-tasks into executive project timesheet logs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Synthesize EOD Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Card view (the only layout that renders TimelineFeed is the modern theme) */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 glass-panel p-6">
          <p className="text-sm font-semibold text-[var(--text-main)] mb-1">No logs match your filter criteria</p>
          <p className="text-xs text-[var(--text-muted)]">Try adjusting your date range or clear the search query.</p>
        </div>
      ) : (
        
        /* ---------------- STANDARD CARD VIEW (Modern SaaS & Minimalist) ---------------- */
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isSelected = selectedLogIds.includes(log.id);
            const project = projects.find((p) => p.id === log.projectId);

            return (
              <div
                key={log.id}
                className={`glass-panel p-4 sm:p-5 transition-all relative ${
                  isSelected
                    ? 'border-[var(--accent)] ring-1 ring-[var(--accent-glow)]'
                    : 'hover:border-[var(--border-focus)]/50'
                }`}
              >
                {/* Top Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--border-app)] text-xs">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleSelectLog(log.id)}
                      className="no-print text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors shrink-0 cursor-pointer"
                      title={isSelected ? 'Deselect log' : 'Select log for AI report'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[var(--accent-text)]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)] tracking-tight">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: project?.color || '#6366f1' }}
                      />
                      <span>{log.projectName}</span>
                    </div>

                    <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>

                    <span className="text-[var(--text-muted)] font-mono tabular-nums text-[11px]">
                      {log.date} at {log.time}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {renderStatus(log.status)}

                    {log.durationMinutes && (
                      <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{log.durationMinutes}m</span>
                      </span>
                    )}

                    {log.energyRating && log.energyRating > 0 && (
                      <span
                        className="text-[11px] font-mono text-warning flex items-center gap-0.5"
                        title={`Focus rating: ${log.energyRating} / 5`}
                      >
                        <Flame className="w-3 h-3 fill-current" />
                        <span>{log.energyRating}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Description Body */}
                <div className="py-3 space-y-2">
                  {log.isSynthesized && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning font-mono text-[10px] font-bold">
                      <Sparkles className="w-3 h-3 text-warning" />
                      <span>Synthesized EOD Log</span>
                    </div>
                  )}
                  <p className="text-xs sm:text-sm text-[var(--text-main)] whitespace-pre-line leading-relaxed">
                    {log.description}
                  </p>

                  {/* Expandable Underlying Micro-Tasks Drawer */}
                  {log.underlyingTasks && log.underlyingTasks.length > 0 && (
                    <div className="pt-1.5 border-t border-[var(--border-app)]/40">
                      <button
                        type="button"
                        onClick={() => toggleMicroTasks(log.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:underline font-semibold cursor-pointer"
                      >
                        {expandedMicroTaskLogs.has(log.id) ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {expandedMicroTaskLogs.has(log.id) ? 'Hide' : 'View'} Underlying Micro-Tasks ({log.underlyingTasks.length})
                        </span>
                      </button>

                      {expandedMicroTaskLogs.has(log.id) && (
                        <div className="mt-2 p-2.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)]/80 border border-[var(--border-app)] space-y-1.5 animate-in fade-in duration-150">
                          {log.underlyingTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between gap-2 text-xs text-[var(--text-main)] py-0.5 border-b border-[var(--border-app)]/40 last:border-0"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                    task.stage === 'done'
                                      ? 'bg-success/20 text-success'
                                      : task.stage === 'in_progress'
                                      ? 'bg-warning/20 text-warning'
                                      : task.stage === 'blocked'
                                      ? 'bg-danger/20 text-danger'
                                      : 'bg-info/20 text-info'
                                  }`}
                                >
                                  {task.stage}
                                </span>
                                <span className="truncate">{task.title}</span>
                              </div>
                              <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                                {task.elapsedSeconds ? `${Math.floor(task.elapsedSeconds / 60)}m` : '0m'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[var(--border-app)] text-xs">
                  
                  {/* Left: Tags & Links */}
                  <div className="flex flex-wrap items-center gap-2">
                    {log.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-[var(--radius-btn)] border border-[var(--border-app)]"
                      >
                        {tag}
                      </span>
                    ))}

                    {log.linkUrl && (
                      <a
                        href={log.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">
                          {log.linkUrl.replace(/^https?:\/\//, '')}
                        </span>
                      </a>
                    )}

                    {log.imageBase64 && (
                      <button
                        type="button"
                        onClick={() => onOpenImage(log.imageBase64!)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Screenshot</span>
                      </button>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="no-print flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onCopyText(`[${log.projectName}] ${log.description}`)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] transition-colors cursor-pointer"
                      title="Copy log to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDuplicateLog(log)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] transition-colors cursor-pointer"
                      title="Duplicate log"
                    >
                      <CopyCheck className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onEditLog(log)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-btn)] transition-colors cursor-pointer"
                      title="Edit log"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-danger hover:bg-danger/10 rounded-[var(--radius-btn)] transition-colors cursor-pointer"
                      title="Delete log"
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
  );
};
