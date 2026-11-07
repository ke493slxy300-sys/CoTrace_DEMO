/**
 * Launch CoTrace Electron against a running Vite/demo server.
 *
 * Prerequisites:
 *   1. Install Electron (see MERGE REQUEST — not in package.json yet), e.g.:
 *        npm install -D electron
 *   2. Start the demo server in another terminal:
 *        npm run dev
 *      Default URL: http://localhost:5173
 *
 * Usage:
 *   node scripts/electron-dev.mjs
 *   node scripts/electron-dev.mjs http://127.0.0.1:5173
 *   COTRACE_DESKTOP_URL=http://localhost:4173 node scripts/electron-dev.mjs
 *
 * Does not start Vite itself and does not embed API keys.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const mainEntry = path.join(repoRoot, 'electron', 'main.mjs');

const DEFAULT_URL = 'http://localhost:5173';
const urlArg = process.argv[2];
const appUrl = (urlArg || process.env.COTRACE_DESKTOP_URL || DEFAULT_URL).replace(
  /\/$/,
  '',
);

function tryRequireElectron(fromFile) {
  try {
    const require = createRequire(fromFile);
    const electronPath = require('electron');
    if (electronPath && fs.existsSync(electronPath)) return electronPath;
  } catch {
    // not resolvable from this parent
  }
  return null;
}

function resolveElectronBinary() {
  // Prefer root install (after package.json merge); fall back to electron/.
  // createRequire walks node_modules upward from the parent file's directory.
  return (
    tryRequireElectron(path.join(repoRoot, 'scripts', 'electron-dev.mjs')) ||
    tryRequireElectron(path.join(repoRoot, 'electron', 'main.mjs')) ||
    null
  );
}

function printInstallHelp() {
  console.error(`
[cotrace-desktop] Electron is not installed.

Install options:
  A) Root (after package.json merge — see electron/MERGE_REQUEST_FOR_MAIN_WINDOW.md):
       npm install -D electron
  B) Nested (no root package.json change):
       npm install --prefix electron
     If the Electron binary download times out, set:
       ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

Then:
  Terminal A:  npm run dev
  Terminal B:  node scripts/electron-dev.mjs

Optional URL override:
  node scripts/electron-dev.mjs http://localhost:5173
`);
}

if (!fs.existsSync(mainEntry)) {
  console.error(`[cotrace-desktop] missing main entry: ${mainEntry}`);
  process.exit(1);
}

const electronBin = resolveElectronBinary();
if (!electronBin) {
  printInstallHelp();
  process.exit(1);
}

console.log(`[cotrace-desktop] Electron: ${electronBin}`);
console.log(`[cotrace-desktop] Main:     ${mainEntry}`);
console.log(`[cotrace-desktop] URL:      ${appUrl}`);
console.log(
  '[cotrace-desktop] Logical canvas: 1440x960 (fit to screen.workArea, keep 3:2, setZoomFactor)',
);
console.log(
  '[cotrace-desktop] Ensure Vite/demo is running first (npm run dev -> :5173).',
);

const child = spawn(electronBin, [mainEntry], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    COTRACE_DESKTOP_URL: appUrl,
  },
  windowsHide: false,
});

child.on('error', (err) => {
  console.error('[cotrace-desktop] failed to spawn Electron:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[cotrace-desktop] Electron killed by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
