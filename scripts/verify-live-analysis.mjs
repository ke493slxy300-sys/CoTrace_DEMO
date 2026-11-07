/**
 * Live-only sample: four material pairs via the same analysis entry.
 * Requires DEEPSEEK_API_KEY in .env.local.
 * Run: node scripts/verify-live-analysis.mjs
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();
process.env.COTRACE_AI_MODE = 'live';

if (!(process.env.DEEPSEEK_API_KEY || '').trim()) {
  console.error('DEEPSEEK_API_KEY missing in .env.local');
  process.exit(1);
}

const esbuild = require('esbuild');
const outfile = path.join(os.tmpdir(), 'cotrace-verify-live-analysis.mjs');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/verify-live-analysis.entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});

try {
  await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
} finally {
  fs.rmSync(outfile, { force: true });
}
