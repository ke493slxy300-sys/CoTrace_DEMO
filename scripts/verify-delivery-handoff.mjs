/**
 * 打包并运行交付状态链测试。不改动 dev / build 脚本。
 * 运行：npm run verify:delivery
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

const esbuild = require('esbuild');
const outfile = path.join(os.tmpdir(), 'cotrace-verify-delivery-handoff.mjs');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/verify-delivery-handoff.entry.ts')],
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
