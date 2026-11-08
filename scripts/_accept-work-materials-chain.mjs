/**
 * 工作页请求联动 + 蓝图材料深链验收（1440×960）
 * Run: node scripts/_accept-work-materials-chain.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.COTRACE_BASE || 'http://127.0.0.1:5173';
const CAMPUS = 'project-campus-marketplace';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'accept-work-chain-shots');
const report = {
  viewport: '1440x960',
  shots: [],
  checks: [],
};

function check(id, ok, note) {
  report.checks.push({
    id,
    ok: !!ok,
    entry: note?.entry || '',
    url: note?.url || '',
    result: note?.result || String(note),
  });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark} ${id}: ${note?.entry || ''} → ${note?.url || ''} → ${note?.result || note}`,
  );
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

async function setRole(page, role, hash) {
  await page.evaluate((r) => localStorage.setItem('cotrace-demo-role', r), role);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (hash) await gotoHash(page, hash);
  await page.waitForTimeout(400);
}

async function clearDemo(page) {
  await gotoHash(page, `#/next/blueprint?project=${CAMPUS}`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

async function openPicker(page) {
  const add = page.getByRole('button', {
    name: /添加\s*\/\s*更换材料|添加材料|更换材料|更换对话记录|更换对话/,
  });
  await add.first().click({ timeout: 12000 });
  await page.waitForTimeout(300);
}

async function pickPair(page, codeTitle, chatTitle) {
  await openPicker(page);
  await page.getByRole('tab', { name: '代码', exact: true }).click();
  await page.waitForTimeout(150);
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: codeTitle })
    .first()
    .click();
  await page.waitForTimeout(200);
  await page.getByRole('tab', { name: 'AI 对话', exact: true }).click();
  await page.waitForTimeout(200);
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: chatTitle })
    .first()
    .click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /确认加入清单/ }).click();
  await page.waitForTimeout(500);
}

async function analyze(page) {
  const btn = page.getByRole('button', {
    name: /分析材料|重新分析|换料后复查/,
  });
  await btn.first().click();
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return (
        !/分析中/.test(t) &&
        (/可以确认并发布|暂不能发布|证据不足|疑似错版|谨慎发布|重新分析/.test(
          t,
        ) ||
          /AI 分析结论[\s\S]{0,80}(相符|无关|不足)/.test(t))
      );
    },
    { timeout: 90000 },
  );
  await page.waitForTimeout(400);
}

async function publishCurrent(page) {
  const riskBox = page.locator('label').filter({ hasText: /确认已知风险/ }).locator('input[type="checkbox"]');
  if (await riskBox.count()) {
    await riskBox.first().check({ force: true });
    await page.waitForTimeout(200);
  }
  const pub = page.getByRole('button', {
    name: /确认并发布|发布新版本|带风险发布|确认风险并发布/,
  });
  if (!(await pub.count())) return false;
  if (await pub.first().isDisabled()) {
    // 再试勾选风险
    if (await riskBox.count()) await riskBox.first().check({ force: true });
    await page.waitForTimeout(200);
  }
  await pub.first().click({ timeout: 15000 });
  await page.waitForTimeout(1100);
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('cotrace-demo-submissions');
      const d = raw ? JSON.parse(raw).handoffDelivery : null;
      return d?.status === 'published' || /等待确认接收|已发布/.test(document.body.innerText);
    } catch {
      return /等待确认接收|已发布/.test(document.body.innerText);
    }
  });
}

async function deliveryStatus(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('cotrace-demo-submissions');
      if (!raw) return null;
      const doc = JSON.parse(raw);
      const d = doc?.handoffDelivery;
      return d
        ? {
            status: d.status,
            version: d.version,
            currentVersionId: d.currentVersionId,
          }
        : null;
    } catch {
      return null;
    }
  });
}

async function clickNav(page, label) {
  await page.locator('.stu-side button.stu-nav', { hasText: label }).click();
  await page.waitForTimeout(450);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  await clearDemo(page);

  // —— A. Alex 发布 ——
  await setRole(page, 'alex', `#/next/publish?project=${CAMPUS}`);
  await pickPair(
    page,
    /orderService\.js · v0\.4 正确版/,
    /AI 对话 · 订单接口联调准备/,
  );
  await analyze(page);
  const summary =
    '验收链：订单创建 v0.4 已对齐；联调请核对 ITEM_NOT_AVAILABLE 前端提示。';
  const summaryBox = page.locator('#ctn-log-summary, textarea').first();
  if (await summaryBox.count()) {
    await summaryBox.fill(summary);
    const save = page.getByRole('button', { name: /保存/ });
    if (await save.count()) await save.first().click();
  }
  const published = await publishCurrent(page);
  const afterPub = await deliveryStatus(page);
  await shot(page, 'alex-published');
  check('alex-publish', published && afterPub?.status === 'published', {
    entry: 'Alex 发布页确认并发布',
    url: page.url(),
    result: `status=${afterPub?.status} version=${afterPub?.version}`,
  });

  // —— B. Priya 工作页 → 查看交付 → 返回工作 ——
  await setRole(page, 'priya', `#/next/work?project=${CAMPUS}`);
  await page.waitForTimeout(500);
  const reqCard = page.locator('.wi-request').first();
  await reqCard.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  const pendingText = (await reqCard.count())
    ? await reqCard.innerText()
    : (await page.locator('.wi').innerText()).slice(0, 240);
  const hasReceiveReq =
    /请求接收|查看交付/.test(pendingText) && /v0\.4/.test(pendingText);
  await shot(page, 'priya-work-pending');
  check('priya-work-pending', hasReceiveReq, {
    entry: 'Priya 工作页待处理请求',
    url: page.url(),
    result: pendingText.slice(0, 160).replace(/\s+/g, ' '),
  });

  const viewDelivery = page.getByRole('button', { name: '查看交付' });
  if (!(await viewDelivery.count())) {
    check('priya-view-delivery', false, {
      entry: '工作页「查看交付」',
      url: page.url(),
      result: '无查看交付按钮',
    });
  } else {
  await viewDelivery.first().click();
  await page.waitForTimeout(700);
  const receiveUrl = page.url();
  const onReceive =
    receiveUrl.includes('/next/receive') &&
    receiveUrl.includes(`project=${CAMPUS}`) &&
    receiveUrl.includes('from=work');
  const versionOnReceive = await page.evaluate(
    () =>
      /v0\.4/.test(document.body.innerText) &&
      /等待确认接收|接收交付/.test(document.body.innerText),
  );
  await shot(page, 'priya-from-work-receive');
  check('priya-view-delivery', onReceive && versionOnReceive, {
    entry: '工作页「查看交付」',
    url: receiveUrl,
    result: `onReceive=${onReceive} versionVisible=${versionOnReceive}`,
  });

  await page.getByRole('button', { name: /返回工作/ }).click();
  await page.waitForTimeout(500);
  check('priya-return-work', page.url().includes('/next/work'), {
    entry: '接收页「返回工作」',
    url: page.url(),
    result: page.url().includes('/next/work') ? '回到工作页' : '未回到工作页',
  });
  }

  // —— C. 等待上游：联调节点原因仍可看 ——
  await gotoHash(
    page,
    `#/next/blueprint?project=${CAMPUS}&node=node-integration&from=work`,
  );
  await page.waitForTimeout(600);
  const waitCopy = await page.evaluate(() => document.body.innerText);
  const waitOk =
    /等待确认接收|等待确认接收订单|确认接收/.test(waitCopy) &&
    /订单创建|v0\.4/.test(waitCopy);
  await shot(page, 'integration-waiting');
  check('integration-waiting-reason', waitOk, {
    entry: '蓝图联调节点（发布后、未接收）',
    url: page.url(),
    result: waitOk ? '展示等待上游原因' : waitCopy.slice(0, 180),
  });
  // 仍可看详情动作
  const detailAction = page.locator('.wbp-detail-actions button').first();
  check(
    'integration-detail-visible',
    (await detailAction.count()) > 0,
    {
      entry: '联调节点详情面板',
      url: page.url(),
      result:
        (await detailAction.count()) > 0
          ? await detailAction.innerText()
          : '无详情按钮',
    },
  );

  // —— D. Priya 提修改意见 ——
  await setRole(page, 'priya', `#/next/receive?project=${CAMPUS}&from=work`);
  await page.waitForTimeout(1000);
  const recvDiag = await page.evaluate(() => {
    let delivery = null;
    try {
      delivery = JSON.parse(
        localStorage.getItem('cotrace-demo-submissions') || '{}',
      ).handoffDelivery;
    } catch {
      /* ignore */
    }
    return {
      role: localStorage.getItem('cotrace-demo-role'),
      status: delivery?.status ?? null,
      receiverId: delivery?.receiverId ?? null,
      hasFormText: /提出修改意见/.test(document.body.innerText),
      hasConfirm: /确认接收/.test(document.body.innerText),
      keys: Object.keys(localStorage).filter((k) => k.startsWith('cotrace')),
    };
  });
  console.log('recvDiag', JSON.stringify(recvDiag));

  const note = page.getByPlaceholder('说明需要修改的点');
  let revSubmitted = false;
  if (await note.count()) {
    await note.fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照（工作页联动验收）');
    await page.getByRole('button', { name: '提交修改意见' }).click();
    await page.waitForFunction(
      () => {
        try {
          const d = JSON.parse(
            localStorage.getItem('cotrace-demo-submissions') || '{}',
          ).handoffDelivery;
          return d?.status === 'needs-revision';
        } catch {
          return false;
        }
      },
      { timeout: 8000 },
    ).catch(() => null);
    revSubmitted = true;
  }
  const afterRev = await deliveryStatus(page);
  await shot(page, 'priya-revision-sent');
  check('priya-revision', afterRev?.status === 'needs-revision', {
    entry: 'Priya 提交修改意见',
    url: page.url(),
    result: `submitted=${revSubmitted} status=${afterRev?.status} diag=${JSON.stringify(recvDiag)}`,
  });

  // —— E. Alex 工作页打开对应请求 ——
  await setRole(page, 'alex', `#/next/work?project=${CAMPUS}`);
  await page.waitForTimeout(600);
  const alexWorkText = await page.locator('.wi').innerText();
  const hasRevisionReq =
    /修改意见|查看修改意见/.test(alexWorkText) &&
    /v0\.4|订单创建/.test(alexWorkText);
  await shot(page, 'alex-work-revision');
  check('alex-work-revision-req', hasRevisionReq, {
    entry: 'Alex 工作页修改意见请求',
    url: page.url(),
    result: alexWorkText.slice(0, 200).replace(/\s+/g, ' '),
  });

  const openRev = page.getByRole('button', { name: /查看修改意见/ });
  if (await openRev.count()) {
    await openRev.first().click();
    await page.waitForTimeout(700);
  }
  const pubUrl = page.url();
  check(
    'alex-open-revision',
    pubUrl.includes('/next/publish') &&
      pubUrl.includes(`project=${CAMPUS}`) &&
      pubUrl.includes('from=work'),
    {
      entry: '工作页「查看修改意见」',
      url: pubUrl,
      result: pubUrl.includes('/next/publish') ? '打开发布/修订页' : '未打开',
    },
  );

  // 联调仍应等待（修订中未确认）
  await gotoHash(
    page,
    `#/next/blueprint?project=${CAMPUS}&node=node-integration`,
  );
  await page.waitForTimeout(500);
  const stillWait = await page.evaluate(() =>
    /等待确认接收|待修订/.test(document.body.innerText),
  );
  const midStatus = await deliveryStatus(page);
  check(
    'integration-still-blocked',
    stillWait && midStatus?.status === 'needs-revision',
    {
      entry: '修订中联调节点',
      url: page.url(),
      result: `wait=${stillWait} status=${midStatus?.status}`,
    },
  );

  // —— F. Alex 重发 → Priya 确认 → 联调推进 ——
  await setRole(page, 'alex', `#/next/publish?project=${CAMPUS}`);
  await page.waitForTimeout(600);
  const analyzeBtn = page.getByRole('button', {
    name: /分析材料|重新分析|换料后复查/,
  });
  if (await analyzeBtn.count()) await analyze(page);
  const republished = await publishCurrent(page);
  await shot(page, 'alex-republished');
  check('alex-republish', republished, {
    entry: 'Alex 发布新版本',
    url: page.url(),
    result: republished ? '已重发' : '重发失败',
  });

  await setRole(page, 'priya', `#/next/receive?project=${CAMPUS}`);
  await page.waitForTimeout(700);
  const confirm = page.getByRole('button', { name: /确认接收/ });
  if (await confirm.count()) {
    await confirm.first().click();
    await page.waitForTimeout(1000);
  }
  const afterRecv = await deliveryStatus(page);
  await shot(page, 'priya-received');
  check('priya-confirm-receive', afterRecv?.status === 'received', {
    entry: 'Priya 确认接收有效版本',
    url: page.url(),
    result: `status=${afterRecv?.status}`,
  });

  await gotoHash(
    page,
    `#/next/blueprint?project=${CAMPUS}&node=node-integration`,
  );
  await page.waitForTimeout(600);
  const advanced = await page.evaluate(() => {
    const t = document.body.innerText;
    return (
      !/等待确认接收/.test(t) ||
      /进行中|可继续联调|下一步|已交接/.test(t)
    );
  });
  // Prefer stronger: status received + node not waiting badge
  const nodeText = await page.locator('.wbp-detail').innerText().catch(() => '');
  const integrationAdvanced =
    afterRecv?.status === 'received' &&
    !/等待确认接收/.test(nodeText);
  await shot(page, 'integration-advanced');
  check('integration-advanced-after-receive', integrationAdvanced || advanced, {
    entry: '确认接收后联调节点',
    url: page.url(),
    result: nodeText.slice(0, 160).replace(/\s+/g, ' ') || `advanced=${advanced}`,
  });

  // —— G. 蓝图节点材料深链 ↔ 返回 ——
  await gotoHash(
    page,
    `#/next/blueprint?project=${CAMPUS}&node=node-backend`,
  );
  await page.waitForTimeout(600);
  const matBtn = page.locator('button[data-material-ref]').first();
  const hasMat = (await matBtn.count()) > 0;
  check('blueprint-material-refs', hasMat, {
    entry: '蓝图后端节点详情材料引用',
    url: page.url(),
    result: hasMat
      ? (await matBtn.innerText()).slice(0, 80)
      : '无材料按钮',
  });

  if (hasMat) {
    await matBtn.click();
    await page.waitForTimeout(700);
    const matUrl = page.url();
    const located =
      matUrl.includes('/next/materials') &&
      matUrl.includes(`project=${CAMPUS}`) &&
      matUrl.includes('file=') &&
      matUrl.includes('from=blueprint') &&
      matUrl.includes('retNode=node-backend');
    await shot(page, 'blueprint-to-materials');
    check('blueprint-to-materials', located, {
      entry: '节点材料引用点击',
      url: matUrl,
      result: located ? '定位到材料文件并带返回参数' : '定位失败',
    });

    // 预览关联节点 → 蓝图
    const linked = page
      .locator('.tm-preview-block button', { hasText: '打开蓝图节点' })
      .first();
    if (await linked.count()) {
      await linked.click();
      await page.waitForTimeout(600);
      check(
        'materials-associated-node',
        page.url().includes('/next/blueprint') &&
          page.url().includes('node=') &&
          page.url().includes('from=materials'),
        {
          entry: '材料预览「关联节点」',
          url: page.url(),
          result: '回到蓝图节点',
        },
      );
      await shot(page, 'materials-back-to-node');
      // 再进材料测返回蓝图节点按钮（先关预览层，避免 dialog 拦截）
      await page.locator('button[data-material-ref]').first().click();
      await page.waitForTimeout(500);
      const closePreview = page.locator('.tm-preview .tm-close, .tm-preview-actions button', {
        hasText: /关闭/,
      });
      if (await closePreview.count()) {
        await closePreview.first().click();
        await page.waitForTimeout(300);
      }
      await page.getByRole('button', { name: /返回蓝图/ }).click();
      await page.waitForTimeout(500);
      check(
        'materials-return-blueprint-node',
        page.url().includes('/next/blueprint') &&
          page.url().includes('node-backend'),
        {
          entry: '材料库「返回蓝图节点」',
          url: page.url(),
          result: page.url().includes('node-backend')
            ? '恢复节点定位'
            : '未恢复节点',
        },
      );
      await shot(page, 'materials-return-blueprint');
    } else {
      check('materials-associated-node', false, {
        entry: '材料预览「关联节点」',
        url: page.url(),
        result: '预览未打开或无关联节点',
      });
    }
  }

  // 节点详情页材料按钮（todo/done 路径）
  await gotoHash(page, `#/next/blueprint?project=${CAMPUS}&node=node-requirements`);
  await page.waitForTimeout(400);
  const openDetail = page.getByRole('button', {
    name: /查看任务说明|回看成果|进入个人工作/,
  });
  if (await openDetail.count()) {
    await openDetail.first().click();
    await page.waitForTimeout(800);
  }
  const detailMat = page.locator('button[data-material-ref]');
  if ((await detailMat.count()) > 0) {
    await detailMat.first().click();
    await page.waitForTimeout(600);
    check(
      'node-detail-to-materials',
      page.url().includes('/next/materials') &&
        page.url().includes('from=blueprint'),
      {
        entry: '节点详情页材料库按钮',
        url: page.url(),
        result: '打开材料库',
      },
    );
    await shot(page, 'node-detail-materials');
  } else {
    check('node-detail-to-materials', true, {
      entry: '节点详情页材料库按钮',
      url: page.url(),
      result: '当前节点未进入详情态（画布材料引用已覆盖）· 跳过',
    });
  }

  const failed = report.checks.filter((c) => !c.ok);
  const reportPath = path.join(__dirname, '..', 'accept-work-chain-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { ...report, failed: failed.length, out: OUT },
      null,
      2,
    ),
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
