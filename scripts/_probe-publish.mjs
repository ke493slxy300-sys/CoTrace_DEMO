import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const CAMPUS = 'project-campus-marketplace';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('ERR', m.text());
  });
  await page.goto(`${BASE}/#/next/blueprint?project=${CAMPUS}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.evaluate(() => localStorage.setItem('cotrace-demo-role', 'alex'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/#/next/publish?project=${CAMPUS}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(800);

  const add = page.getByRole('button', {
    name: /添加\s*\/\s*更换材料|添加材料|更换材料/,
  });
  console.log('add', await add.count());
  await add.first().click();
  await page.waitForTimeout(400);
  await page.getByRole('tab', { name: '代码', exact: true }).click();
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: /orderService\.js · v0\.4 正确版/ })
    .first()
    .click();
  await page.getByRole('tab', { name: 'AI 对话', exact: true }).click();
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: /订单接口联调准备/ })
    .first()
    .click();
  await page.getByRole('button', { name: /确认加入清单/ }).click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: /分析材料|重新分析/ }).first().click();
  await page.waitForFunction(
    () =>
      !/分析中/.test(document.body.innerText) &&
      /可以确认并发布|相符|暂不能发布|证据不足/.test(document.body.innerText),
    { timeout: 90000 },
  );
  const hit = (await page.innerText('body')).match(
    /可以确认并发布|相符|暂不能发布|证据不足/,
  );
  console.log('analyze hit', hit?.[0]);

  const pub = page.getByRole('button', {
    name: /确认并发布|发布新版本|确认风险并发布/,
  });
  console.log(
    'pub',
    await pub.count(),
    'disabled',
    await pub.first().isDisabled().catch(() => null),
  );
  console.log('pub text', await pub.first().innerText());
  await pub.first().click({ timeout: 15000 });
  await page.waitForTimeout(1500);

  const d = await page.evaluate(() => {
    const raw = localStorage.getItem('cotrace-demo-submissions');
    if (!raw) return null;
    return JSON.parse(raw).handoffDelivery;
  });
  console.log('status', d?.status, d?.version, d?.currentVersionId);
  console.log('risk', d?.riskAcknowledged, d?.analysis?.verdict);
  console.log('url', page.url());
  console.log('toast/body', (await page.innerText('body')).slice(0, 500));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
