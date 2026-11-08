/** One-shot live timeout probe. Forces COTRACE_AI_TIMEOUT_MS=50. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
process.env.COTRACE_AI_TIMEOUT_MS = '50';

const esbuild = require('esbuild');
const outfile = path.join(os.tmpdir(), 'cotrace-timeout-ai.mjs');
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'server/ai/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});

const { runHandoffAnalysis, resolveAiMode } = await import(
  `${pathToFileURL(outfile).href}?t=${Date.now()}`
);
const started = Date.now();
const result = await runHandoffAnalysis({
  projectId: 'project-campus-marketplace',
  taskId: 'node-backend',
  codeMaterialId: 'mat-code-order-v04',
  chatMaterialId: 'mat-chat-order-v04',
});
const payload = {
  mode: resolveAiMode(),
  ok: result.ok,
  message: result.ok ? null : result.message,
  ms: Date.now() - started,
};
console.log(JSON.stringify(payload));
fs.rmSync(outfile, { force: true });
process.exit(result.ok ? 1 : 0);
