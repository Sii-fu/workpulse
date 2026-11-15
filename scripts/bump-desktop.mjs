// Raises the patch number of the desktop app, so the installed app sees the new build as an update.
import fs from 'node:fs';

const file = 'electron/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const [a, b, c] = pkg.version.split('.').map(Number);
pkg.version = `${a}.${b}.${c + 1}`;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Desktop version ${pkg.version}`);
