import type { Project, WorkLog } from '../types';
import { toCsv } from './csv';

// Exports of a set of logs. The CSV is the Settings "Download CSV Logs" file; the Markdown is the
// Analytics "Export Markdown" summary, with the work log grouped by date, then project.

export function logsToCsv(logs: WorkLog[]): string {
  return toCsv([
    ['ID', 'Date', 'Time', 'Project', 'Description', 'Status', 'Tags', 'Link', 'Duration_Mins', 'Energy_Rating'],
    ...logs.map((l) => [
      l.id,
      l.date,
      l.time,
      l.projectName,
      l.description,
      l.status,
      l.tags.join(' '),
      l.linkUrl || '',
      l.durationMinutes || 0,
      l.energyRating || 0,
    ]),
  ]);
}

export function logsToMarkdown(logs: WorkLog[], projects: Project[]): string {
  let totalMinutes = 0;
  let completed = 0;
  let inProgress = 0;
  let blocked = 0;

  const projMap: Record<string, { minutes: number; tasks: number; name: string }> = {};
  projects.forEach((p) => {
    projMap[p.id] = { minutes: 0, tasks: 0, name: p.name };
  });

  logs.forEach((l) => {
    const mins = l.durationMinutes || 0;
    totalMinutes += mins;
    if (l.status === 'completed') completed++;
    if (l.status === 'in_progress') inProgress++;
    if (l.status === 'blocked') blocked++;
    if (!projMap[l.projectId]) projMap[l.projectId] = { minutes: 0, tasks: 0, name: l.projectName };
    projMap[l.projectId].minutes += mins;
    projMap[l.projectId].tasks += 1;
  });

  const dates = [...new Set(logs.map((l) => l.date))].sort();
  const period =
    dates.length === 0 ? 'no logs' : dates.length === 1 ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;

  let md = `# WorkPulse Timesheet & Activity Summary\n`;
  md += `*Period: ${period} (Generated: ${new Date().toLocaleDateString()})*\n\n`;
  md += `## High-Level Metrics\n`;
  md += `- **Total Time Logged:** ${(totalMinutes / 60).toFixed(1)} hours\n`;
  md += `- **Tasks Completed:** ${completed}\n`;
  md += `- **Tasks In Progress:** ${inProgress}\n`;
  md += `- **Tasks Blocked:** ${blocked}\n\n`;

  md += `## Project Breakdown\n`;
  md += `| Project | Tasks | Hours | Share |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  Object.values(projMap)
    .filter((p) => p.tasks > 0)
    .forEach((p) => {
      const hrs = (p.minutes / 60).toFixed(1);
      const pct = totalMinutes > 0 ? Math.round((p.minutes / totalMinutes) * 100) : 0;
      md += `| ${p.name} | ${p.tasks} | ${hrs}h | ${pct}% |\n`;
    });
  md += `\n`;

  md += `## Detailed Work Log\n`;
  md += dates
    .map((date) => {
      const day = logs
        .filter((l) => l.date === date)
        .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.time.localeCompare(b.time));
      const lines = day.map((l) => {
        const statusIcon = l.status === 'completed' ? '✅' : l.status === 'in_progress' ? '⏳' : '🛑';
        const duration = l.durationMinutes ? ` (${l.durationMinutes}m)` : '';
        return `- ${statusIcon} **[${l.projectName}]** ${l.description}${duration} — *${l.date}*\n`;
      });
      return `### ${date}\n${lines.join('')}`;
    })
    .join('\n');
  return md;
}
