import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const CAMPUS = 'project-campus-marketplace';

async function setRole(page, role, hash) {
  await page.evaluate((r) => localStorage.setItem('cotrace-demo-role', r), role);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/${hash.replace(/^\//, '')}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(`${BASE}/#/next/blueprint?project=${CAMPUS}`, {
    waitUntil: 'domcontentloaded',
  });
  // reuse existing published state if any; otherwise create quick
  let status = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('cotrace-demo-submissions') || '{}')
        ?.handoffDelivery?.status;
    } catch {
      return null;
    }
  });
  console.log('pre status', status);
  if (status !== 'published') {
    console.log('need published delivery — run full chain first');
  }
  await setRole(page, 'priya', `#/next/receive?project=${CAMPUS}&from=work`);
  const info = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasForm: /提出修改意见/.test(text),
      hasSubmit: /提交修改意见/.test(text),
      hasConfirm: /确认接收/.test(text),
      switchAlex: /请切换到/.test(text),
      statusLine: (text.match(/等待确认接收|已提出修改|已确认接收|等待发布/) || [])[0],
      role: localStorage.getItem('cotrace-demo-role'),
      delivery: (() => {
        try {
          const d = JSON.parse(
            localStorage.getItem('cotrace-demo-submissions') || '{}',
          ).handoffDelivery;
          return {
            status: d?.status,
            receiverId: d?.receiverId,
            publisherId: d?.publisherId,
          };
        } catch {
          return null;
        }
      })(),
    };
  });
  console.log(info);
  const note = page.getByPlaceholder('说明需要修改的点');
  console.log('placeholder count', await note.count());
  if (await note.count()) {
    await note.fill('probe revision note');
    await page.getByRole('button', { name: '提交修改意见' }).click();
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('cotrace-demo-submissions') || '{}')
          ?.handoffDelivery?.status;
      } catch {
        return null;
      }
    });
    console.log('after', after, (await page.innerText('body')).match(/已提交修改意见|请填写|无法提交/)?.[0]);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
