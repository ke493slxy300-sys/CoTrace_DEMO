/**
 * 接手提示模拟版审阅截图 → newuichange/_shots/review-*.png
 * 用法：node scripts/capture-handoff-review.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:5174';
const outDir = path.resolve('newuichange/_shots');
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

async function shotFull(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1024 },
  });

  await page.goto(`${base}/#/next/projects`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(700);

  // Alex
  const roleBtn = page.getByRole('button', { name: /演示视角/ });
  await roleBtn.click();
  await page.getByText('Alex Lee', { exact: false }).first().click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: /校园二手交易平台/ }).click();
  await page.waitForTimeout(1000);
  await shot(page, 'review-01-blueprint-overview-1536x1024');

  await page.getByRole('button', { name: /后端接口/ }).click();
  await page.waitForTimeout(600);
  await shot(page, 'review-02-blueprint-backend-1536x1024');

  // Detail dock publish button
  const dockPublish = page.locator('.wbp-detail button', { hasText: '发布交付' });
  if (await dockPublish.count()) {
    await dockPublish.first().click();
  } else {
    await page.getByRole('button', { name: /发布交付/ }).first().click();
  }
  await page.waitForTimeout(800);
  if (!page.url().includes('/next/publish')) {
    await page.goto(`${base}/#/next/publish`);
    await page.waitForTimeout(600);
  }
  await shot(page, 'review-03-publish-top-1536x1024');

  const briefHead = page.getByRole('heading', { name: '接手提示' });
  await briefHead.scrollIntoViewIfNeeded();
  await shot(page, 'review-04-publish-brief-controls-1536x1024');

  await page.getByRole('button', { name: '整理接手提示' }).click();
  await page.waitForTimeout(1400);
  await briefHead.scrollIntoViewIfNeeded();
  await shot(page, 'review-05-publish-brief-filled-1536x1024');
  await shotFull(page, 'review-06-publish-full-1536x1024');

  const aiRegion = page.getByRole('region', { name: 'AI整理提示' });
  if (await aiRegion.count()) {
    await aiRegion.scrollIntoViewIfNeeded();
    await shot(page, 'review-07-publish-ai-region-1536x1024');
  }

  await page.getByRole('button', { name: '发布交付' }).click();
  await page.waitForTimeout(700);
  await shot(page, 'review-08-publish-receipt-1536x1024');

  // Priya
  await page.getByRole('button', { name: /演示视角/ }).click();
  await page.waitForTimeout(200);
  await page.getByText('Priya Shah', { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.goto(`${base}/#/next/receive`);
  await page.waitForTimeout(800);
  await shot(page, 'review-09-receive-1536x1024');
  await shotFull(page, 'review-10-receive-full-1536x1024');

  const evidence = page.getByRole('button', { name: /查看依据/ });
  if (await evidence.count()) {
    await evidence.first().click();
    await page.waitForTimeout(500);
    await shotFull(page, 'review-11-receive-evidence-1536x1024');
  }

  console.log(
    'files',
    fs.readdirSync(outDir).filter((f) => f.startsWith('review-')).join('\n'),
  );
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
