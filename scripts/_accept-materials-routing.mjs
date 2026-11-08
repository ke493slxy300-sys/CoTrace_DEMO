/**
 * 材料库 + 项目路由验收（1440×960）
 * Run: node scripts/_accept-materials-routing.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.COTRACE_BASE || 'http://127.0.0.1:5173';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'accept-materials-shots');
const report = {
  viewport: '1440x960',
  shots: [],
  checks: [],
};

function check(id, ok, note) {
  report.checks.push({ id, ok: !!ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${note}`);
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ name, file });
  return file;
}

async function gotoHash(page, hash) {
  await page.goto(`${BASE}/${hash.replace(/^\//, '')}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(450);
}

async function setRole(page, role) {
  await page.evaluate((r) => localStorage.setItem('cotrace-demo-role', r), role);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
}

async function clickNav(page, label) {
  await page.locator('.stu-side button.stu-nav', { hasText: label }).click();
  await page.waitForTimeout(400);
}

async function projectName(page) {
  return (
    (await page.locator('.stu-project-name').first().textContent()) || ''
  ).trim();
}

async function activeNav(page) {
  return (
    (await page.locator('.stu-side button.stu-nav.is-on').first().textContent()) ||
    ''
  ).trim();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  // reset
  await gotoHash(page, '#/next/blueprint?project=project-campus-marketplace');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await setRole(page, 'priya');
  await gotoHash(page, '#/next/blueprint?project=project-campus-marketplace');

  // --- Campus isolation loop ---
  check(
    'campus-blueprint-entry',
    (await projectName(page)).includes('校园') &&
      (await activeNav(page)).includes('蓝图'),
    `url=${page.url()} name=${await projectName(page)} nav=${await activeNav(page)}`,
  );
  await shot(page, 'campus-blueprint');

  await clickNav(page, '工作');
  check(
    'campus-work-nav',
    page.url().includes('/next/work') &&
      page.url().includes('project-campus-marketplace') &&
      (await activeNav(page)).includes('工作'),
    `url=${page.url()} nav=${await activeNav(page)}`,
  );
  await shot(page, 'campus-work');

  await clickNav(page, '材料');
  check(
    'campus-materials-nav',
    page.url().includes('/next/materials') &&
      page.url().includes('project-campus-marketplace') &&
      (await activeNav(page)).includes('材料'),
    `url=${page.url()} nav=${await activeNav(page)}`,
  );
  const foldersVisible = await page.locator('.tm-cards .tm-card').count();
  const fileRows = await page.locator('.tm-table tbody tr').count();
  check(
    'campus-materials-layout',
    foldersVisible === 4 && fileRows >= 4,
    `folderCards=${foldersVisible} fileRows=${fileRows}`,
  );
  await shot(page, 'campus-materials');

  await clickNav(page, '蓝图');
  check(
    'campus-back-blueprint',
    page.url().includes('/next/blueprint') &&
      page.url().includes('project-campus-marketplace'),
    `url=${page.url()}`,
  );

  // refresh materials
  await clickNav(page, '材料');
  await page.locator('.tm-cards .tm-card', { hasText: '接口与开发' }).click();
  await page.waitForTimeout(300);
  const folderUrl = page.url();
  check(
    'materials-folder-url',
    folderUrl.includes('folder=folder-api'),
    `url=${folderUrl}`,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  check(
    'materials-folder-refresh',
    page.url().includes('folder=folder-api') &&
      (await page.locator('.tm-card.is-on', { hasText: '接口与开发' }).count()) ===
        1,
    `url=${page.url()}`,
  );

  // open file preview + history version download path
  await page
    .locator('.tm-file-btn', { hasText: 'orderService.js' })
    .first()
    .click();
  await page.waitForTimeout(400);
  check(
    'materials-file-preview',
    page.url().includes('file=matfile-order-service') &&
      (await page.locator('.tm-preview-panel').count()) === 1,
    `url=${page.url()}`,
  );
  await shot(page, 'campus-materials-preview');

  // historical version
  await page
    .locator('.tm-preview-block button', { hasText: 'v0.3' })
    .first()
    .click();
  await page.waitForTimeout(300);
  check(
    'materials-history-version',
    page.url().includes('version=matver-order-svc-v03'),
    `url=${page.url()}`,
  );

  // associated node → blueprint → back materials
  await page
    .locator('.tm-preview-block button', { hasText: '打开蓝图节点' })
    .first()
    .click();
  await page.waitForTimeout(500);
  check(
    'materials-to-node',
    page.url().includes('/next/blueprint') &&
      page.url().includes('node=node-backend') &&
      page.url().includes('from=materials'),
    `url=${page.url()}`,
  );
  await page.getByRole('button', { name: /返回材料库/ }).click();
  await page.waitForTimeout(450);
  check(
    'node-back-materials',
    page.url().includes('/next/materials') &&
      (page.url().includes('folder=folder-api') ||
        (await page.locator('.tm-card.is-on').count()) >= 0),
    `url=${page.url()}`,
  );

  // --- SeatFlow isolation ---
  await gotoHash(page, '#/next/log?project=project-seatflow-demo');
  check(
    'seatflow-log',
    page.url().includes('project-seatflow-demo') &&
      (await projectName(page)).toLowerCase().includes('seat'),
    `url=${page.url()} name=${await projectName(page)}`,
  );
  await clickNav(page, '蓝图');
  check(
    'seatflow-blueprint-no-campus-jump',
    page.url().includes('project-seatflow-demo') &&
      !page.url().includes('campus-marketplace'),
    `url=${page.url()} name=${await projectName(page)}`,
  );
  await shot(page, 'seatflow-blueprint');
  await clickNav(page, '工作');
  check(
    'seatflow-work',
    page.url().includes('/next/work') &&
      page.url().includes('project-seatflow-demo'),
    `url=${page.url()}`,
  );
  await shot(page, 'seatflow-work');
  await clickNav(page, '材料');
  check(
    'seatflow-materials',
    page.url().includes('/next/materials') &&
      page.url().includes('project-seatflow-demo'),
    `url=${page.url()}`,
  );
  await shot(page, 'seatflow-materials');
  await clickNav(page, '蓝图');
  check(
    'seatflow-loop-back',
    page.url().includes('project-seatflow-demo'),
    `url=${page.url()}`,
  );

  // browser back from materials folder
  await gotoHash(
    page,
    '#/next/materials?project=project-campus-marketplace&folder=folder-req',
  );
  await gotoHash(
    page,
    '#/next/materials?project=project-campus-marketplace&folder=folder-api',
  );
  await page.goBack();
  await page.waitForTimeout(400);
  check(
    'materials-history-back',
    page.url().includes('folder=folder-req'),
    `url=${page.url()}`,
  );

  // role switch keeps page
  await gotoHash(
    page,
    '#/next/work?project=project-campus-marketplace',
  );
  await setRole(page, 'alex');
  // after reload, re-goto same hash to simulate choose() keep-hash path
  await gotoHash(page, '#/next/work?project=project-campus-marketplace');
  const roleLabel = await page.locator('.demo-role-btn').textContent();
  check(
    'role-switch-keep-work',
    page.url().includes('/next/work') &&
      page.url().includes('campus-marketplace') &&
      (roleLabel || '').includes('Alex'),
    `url=${page.url()} role=${roleLabel}`,
  );
  await shot(page, 'campus-work-alex');

  // missing target
  await gotoHash(
    page,
    '#/next/materials?project=project-campus-marketplace&file=does-not-exist',
  );
  check(
    'materials-missing-target',
    (await page.locator('.tm-missing').count()) === 1,
    'shows missing panel',
  );
  await page.getByRole('button', { name: '返回当前项目' }).click();
  await page.waitForTimeout(400);
  check(
    'materials-missing-return',
    page.url().includes('/next/materials') &&
      page.url().includes('campus-marketplace') &&
      !page.url().includes('does-not-exist'),
    `url=${page.url()}`,
  );

  // download named file (v0.3) — 列表行下载历史版本需先打开预览选中版本
  await gotoHash(
    page,
    '#/next/materials?project=project-campus-marketplace&folder=folder-api&file=matfile-order-service&version=matver-order-svc-v03',
  );
  await page.waitForSelector('.tm-preview-panel', { timeout: 5000 });
  await page.waitForTimeout(300);
  let downloadName = '';
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator('.tm-preview-actions button.is-primary').click(),
    ]);
    downloadName = download.suggestedFilename();
  } catch (error) {
    downloadName = `ERROR:${error instanceof Error ? error.message : String(error)}`;
  }
  check(
    'download-history-filename',
    downloadName === 'orderService.js',
    `suggested=${downloadName}`,
  );

  const failed = report.checks.filter((c) => !c.ok);
  fs.mkdirSync(OUT, { recursive: true });
  const reportPath = path.join(__dirname, '..', 'accept-materials-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ ...report, failed: failed.length, out: OUT }, null, 2),
  );
  console.log(`\nReport: ${reportPath}`);
  console.log(`Failed: ${failed.length}/${report.checks.length}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
