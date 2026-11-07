/**
 * 打包并运行跨端交付链测试。
 * 运行：npm run verify:chain
 * 真实模型：COTRACE_AI_MODE=live OPENAI_API_KEY=... npm run verify:chain
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

/** Load .env.local into process.env without printing values. */
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

const esbuild = require('esbuild');
const outfile = path.join(os.tmpdir(), 'cotrace-verify-delivery-chain.mjs');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/verify-delivery-chain.entry.ts')],
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
