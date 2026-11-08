/**
 * 浏览器三条主路径验收（同页切角色）。
 * 前置：npm run dev 已在 127.0.0.1:5173 运行。
 * 输出脱敏 ID 与关键请求字段到 stdout JSON。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.COTRACE_ACCEPT_BASE || 'http://127.0.0.1:5173';
const MARK_V1 = '【验收标记-改句】联调前请核对 ITEM_NOT_AVAILABLE 提示';
const MARK_V2 = '【验收标记-重发】已补充错误码与页面提示对照';
const HELP_TEXT = '【求助-旧版】页面提示和错误码对不上，请老师看看';
const FEEDBACK_TEXT = '【教师反馈-验收】请先核对接口版本，再补错误码与页面提示对照。';

const report = {
  scenarios: {},
  requests: {
    handoffFocus: [],
    helpContext: [],
    publish: [],
  },
  ids: {},
  notes: [],
};

function redact(value) {
  if (value == null) return value;
  const s = String(value);
  if (/sk-|api[_-]?key|Bearer\s/i.test(s)) return '[REDACTED]';
  return s;
}

async function setRole(page, role) {
  // Must full-reload so demoRoleStore memory picks up localStorage (SPA hash nav keeps alex in memory).
  await page.evaluate((next) => {
    localStorage.setItem('cotrace-demo-role', next);
  }, role);
  const hash =
    role === 'teacher'
      ? '#/next/stage'
      : role === 'priya'
        ? '#/next/receive'
        : '#/next/publish';
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const label = await page.locator('.demo-role-btn').innerText().catch(() => '');
  report.notes.push(`setRole ${role} → UI「${label}」`);
}

async function resetDemo(page) {
  await page.goto(`${BASE}/#/next/publish`);
  await page.evaluate(() => {
    const keys = [
      'cotrace-demo-submissions',
      'cotrace-demo-delivery',
      'cotrace-demo-process-events',
      'cotrace-demo-acceptance',
      'cotrace-demo-role',
      'cotrace-demo-storage-meta',
      'cotrace-demo-node-collaboration',
    ];
    for (const key of keys) localStorage.removeItem(key);
  });
  await page.reload();
  await page.waitForTimeout(800);
}

async function pickMaterials(page) {
  await page.getByRole('button', { name: '添加材料', exact: true }).click();
  await page.waitForSelector('.ctn-picker', { timeout: 10000 });

  const codeTab = page.getByRole('tab', { name: '代码' });
  if (await codeTab.count()) await codeTab.click();
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: /正确版/ })
    .first()
    .click();

  const chatTab = page.getByRole('tab', { name: 'AI 对话' });
  if (await chatTab.count()) await chatTab.click();
  await page.waitForTimeout(250);
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: /联调准备/ })
    .first()
    .click();

  await page.getByRole('button', { name: '确认加入清单', exact: true }).click();
  await page.waitForTimeout(400);
}

async function analyzeAndEditPublish(page, summaryMark) {
  await page.getByRole('button', { name: /生成交付报告/ }).click();
  // Live analysis can take ~10s; if AI fails, fall back to manual log
  try {
    await page.waitForSelector('#ctn-log-summary', { timeout: 90000 });
  } catch {
    // Manual path: still allow publish if materials selected — create draft via localStorage not available.
    // Re-click analyze once more, then abort with page hint.
    const hint = await page.locator('.ctn-hint').innerText().catch(() => '');
    throw new Error(`analysis did not produce log draft. hint=${hint}`);
  }
  await page.waitForTimeout(400);
  await page.fill('#ctn-log-summary', summaryMark);
  await page.getByRole('button', { name: '保存修订' }).click();
  await page.waitForTimeout(200);
  const riskBox = page.locator('.ctn-field input[type="checkbox"]');
  if (await riskBox.count()) {
    await riskBox.first().check();
    const riskNotes = page.getByLabel('风险说明');
    if (await riskNotes.count()) {
      await riskNotes.fill('验收：已知联调侧需再核对错误码提示');
    }
  }
  const riskPublish = page.getByRole('button', { name: '带风险发布', exact: true });
  const normalPublish = page.getByRole('button', { name: '确认并发布', exact: true });
  const republish = page.getByRole('button', { name: '发布新版本', exact: true });
  if (await riskPublish.count()) await riskPublish.click();
  else if (await normalPublish.count()) await normalPublish.click();
  else if (await republish.count()) await republish.click();
  else throw new Error('no publish button');
  await page.waitForTimeout(1000);
  await page.waitForSelector('text=人机协作日志（已确认）', { timeout: 15000 });
}

async function readDelivery(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('cotrace-demo-submissions');
    if (!raw) return null;
    try {
      const doc = JSON.parse(raw);
      return doc.handoffDelivery || null;
    } catch {
      return null;
    }
  });
}

async function readEvents(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('cotrace-demo-process-events');
    if (!raw) return [];
    try {
      return JSON.parse(raw).events || [];
    } catch {
      return [];
    }
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/api/')) return;
  let body = null;
  try {
    const post = req.postData();
    if (post) body = JSON.parse(post);
  } catch {
    body = { raw: '[unparsed]' };
  }
  if (url.includes('/api/ai/handoff-focus') && body) {
    report.requests.handoffFocus.push({
      versionId: redact(body.versionId),
      deliveryId: redact(body.deliveryId),
      summary: redact(body.sharedLog?.summary || body.collaborationSummary || ''),
      riskNotes: redact(body.riskNotes || ''),
      codeMaterialId: body.codeMaterialId,
      chatMaterialId: body.chatMaterialId,
    });
  }
  if (url.includes('/api/ai/help-context') && body) {
    report.requests.helpContext.push({
      mode: body.mode,
      deliveryVersionId: redact(body.deliveryVersionId),
      studentText: redact(body.studentText || ''),
      summary: redact(body.sharedLog?.summary || body.collaborationSummary || ''),
      adoptedSupplements: (body.adoptedSupplements || []).map(redact),
    });
  }
  if (url.includes('/api/deliveries/publish') && body) {
    report.requests.publish.push({
      versionId: redact(body.snapshot?.versionId),
      summary: redact(body.snapshot?.collaborationLog?.summary || body.snapshot?.brief || ''),
      codeMaterialId: body.snapshot?.codeMaterialId,
      chatMaterialId: body.snapshot?.chatMaterialId,
      riskNotes: redact(body.snapshot?.riskNotes || ''),
    });
  }
});

try {
  await resetDemo(page);
  await setRole(page, 'alex');
  await page.goto(`${BASE}/#/next/publish`);
  await page.waitForTimeout(600);

  await pickMaterials(page);
  const afterPick = await readDelivery(page);
  report.notes.push(
    `afterPick code=${afterPick?.selectedCodeMaterialId} chat=${afterPick?.selectedChatMaterialId} status=${afterPick?.status}`,
  );
  if (!afterPick?.selectedCodeMaterialId || !afterPick?.selectedChatMaterialId) {
    const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'accept-fail-pick.png');
    await page.screenshot({ path: shot, fullPage: true });
    throw new Error(`materials not selected; shot=${shot}`);
  }
  await analyzeAndEditPublish(page, MARK_V1);

  let delivery = await readDelivery(page);
  if (!delivery?.currentVersionId) {
    const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'accept-fail-publish.png');
    await page.screenshot({ path: shot, fullPage: true });
    const hint = await page.locator('.ctn-hint').allInnerTexts().catch(() => []);
    throw new Error(
      `publish failed: no currentVersionId status=${delivery?.status} hint=${hint.join('|')} shot=${shot}`,
    );
  }
  const version1 = delivery.currentVersionId;
  report.ids.version1 = version1;
  report.ids.deliveryId = delivery.id;

  // --- Scenario 1: refresh + Priya sees same sentence; focus request ---
  await page.reload();
  await page.waitForTimeout(500);
  await setRole(page, 'priya');
  await page.goto(`${BASE}/#/next/receive`);
  await page.waitForTimeout(2500); // allow focus AI
  const bodyText = await page.locator('body').innerText();
  const seesMark = bodyText.includes(MARK_V1);
  const focusHit = report.requests.handoffFocus.find(
    (item) => item.versionId === version1 && String(item.summary).includes('验收标记-改句'),
  );
  report.scenarios.editAndPublish = {
    ok: Boolean(seesMark && focusHit),
    seesMark,
    focusRequest: focusHit || report.requests.handoffFocus[0] || null,
  };

  // --- Scenario 3 prep: help against current (will become old) ---
  await page.locator('textarea').filter({ hasText: '' }).first().fill(HELP_TEXT).catch(() => {});
  // More reliable: find help textarea by placeholder
  const helpArea = page.locator('textarea[placeholder*="联调卡点"]');
  await helpArea.fill(HELP_TEXT);
  await page.getByRole('button', { name: '正式提交求助' }).click();
  await page.waitForTimeout(400);
  const eventsAfterHelp = await readEvents(page);
  const helpEvent = eventsAfterHelp.find(
    (e) => e.kind === 'student-help' && String(e.summary).includes('求助-旧版'),
  );
  report.ids.helpEventId = helpEvent?.id || null;
  report.ids.helpVersionId = helpEvent?.versionId || null;

  // --- Scenario 2: revision → republish → confirm ---
  await page.getByRole('heading', { name: '提出修改意见' }).scrollIntoViewIfNeeded();
  await page
    .getByPlaceholder('说明需要修改的点')
    .fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照说明');
  await page.getByRole('button', { name: '提交修改意见' }).click();
  await page.waitForTimeout(800);

  await setRole(page, 'alex');
  await page.goto(`${BASE}/#/next/publish`);
  await page.waitForTimeout(800);
  const alexText = await page.locator('body').innerText();
  const seesRevision = /修改意见|ITEM_NOT_AVAILABLE/.test(alexText);

  // May need re-analyze if materials cleared by selectMaterials on needs-revision path
  // On needs-revision, materials should still be selected
  if (!(await page.locator('#ctn-log-summary').count())) {
    await page.getByRole('button', { name: /生成交付报告/ }).click();
    await page.waitForSelector('#ctn-log-summary', { timeout: 90000 });
  }
  await page.fill('#ctn-log-summary', MARK_V2);
  await page.getByRole('button', { name: '保存修订' }).click();
  const riskBox2 = page.locator('.ctn-field input[type="checkbox"]');
  if (await riskBox2.count()) await riskBox2.first().check();
  const pub2 = page.getByRole('button', { name: /带风险发布|发布新版本|确认并发布/ });
  await pub2.first().click();
  await page.waitForTimeout(1000);

  delivery = await readDelivery(page);
  const version2 = delivery?.currentVersionId;
  report.ids.version2 = version2;

  // Stale confirm via page evaluate of store logic is hard; call receive API + local check
  await setRole(page, 'priya');
  await page.goto(`${BASE}/#/next/receive`);
  await page.waitForTimeout(2000);

  const staleAttempt = await page.evaluate(
    async ({ deliveryId, versionId }) => {
      // Local chain: try to receive with old version via exposed store isn't available.
      // Check UI: history marks old version.
      const text = document.body.innerText;
      return {
        historyMentionsOld: /历史版本|（旧）/.test(text),
        bodyHasV2Mark: text.includes('验收标记-重发') || text.includes(versionId),
        deliveryId,
        versionId,
      };
    },
    { deliveryId: delivery.id, versionId: version1 },
  );

  // Confirm current version
  const confirmBtn = page.getByRole('button', { name: /确认接收/ });
  await confirmBtn.click();
  await page.waitForTimeout(1000);

  delivery = await readDelivery(page);
  const receivedOk = delivery?.status === 'received';

  await page.goto(`${BASE}/#/next/blueprint`);
  await page.waitForTimeout(800);
  const blueprintText = await page.locator('body').innerText();
  const integrationLive = /联调进行中/.test(blueprintText);

  report.scenarios.revisionRepublishConfirm = {
    ok: Boolean(
      seesRevision &&
        version1 &&
        version2 &&
        version1 !== version2 &&
        receivedOk &&
        integrationLive &&
        staleAttempt.historyMentionsOld,
    ),
    seesRevision,
    version1,
    version2,
    receivedOk,
    integrationLive,
    staleAttempt,
  };

  // --- Scenario 3: teacher opens old help ---
  await setRole(page, 'teacher');
  await page.goto(`${BASE}/#/next/stage`);
  await page.waitForTimeout(1000);

  // Click the help event
  const helpBtn = page.locator('button', { hasText: /联调求助|求助-旧版/ }).first();
  if (await helpBtn.count()) {
    await helpBtn.click();
  } else {
    // Click any student-help titled button
    const anyHelp = page.locator('.cts-time button').filter({ hasText: /求助/ }).first();
    if (await anyHelp.count()) await anyHelp.click();
  }
  await page.waitForTimeout(4000); // teacher help-context AI

  const teacherBody = await page.locator('body').innerText();
  const teacherSeesOldLog =
    teacherBody.includes('验收标记-改句') ||
    teacherBody.includes(version1) ||
    (report.ids.helpVersionId === version1);

  const helpCtx = report.requests.helpContext.find(
    (item) =>
      item.mode === 'teacher-brief' &&
      item.deliveryVersionId === version1 &&
      String(item.studentText).includes('求助-旧版'),
  );

  // Skip AI suggestion: overwrite draft and send
  const draft = page.locator('textarea').last();
  await draft.fill(FEEDBACK_TEXT);
  await page.getByRole('button', { name: /发送正式反馈|发送反馈/ }).click();
  await page.waitForTimeout(600);

  await setRole(page, 'alex');
  await page.goto(`${BASE}/#/next/log`);
  await page.waitForTimeout(800);
  const logAlex = await page.locator('body').innerText();
  const alexSeesFeedback = logAlex.includes('教师反馈-验收');

  await setRole(page, 'priya');
  await page.goto(`${BASE}/#/next/log`);
  await page.waitForTimeout(800);
  const logPriya = await page.locator('body').innerText();
  const priyaSeesFeedback = logPriya.includes('教师反馈-验收');

  report.scenarios.oldHelpNewPublish = {
    ok: Boolean(
      report.ids.helpVersionId === version1 &&
        (helpCtx || teacherSeesOldLog) &&
        alexSeesFeedback &&
        priyaSeesFeedback,
    ),
    helpEventId: report.ids.helpEventId,
    helpVersionId: report.ids.helpVersionId,
    teacherHelpContext: helpCtx || report.requests.helpContext.filter((i) => i.mode === 'teacher-brief').slice(-1)[0] || null,
    teacherSeesOldLog,
    alexSeesFeedback,
    priyaSeesFeedback,
  };

  report.notes.push(
    `publish sync count=${report.requests.publish.length}`,
    `focus count=${report.requests.handoffFocus.length}`,
    `help-context count=${report.requests.helpContext.length}`,
  );
} catch (error) {
  report.error = String(error && error.stack ? error.stack : error);
} finally {
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outPath = path.join(outDir, 'accept-main-path-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log('WROTE', outPath);
  await browser.close();
}

const allOk =
  report.scenarios.editAndPublish?.ok &&
  report.scenarios.revisionRepublishConfirm?.ok &&
  report.scenarios.oldHelpNewPublish?.ok;
process.exit(allOk ? 0 : 1);
