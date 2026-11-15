// Prepares electron/app: the built page (dist/) and the server bundled into one file.
import { build } from 'esbuild';
import fs from 'node:fs';

fs.rmSync('electron/app', { recursive: true, force: true });
fs.mkdirSync('electron/app', { recursive: true });
fs.cpSync('dist', 'electron/app/dist', { recursive: true });

await build({
  entryPoints: ['server.ts'],
  outfile: 'electron/app/server.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vite'],
  banner: { js: "const __importMetaUrl = require('url').pathToFileURL(__filename).href;" },
  define: { 'import.meta.url': '__importMetaUrl' },
  logLevel: 'info',
});
