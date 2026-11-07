/**
 * One-click CoTrace desktop launcher.
 *
 * 1. Ensures Node can resolve npm + Electron
 * 2. Starts Vite (`npm run dev`) if nothing is listening on the demo port
 * 3. Waits until the URL responds, then launches Electron via electron-dev.mjs
 *
 * Does not embed API keys. DeepSeek stays server-side via Vite/API plugins.
 *
 * Usage:
 *   node scripts/start-cotrace-desktop.mjs
 *   (or double-click scripts/start-cotrace-desktop.cmd / Desktop "CoTrace Demo")
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DEV_URL } from '../electron/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const electronDevScript = path.join(repoRoot, 'scripts', 'electron-dev.mjs');

const appUrl = (process.env.COTRACE_DESKTOP_URL || DEFAULT_DEV_URL).replace(
  /\/$/,
  '',
);

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function log(msg) {
  console.log(`[cotrace-launcher] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[cotrace-launcher] ${msg}`);
  process.exit(code);
}

function tryRequireElectron(fromFile) {
  try {
    const require = createRequire(fromFile);
    const electronPath = require('electron');
    if (electronPath && fs.existsSync(electronPath)) return electronPath;
  } catch {
    // not resolvable
  }
  return null;
}

function resolveElectronBinary() {
  return (
    tryRequireElectron(path.join(repoRoot, 'scripts', 'start-cotrace-desktop.mjs')) ||
    tryRequireElectron(path.join(repoRoot, 'electron', 'main.mjs')) ||
    null
  );
}

function resolveNpmCommand() {
  const isWin = process.platform === 'win32';
  const candidates = isWin ? ['npm.cmd', 'npm.exe', 'npm'] : ['npm'];
  for (const name of candidates) {
    // Prefer PATH lookup via `where`/`which` is heavy; spawn with shell instead.
    // Just return the conventional name — spawn uses shell:true on Windows.
    if (name) return isWin ? 'npm.cmd' : 'npm';
  }
  return isWin ? 'npm.cmd' : 'npm';
}

function portOpen(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

function httpReady(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForServer(url, { host, port }, maxMs = 90_000) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxMs) {
    attempt += 1;
    const open = await portOpen(host, port);
    if (open) {
      const ready = await httpReady(url);
      if (ready) return true;
    }
    if (attempt === 1 || attempt % 10 === 0) {
      log(`waiting for ${url} … (${Math.round((Date.now() - start) / 1000)}s)`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startViteDev() {
  const npmCmd = resolveNpmCommand();
  log(`starting Vite/dev server via \`${npmCmd} run dev\` …`);
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: repoRoot,
    stdio: 'ignore',
    env: { ...process.env },
    shell: process.platform === 'win32',
    detached: true,
    windowsHide: true,
  });
  child.unref();
  child.on('error', (err) => {
    console.error('[cotrace-launcher] failed to start npm run dev:', err.message);
  });
  return child;
}

function runElectron() {
  return new Promise((resolve, reject) => {
    log(`launching Electron → ${appUrl}`);
    const child = spawn(process.execPath, [electronDevScript, appUrl], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        COTRACE_DESKTOP_URL: appUrl,
      },
      windowsHide: false,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Electron killed by signal ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

async function main() {
  log(`repo: ${repoRoot}`);
  log(`url:  ${appUrl}`);

  const parsed = parseUrl(appUrl);
  if (!parsed) fail(`invalid URL: ${appUrl}`);

  const host = parsed.hostname || '127.0.0.1';
  const port = Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80);

  if (!fs.existsSync(path.join(repoRoot, 'package.json'))) {
    fail(`package.json not found at ${repoRoot}`);
  }
  if (!fs.existsSync(electronDevScript)) {
    fail(`missing ${electronDevScript}`);
  }

  const electronBin = resolveElectronBinary();
  if (!electronBin) {
    fail(
      [
        'Electron is not installed.',
        '',
        'From the repo root run:',
        '  npm install',
        '  (or: npm install -D electron)',
        '',
        'Then double-click CoTrace Demo again.',
      ].join('\n'),
    );
  }

  const nodeModules = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    fail(
      [
        'Dependencies are missing (no node_modules).',
        '',
        'From the repo root run:',
        '  npm install',
        '',
        'Then double-click CoTrace Demo again.',
      ].join('\n'),
    );
  }

  let startedVite = false;
  const alreadyUp = await portOpen(host, port);
  if (alreadyUp) {
    const ready = await httpReady(appUrl);
    if (ready) {
      log(`dev server already running at ${appUrl}`);
    } else {
      log(`port ${port} is open but HTTP not ready yet — waiting …`);
      const ok = await waitForServer(appUrl, { host, port });
      if (!ok) fail(`timed out waiting for ${appUrl}`);
    }
  } else {
    startViteDev();
    startedVite = true;
    const ok = await waitForServer(appUrl, { host, port });
    if (!ok) {
      fail(
        [
          `timed out waiting for ${appUrl}.`,
          'Check that `npm run dev` works from the repo root,',
          'and that nothing else is blocking port ' + port + '.',
        ].join('\n'),
      );
    }
    log('dev server is ready');
  }

  try {
    const code = await runElectron();
    if (startedVite) {
      log(
        'Electron closed. Vite/dev server was started by this launcher and was left running for faster relaunch.',
      );
      log(`Stop it later with Task Manager or by freeing port ${port}.`);
    }
    process.exit(code);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

main();
