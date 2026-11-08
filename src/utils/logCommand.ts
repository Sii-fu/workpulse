import { TaskStatus } from '../types';

export interface ParsedLogCommand {
  description: string;
  project?: string;
  status: TaskStatus;
  minutes?: number;
}

// Parses the Matrix terminal's `log` command (B15):
//   log -m "fixed the bug" -p "Core Platform" -s blocked -t 45
//   log -m fixed the bug -s in_progress      (unquoted messages run until the next flag)
//   log fixed the bug                        (no -m: everything that is not a flag is the message)
//   anything else                            (the whole text is the message)
// A flag-looking word inside quotes (-m "no -s blocked here") is part of the message, not a flag.
export function parseLogCommand(input: string): ParsedLogCommand {
  const text = input.trim();
  const tokens: { text: string; quoted: boolean }[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) tokens.push({ text: m[1], quoted: true });
    else if (m[2] !== undefined) tokens.push({ text: m[2], quoted: true });
    else tokens.push({ text: m[3], quoted: false });
  }

  if (!tokens.length || tokens[0].quoted || tokens[0].text.toLowerCase() !== 'log') {
    return { description: text, status: 'completed' };
  }

  const words: Record<string, string[]> = { '': [], m: [], p: [], s: [], t: [] };
  let flag = '';
  for (const tok of tokens.slice(1)) {
    const f = !tok.quoted && /^-[mpst]$/i.exec(tok.text);
    if (f) flag = tok.text[1].toLowerCase();
    else words[flag].push(tok.text);
  }

  const statusWord = words.s.join(' ').trim().toLowerCase();
  const status: TaskStatus =
    statusWord === 'blocked' ? 'blocked' : statusWord === 'in_progress' ? 'in_progress' : 'completed';
  const minutes = parseInt(words.t.join(' '), 10);
  const project = words.p.join(' ').trim();

  return {
    description: (words.m.length ? words.m : words[''].length ? words[''] : []).join(' ').trim(),
    project: project || undefined,
    status,
    minutes: minutes > 0 ? minutes : undefined,
  };
}
