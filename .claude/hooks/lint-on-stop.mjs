// Stop hook: run `npm run lint` (tsc --noEmit) when Claude finishes a turn.
// On type errors, block the stop and hand the errors back to Claude to fix.
// Cross-platform (run via `node`, so it works on Windows without bash).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_REASON_CHARS = 8000;

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  // Malformed input: fail open rather than trapping Claude.
}

// Loop guard: if Claude is already continuing because of a stop hook,
// let it stop this time instead of blocking forever.
if (input.stop_hook_active) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

// Dependencies not installed yet: nothing Claude can fix by editing code.
if (!existsSync(path.join(projectDir, 'node_modules', 'typescript'))) process.exit(0);

const result = spawnSync('npm run lint', {
  cwd: projectDir,
  shell: true, // npm is a .cmd shim on Windows, which needs a shell
  encoding: 'utf8',
  timeout: 110_000,
});

if (result.status === 0) process.exit(0);

const output = `${result.stdout || ''}${result.stderr || ''}`.trim() || String(result.error || 'unknown error');
const trimmed = output.length > MAX_REASON_CHARS ? `${output.slice(0, MAX_REASON_CHARS)}\n…(truncated)` : output;

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `\`npm run lint\` (tsc --noEmit) failed. Fix these type errors before finishing:\n\n${trimmed}`,
  })
);
process.exit(0);
