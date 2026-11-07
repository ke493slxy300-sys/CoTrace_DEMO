/**
 * 验收截图：1536×1024 / 1440×960。需本机已装 playwright chromium。
 * 用法：node scripts/capture-acceptance.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:5174';
const outDir = path.resolve('newuichange/_shots');
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, name, size) {
  await page.setViewportSize(size);
  await page.waitForTimeout(400);
  const file = path.join(outDir, `${name}-${size.width}x${size.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

async function reset(page) {
  await page.goto(`${base}/#/next/projects`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await reset(page);

  // 1) 项目列表
  await shot(page, 'project-list', { width: 1536, height: 1024 });
  await shot(page, 'project-list', { width: 1440, height: 960 });

  // 2) 蓝图
  await page.getByRole('button', { name: /校园二手交易平台/ }).click();
  await page.waitForTimeout(800);
  await page.waitForURL(/blueprint/);
  await shot(page, 'blueprint', { width: 1536, height: 1024 });
  await shot(page, 'blueprint', { width: 1440, height: 960 });

  // 字号抽样
  const typeSample = await page.evaluate(() => {
    const h1 = document.querySelector('.wbp-head h1');
    const stage = document.querySelector('.wbp-stage-title');
    const node = document.querySelector('.wbp-node strong');
    const nav = document.querySelector('.stu-nav.is-on');
    const cs = (el) =>
      el
        ? {
            text: el.textContent?.trim().slice(0, 40),
            fontSize: getComputedStyle(el).fontSize,
            fontWeight: getComputedStyle(el).fontWeight,
          }
        : null;
    return {
      pageTitle: cs(h1),
      stageTitle: cs(stage),
      nodeTitle: cs(node),
      nav: cs(nav),
      edgeCount: document.querySelectorAll('.wbp-edge').length,
      deliveryBadge: document.querySelector('.wbp-delivery-badge')?.textContent,
    };
  });
  console.log('TYPE_SAMPLE', JSON.stringify(typeSample, null, 2));

  // 3) 发布
  await page.locator('.wbp-detail button', { hasText: '发布交付' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'publish-before', { width: 1536, height: 1024 });
  await page.locator('.ctn-btn-primary', { hasText: '发布交付' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'publish-after', { width: 1536, height: 1024 });
  await shot(page, 'publish-after', { width: 1440, height: 960 });

  // 4) 切换 Priya 接收
  await page.evaluate(() => {
    localStorage.setItem('cotrace-demo-role', 'priya');
  });
  await page.goto(`${base}/#/next/blueprint`);
  await page.reload();
  await page.waitForTimeout(900);
  await shot(page, 'blueprint-priya', { width: 1536, height: 1024 });
  const receiveCta = page.locator('.wbp-detail button', { hasText: /待接收|打开待接收/ });
  if (await receiveCta.count()) await receiveCta.click();
  else await page.goto(`${base}/#/next/receive`);
  await page.waitForTimeout(500);
  await shot(page, 'receive-before', { width: 1536, height: 1024 });
  await page.locator('button', { hasText: /确认接收/ }).click();
  await page.waitForTimeout(500);
  await shot(page, 'receive-after', { width: 1536, height: 1024 });
  const backBp = page.locator('button', { hasText: /返回蓝图/ });
  if (await backBp.count()) await backBp.click();
  else await page.goto(`${base}/#/next/blueprint`);
  await page.waitForTimeout(700);
  await shot(page, 'blueprint-received', { width: 1536, height: 1024 });

  // 5) 校园历史空状态
  await page.getByRole('button', { name: '历史', exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, 'memory-campus-empty', { width: 1536, height: 1024 });

  // 6) SeatFlow 记忆
  await page.goto(`${base}/#/next/projects`);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /SeatFlow/ }).click();
  await page.waitForTimeout(600);
  await shot(page, 'memory-seatflow', { width: 1536, height: 1024 });
  const firstDecision = page.locator('.pm-card-main').first();
  if (await firstDecision.count()) {
    await firstDecision.click();
    await page.waitForTimeout(400);
    await shot(page, 'memory-seatflow-expanded', { width: 1536, height: 1024 });
  }

  // 7) 教师路径
  await page.evaluate(() => {
    localStorage.setItem('cotrace-demo-role', 'teacher');
  });
  await page.goto(`${base}/#/next/guide`);
  await page.reload();
  await page.waitForTimeout(900);
  await shot(page, 'guide', { width: 1536, height: 1024 });
  await shot(page, 'guide', { width: 1440, height: 960 });

  // 阶段待办 → 汇报
  await page.evaluate(() => {
    sessionStorage.setItem(
      'cotrace-teacher-focus-event',
      'event-exception-validation',
    );
  });
  await page.goto(`${base}/#/next/stage`);
  await page.waitForTimeout(700);
  await shot(page, 'stage', { width: 1536, height: 1024 });
  await shot(page, 'stage', { width: 1440, height: 960 });
  const sendBtn = page.locator('button', { hasText: '发送反馈' });
  if (await sendBtn.count()) {
    await sendBtn.click();
    await page.waitForTimeout(400);
    await shot(page, 'stage-after-feedback', { width: 1536, height: 1024 });
  }

  // 核收待办
  await page.evaluate(() => {
    sessionStorage.setItem(
      'cotrace-teacher-focus-submission',
      'final-submission-v1',
    );
  });
  await page.goto(`${base}/#/next/acceptance`);
  await page.waitForTimeout(700);
  await shot(page, 'acceptance', { width: 1536, height: 1024 });
  const acceptBtn = page.locator('button', { hasText: '确认核收' });
  if (await acceptBtn.count()) {
    await acceptBtn.click();
    await page.waitForTimeout(400);
    await shot(page, 'acceptance-after', { width: 1536, height: 1024 });
  }
  await page.goto(`${base}/#/next/guide`);
  await page.waitForTimeout(600);
  await shot(page, 'guide-after', { width: 1536, height: 1024 });

  await browser.close();
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
