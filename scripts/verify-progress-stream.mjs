/**
 * 运行：npm run verify:stream
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
// Force mock so default-live demos with a key do not burn quota in CI/local verify.
process.env.COTRACE_AI_MODE = 'mock';

const esbuild = require('esbuild');
const outfile = path.join(os.tmpdir(), 'cotrace-verify-progress-stream.mjs');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/verify-progress-stream.entry.ts')],
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
