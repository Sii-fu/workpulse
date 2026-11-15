// Writes the Sheet script to a file, for pasting into Extensions > Apps Script: npx tsx scripts/export-script.ts <file>
import fs from 'node:fs';
import { GOOGLE_APPS_SCRIPT_CODE } from '../src/utils/googleAppsScriptTemplate';

fs.writeFileSync(process.argv[2], GOOGLE_APPS_SCRIPT_CODE);
console.log(`Wrote ${GOOGLE_APPS_SCRIPT_CODE.length} characters to ${process.argv[2]}`);
