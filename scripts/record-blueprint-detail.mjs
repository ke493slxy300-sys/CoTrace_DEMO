/**
 * 录制蓝图节点详情四段动效（改后）。依赖本机 playwright chromium。
 * 可选：若存在可用 ffmpeg，转成 avi；否则保留 webm + 连续截帧。
 * 用法：node scripts/record-blueprint-detail.mjs [baseUrl] [tag]
 * tag 默认 after
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const base = process.argv[2] || 'http://localhost:5173';
const tag = process.argv[3] || 'after';
const outDir = path.resolve('newuichange/_shots');
fs.mkdirSync(outDir, { recursive: true });

const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  'D:\\JianyingPro\\10.7.0.14095\\ffmpeg.exe',
  'ffmpeg',
].filter(Boolean);

function findFfmpeg() {
  for (const bin of ffmpegCandidates) {
    const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
    if (r.status === 0) return bin;
  }
  return null;
}

async function prep(page) {
  await page.goto(`${base}/#/next/projects`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /校园二手交易平台/ }).click();
  await page.waitForURL(/blueprint/);
  await page.waitForTimeout(700);
}

async function recordOne(browser, name, run) {
  const videoDir = path.join(outDir, `_video_${name}`);
  fs.rmSync(videoDir, { recursive: true, force: true });
  fs.mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
    recordVideo: { dir: videoDir, size: { width: 1536, height: 1024 } },
  });
  const page = await context.newPage();
  await prep(page);
  await run(page);
  await page.waitForTimeout(400);
  await context.close();
  const webm = fs.readdirSync(videoDir).find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error(`no webm for ${name}`);
  const src = path.join(videoDir, webm);
  const destWebm = path.join(outDir, `blueprint-detail-${tag}-${name}.webm`);
  fs.copyFileSync(src, destWebm);
  return destWebm;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const clips = [];

  clips.push(
    await recordOne(browser, 'open', async (page) => {
      await page.waitForTimeout(300);
      await page.locator('.wbp-node[data-node="node-requirements"]').click();
      await page.waitForTimeout(900);
    }),
  );

  clips.push(
    await recordOne(browser, 'switch', async (page) => {
      await page.locator('.wbp-node[data-node="node-requirements"]').click();
      await page.waitForTimeout(500);
      await page.locator('.wbp-node[data-node="node-backend"]').click();
      await page.waitForTimeout(500);
      await page.locator('.wbp-node[data-node="node-frontend"]').click();
      await page.waitForTimeout(700);
    }),
  );

  clips.push(
    await recordOne(browser, 'close', async (page) => {
      await page.locator('.wbp-node[data-node="node-backend"]').click();
      await page.waitForTimeout(600);
      await page.locator('.wbp-canvas').click({ position: { x: 24, y: 24 } });
      await page.waitForTimeout(800);
    }),
  );

  clips.push(
    await recordOne(browser, 'rapid', async (page) => {
      const ids = [
        'node-requirements',
        'node-database',
        'node-backend',
        'node-frontend',
        'node-integration',
        'node-testing',
      ];
      for (const id of ids) {
        await page.locator(`.wbp-node[data-node="${id}"]`).click();
        await page.waitForTimeout(70);
      }
      await page.waitForTimeout(700);
    }),
  );

  await browser.close();

  const ffmpeg = findFfmpeg();
  const converted = [];
  if (ffmpeg) {
    for (const webm of clips) {
      const avi = webm.replace(/\.webm$/, '.avi');
      const r = spawnSync(
        ffmpeg,
        ['-y', '-i', webm, '-c:v', 'mjpeg', '-q:v', '5', avi],
        { encoding: 'utf8' },
      );
      if (r.status === 0 && fs.existsSync(avi)) {
        converted.push(avi);
        console.log('AVI', avi);
      } else {
        console.log('AVI_FAIL', avi, r.stderr?.slice(-300));
      }
    }
  } else {
    console.log('FFMPEG_MISSING keep webm only');
  }

  const summary = { tag, webm: clips, avi: converted, ffmpeg };
  fs.writeFileSync(
    path.join(outDir, `blueprint-detail-${tag}-record.json`),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
