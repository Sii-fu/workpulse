import React, { useState, useEffect, useRef } from 'react';
import { WorkLog, Project, TaskStatus, BacklogTask } from '../../types';
import { Terminal, Send, Trash2, Copy, Check } from 'lucide-react';

interface MatrixTuiLayoutProps {
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  hasGoogleSheetLinked: boolean;
  onAddLog: (log: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onDeleteLog: (id: string) => void;
  onDuplicateLog: (log: WorkLog) => void;
  onCopyText: (text: string) => void;
  onToggleTask: (taskId: string) => void;
  onConvertTaskToLog?: (task: BacklogTask) => void;
  onOpenAiStandup: () => void;
}

export const MatrixTuiLayout: React.FC<MatrixTuiLayoutProps> = ({
  logs,
  backlog,
  projects,
  hasGoogleSheetLinked,
  onAddLog,
  onDeleteLog,
  onDuplicateLog,
  onCopyText,
  onToggleTask,
  onConvertTaskToLog,
  onOpenAiStandup,
}) => {
  const [cliInput, setCliInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([
    'WORKPULSE UNIX SUBSYSTEM v3.8.0-RELEASE',
    'Type "help" for syntax or enter work log directly below.',
  ]);
  const [systemTime, setSystemTime] = useState(new Date().toTimeString().slice(0, 8));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date().toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    const lower = cmd.toLowerCase();

    if (lower === 'help') {
      setCommandHistory((prev) => [
        ...prev,
        `$ ${cmd}`,
        'COMMANDS:',
        '  log -m "description" [-p "Project"] [-s completed|in_progress|blocked] [-t mins]',
        '  tasks                     (list pending tasks with index numbers)',
        '  done <number>             (log task & commit to sheet, e.g. "done 1")',
        '  standup                   (trigger AI standup generator)',
        '  clear                     (clear terminal history)',
        '  or simply type text to log to default project',
      ]);
      setCliInput('');
      return;
    }

    if (lower === 'clear') {
      setCommandHistory(['WORKPULSE UNIX SUBSYSTEM v3.8.0-RELEASE']);
      setCliInput('');
      return;
    }

    if (lower === 'standup') {
      onOpenAiStandup();
      setCommandHistory((prev) => [...prev, `$ ${cmd}`, '>> Opening AI Standup Hub...']);
      setCliInput('');
      return;
    }

    if (lower === 'tasks') {
      const pending = backlog.filter((t) => !t.completed && t.stage !== 'done');
      const lines = pending.length
        ? pending.map(
            (t, idx) =>
              `  [${idx + 1}] [${(t.stage || 'planned').toUpperCase()}] ${t.title}`
          )
        : ['  No pending tasks in queue'];
      setCommandHistory((prev) => [
        ...prev,
        `$ ${cmd}`,
        'ACTIVE & PLANNED TASKS:',
        ...lines,
        '  (Type "done <number>" to log task immediately)',
      ]);
      setCliInput('');
      return;
    }

    if (lower.startsWith('done ') || lower.startsWith('logtask ')) {
      const parts = cmd.split(' ');
      const idx = parseInt(parts[1]) - 1;
      const pending = backlog.filter((t) => !t.completed && t.stage !== 'done');
      if (pending[idx]) {
        if (onConvertTaskToLog) {
          onConvertTaskToLog(pending[idx]);
        } else {
          onToggleTask(pending[idx].id);
        }
        setCommandHistory((prev) => [
          ...prev,
          `$ ${cmd}`,
          `>> Converted Task [${idx + 1}: ${pending[idx].title}] to Work Log & committed!`,
        ]);
        setCliInput('');
        return;
      } else {
        setCommandHistory((prev) => [
          ...prev,
          `$ ${cmd}`,
          `>> Invalid task index. Type "tasks" to see pending task numbers.`,
        ]);
        setCliInput('');
        return;
      }
    }

    // Parse log command: log -m "..." or plain string
    let desc = cmd;
    let projName = projects[0]?.name || 'Core Platform';
    let status: TaskStatus = 'completed';
    let mins = 30;

    if (cmd.startsWith('log ')) {
      const msgMatch = cmd.match(/-m\s+"([^"]+)"/) || cmd.match(/-m\s+([^\s]+)/);
      if (msgMatch) desc = msgMatch[1];

      const projMatch = cmd.match(/-p\s+"([^"]+)"/) || cmd.match(/-p\s+([^\s]+)/);
      if (projMatch) projName = projMatch[1];

      if (cmd.includes('-s blocked')) status = 'blocked';
      if (cmd.includes('-s in_progress')) status = 'in_progress';

      const timeMatch = cmd.match(/-t\s+(\d+)/);
      if (timeMatch) mins = parseInt(timeMatch[1]);
    }

    const matchedProject =
      projects.find((p) => p.name.toLowerCase().includes(projName.toLowerCase())) || projects[0];

    onAddLog({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      projectId: matchedProject?.id || 'default',
      projectName: matchedProject?.name || 'General',
      description: desc,
      status,
      tags: ['#terminal'],
      durationMinutes: mins,
      energyRating: 5,
    });

    setCommandHistory((prev) => [
      ...prev,
      `$ ${cmd}`,
      `>> SUCCESS: Log written to [${matchedProject?.name}]. Status: ${status.toUpperCase()}.`,
    ]);

    setCliInput('');
  };

  return (
    <div className="space-y-4 font-mono text-xs text-[#00ff66]">
      
      {/* 1. Terminal Window Console */}
      <div className="p-4 border border-[#183e1e] bg-[#060e07] shadow-[0_0_15px_rgba(0,255,102,0.06)] space-y-3">
        <div className="flex items-center justify-between border-b border-[#183e1e] pb-2 text-[11px] text-[#3a8a4c]">
          <span className="matrix-glow font-bold text-[#00ff66]">
            +---[ WORKPULSE CLI TERMINAL v3.8 ]---+
          </span>
          <span>TTY: /dev/pts/1</span>
        </div>

        {/* Scrollable Command Line History */}
        <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] leading-relaxed">
          {commandHistory.map((line, idx) => (
            <div key={idx} className={line.startsWith('$') ? 'text-[#00ff66] font-bold' : 'text-[#3a8a4c]'}>
              {line}
            </div>
          ))}
        </div>

        {/* Live Command Prompt Input */}
        <form onSubmit={handleCommand} className="flex items-center gap-2 pt-2 border-t border-[#183e1e]">
          <span className="text-[#00ff66] font-bold shrink-0 matrix-glow">
            user@workpulse:~$
          </span>
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={cliInput}
              onChange={(e) => setCliInput(e.target.value)}
              placeholder='log -m "Task description..." or plain text (type help for docs)'
              className="w-full bg-transparent border-0 text-[#00ff66] placeholder-[#1e5229] focus:outline-hidden text-xs"
              autoFocus
            />
            <span className="w-2 h-4 bg-[#00ff66] animate-pulse inline-block shrink-0" />
          </div>
          <button
            type="submit"
            className="px-2 py-0.5 bg-[#00ff66] text-black font-bold text-[10px] uppercase cursor-pointer hover:bg-[#33ff88]"
          >
            EXEC
          </button>
        </form>
      </div>

      {/* 2. Structured UNIX Log Chronicle */}
      <div className="border border-[#183e1e] bg-[#060e07] p-3 space-y-2">
        <div className="flex items-center justify-between border-b border-[#183e1e] pb-1.5 text-[11px] text-[#3a8a4c]">
          <span>+---[ STORED WORK LOGS ]---+</span>
          <span>TOTAL: {logs.length} RECORDS</span>
        </div>

        <div className="divide-y divide-[#183e1e] text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className="py-2.5 space-y-1 hover:bg-[#0f2212]/30 px-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  [{log.date} {log.time}] [{log.projectName.toUpperCase()}]
                </span>
                <span className={log.status === 'completed' ? 'text-[#00ff66]' : 'text-amber-400'}>
                  [{log.status.toUpperCase()}]
                </span>
              </div>
              <p className="text-[#00ff66] opacity-90">&gt; {log.description}</p>
              <div className="flex items-center justify-between text-[10px] text-[#3a8a4c] pt-0.5">
                <span>TIME: {log.durationMinutes || 0}m · TAGS: {log.tags.join(' ')}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => onDuplicateLog(log)} className="hover:text-[#00ff66] cursor-pointer">
                    [CLONE]
                  </button>
                  <button onClick={() => onDeleteLog(log.id)} className="hover:text-rose-400 cursor-pointer">
                    [RM]
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tmux / Vim-Style Bottom Status Bar */}
      <div className="p-1.5 bg-[#0a170c] border border-[#183e1e] flex flex-wrap items-center justify-between text-[10px] font-bold tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className="bg-[#00ff66] text-black px-1.5 py-0.2">[NORMAL]</span>
          <span>100% LOCAL CACHED</span>
          <span>·</span>
          <span>{hasGoogleSheetLinked ? 'SHEETS: CONNECTED' : 'SHEETS: STANDALONE'}</span>
        </div>
        <div className="flex items-center gap-2 text-[#3a8a4c]">
          <span>UTF-8</span>
          <span>[TUI]</span>
          <span className="text-[#00ff66]">{systemTime}</span>
        </div>
      </div>

    </div>
  );
};
