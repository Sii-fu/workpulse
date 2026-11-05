import React, { useState, useMemo } from 'react';
import { WorkLog, Project } from '../types';
import {
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

interface AnalyticsViewProps {
  logs: WorkLog[];
  projects: Project[];
  onNotify: (msg: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  logs,
  projects,
  onNotify,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d'>('7d');
  const [metricType, setMetricType] = useState<'hours' | 'tasks'>('hours');
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);

  // Compute stats based on selected time range
  const daysLimit = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;

  const {
    filteredLogs,
    totalMinutes,
    totalHours,
    completedCount,
    inProgressCount,
    blockedCount,
    projectStats,
    dailyTimeline,
  } = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    cutoffDate.setHours(0, 0, 0, 0);

    const fLogs = logs.filter((l) => new Date(l.date) >= cutoffDate);

    let mins = 0;
    let completed = 0;
    let inProgress = 0;
    let blocked = 0;

    const projMap: Record<string, { minutes: number; tasks: number; name: string; color: string }> = {};
    projects.forEach((p) => {
      projMap[p.id] = { minutes: 0, tasks: 0, name: p.name, color: p.color };
    });

    // Daily breakdown for the bar chart
    const dailyMap: Record<string, { date: string; label: string; minutes: number; tasks: number }> = {};
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      dailyMap[dateStr] = { date: dateStr, label, minutes: 0, tasks: 0 };
    }

    fLogs.forEach((l) => {
      const taskMins = l.durationMinutes || 30;
      mins += taskMins;

      if (l.status === 'completed') completed++;
      if (l.status === 'in_progress') inProgress++;
      if (l.status === 'blocked') blocked++;

      if (!projMap[l.projectId]) {
        projMap[l.projectId] = {
          minutes: 0,
          tasks: 0,
          name: l.projectName,
          color: '#6366f1',
        };
      }
      projMap[l.projectId].minutes += taskMins;
      projMap[l.projectId].tasks += 1;

      if (dailyMap[l.date]) {
        dailyMap[l.date].minutes += taskMins;
        dailyMap[l.date].tasks += 1;
      }
    });

    const projectStatsArr = Object.values(projMap).filter((p) => p.tasks > 0);
    const dailyTimelineArr = Object.values(dailyMap);

    return {
      filteredLogs: fLogs,
      totalMinutes: mins,
      totalHours: (mins / 60).toFixed(1),
      completedCount: completed,
      inProgressCount: inProgress,
      blockedCount: blocked,
      projectStats: projectStatsArr,
      dailyTimeline: dailyTimelineArr,
    };
  }, [logs, projects, daysLimit]);

  // Max value for scaling bar chart
  const maxDailyValue = useMemo(() => {
    const values = dailyTimeline.map((d) => (metricType === 'hours' ? d.minutes / 60 : d.tasks));
    return Math.max(...values, 4);
  }, [dailyTimeline, metricType]);

  // 1-Click Markdown Export generator
  const handleExportMarkdown = () => {
    let md = `# WorkPulse Timesheet & Activity Summary\n`;
    md += `*Period: Past ${daysLimit} days (Generated: ${new Date().toLocaleDateString()})*\n\n`;
    md += `## High-Level Metrics\n`;
    md += `- **Total Time Logged:** ${totalHours} hours\n`;
    md += `- **Tasks Completed:** ${completedCount}\n`;
    md += `- **Tasks In Progress:** ${inProgressCount}\n`;
    md += `- **Tasks Blocked:** ${blockedCount}\n\n`;

    md += `## Project Breakdown\n`;
    md += `| Project | Tasks | Hours | Share |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    projectStats.forEach((p) => {
      const hrs = (p.minutes / 60).toFixed(1);
      const pct = totalMinutes > 0 ? Math.round((p.minutes / totalMinutes) * 100) : 0;
      md += `| ${p.name} | ${p.tasks} | ${hrs}h | ${pct}% |\n`;
    });
    md += `\n`;

    md += `## Detailed Work Log\n`;
    filteredLogs.forEach((l) => {
      const statusIcon = l.status === 'completed' ? '✅' : l.status === 'in_progress' ? '⏳' : '🛑';
      const duration = l.durationMinutes ? ` (${l.durationMinutes}m)` : '';
      md += `- ${statusIcon} **[${l.projectName}]** ${l.description}${duration} — *${l.date}*\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    onNotify('Markdown summary copied to clipboard!');
    setTimeout(() => setCopiedMarkdown(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Controls: Time Range Selector & Export Buttons */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] p-3.5 shadow-xs">
        
        {/* Time range toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">Time Horizon:</span>
          {(['7d', '14d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeRange === r
                  ? 'bg-[var(--accent)] text-white font-semibold shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {r === '7d' ? 'Last 7 Days' : r === '14d' ? 'Last 14 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMarkdown}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--border-app)] text-[var(--text-main)] transition-colors flex items-center gap-1.5 shadow-xs"
            title="Generate and copy clean Markdown timesheet"
          >
            {copiedMarkdown ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Markdown</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--border-app)] text-[var(--text-main)] transition-colors flex items-center gap-1.5 shadow-xs"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>

      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)] font-medium">Total Hours</span>
          <p className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1 tabular-nums">
            {totalHours}h
          </p>
          <span className="text-[11px] text-[var(--text-muted)]">{totalMinutes} mins tracked</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)] font-medium">Completed</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {completedCount}
          </p>
          <span className="text-[11px] text-[var(--text-muted)]">Tasks finished</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)] font-medium">In Progress</span>
          <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {inProgressCount}
          </p>
          <span className="text-[11px] text-[var(--text-muted)]">Active in flight</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs">
          <span className="text-xs text-[var(--text-muted)] font-medium">Blocked</span>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {blockedCount}
          </p>
          <span className="text-[11px] text-[var(--text-muted)]">Awaiting unblock</span>
        </div>
      </div>

      {/* Main Charts Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Daily Velocity Bar Chart */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">Daily Output Velocity</h3>
              <p className="text-xs text-[var(--text-muted)]">Tracking output over {daysLimit} days</p>
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded bg-[var(--bg-subtle)] text-xs">
              <button
                onClick={() => setMetricType('hours')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  metricType === 'hours'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-xs'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                Hours
              </button>
              <button
                onClick={() => setMetricType('tasks')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  metricType === 'tasks'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-xs'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                Tasks
              </button>
            </div>
          </div>

          {/* Responsive SVG Bar Chart */}
          <div className="h-56 w-full flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-[var(--border-app)]">
            {dailyTimeline.map((item) => {
              const val = metricType === 'hours' ? item.minutes / 60 : item.tasks;
              const heightPercent = maxDailyValue > 0 ? (val / maxDailyValue) * 100 : 0;

              return (
                <div key={item.date} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-2 py-1 rounded bg-neutral-900 text-white text-[10px] font-mono pointer-events-none whitespace-nowrap z-20 shadow-sm">
                    {item.label}: {metricType === 'hours' ? `${val.toFixed(1)}h` : `${val} tasks`}
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    className={`w-full rounded-t transition-all ${
                      val > 0
                        ? 'bg-[var(--accent)] hover:opacity-85'
                        : 'bg-[var(--bg-subtle)]'
                    }`}
                  />
                  
                  {/* Date subtext */}
                  <span className="text-[10px] text-[var(--text-muted)] mt-1.5 font-mono truncate max-w-full">
                    {item.label.split(',')[0]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
            <span>Peak Day: {maxDailyValue.toFixed(1)} {metricType}</span>
            <span>Average: {(totalMinutes / (daysLimit * 60)).toFixed(1)} hrs/day</span>
          </div>
        </div>

        {/* Chart 2: Project Distribution Donut & Legend */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] p-4 sm:p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">Project Time Allocation</h3>
            <p className="text-xs text-[var(--text-muted)]">Time spent across active initiatives</p>
          </div>

          {projectStats.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-muted)]">
              No project logs recorded in this timeframe.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-auto sm:h-56">
              
              {/* SVG Donut */}
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {(() => {
                    let cumulativeAngle = 0;
                    return projectStats.map((p, idx) => {
                      const share = totalMinutes > 0 ? p.minutes / totalMinutes : 0;
                      const strokeDasharray = `${share * 283} 283`;
                      const strokeDashoffset = -cumulativeAngle * 283;
                      cumulativeAngle += share;

                      return (
                        <circle
                          key={p.name}
                          cx="50"
                          cy="50"
                          r="45"
                          fill="transparent"
                          stroke={p.color || '#6366f1'}
                          strokeWidth="10"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all hover:stroke-width-12"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold font-mono text-[var(--text-main)]">
                    {totalHours}h
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase">Tracked</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-2 flex-1 w-full text-xs">
                {projectStats.map((p) => {
                  const hrs = (p.minutes / 60).toFixed(1);
                  const pct = totalMinutes > 0 ? Math.round((p.minutes / totalMinutes) * 100) : 0;

                  return (
                    <div key={p.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="truncate text-[var(--text-main)] font-medium">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                        <span>{hrs}h</span>
                        <span className="w-8 text-right font-semibold text-[var(--text-main)]">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Status Ratio Bar */}
          <div className="border-t border-[var(--border-app)] pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Task Status Ratio:</span>
              <span className="font-mono tabular-nums">
                {completedCount} done · {inProgressCount} active · {blockedCount} blocked
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden flex">
              <div
                style={{ width: `${filteredLogs.length > 0 ? (completedCount / filteredLogs.length) * 100 : 0}%` }}
                className="bg-emerald-500 h-full"
                title={`Completed: ${completedCount}`}
              />
              <div
                style={{ width: `${filteredLogs.length > 0 ? (inProgressCount / filteredLogs.length) * 100 : 0}%` }}
                className="bg-blue-500 h-full"
                title={`In Progress: ${inProgressCount}`}
              />
              <div
                style={{ width: `${filteredLogs.length > 0 ? (blockedCount / filteredLogs.length) * 100 : 0}%` }}
                className="bg-rose-500 h-full"
                title={`Blocked: ${blockedCount}`}
              />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
