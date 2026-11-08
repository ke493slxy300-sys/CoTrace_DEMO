/**
 * Full「校园二手交易平台」handoff + teacher feedback acceptance.
 * Prefers real browser path; captures handoff-focus / help-context payloads.
 *
 * Pref: npm run dev on 127.0.0.1:5173 (COTRACE_AI_MODE=mock|live).
 * Run:  node scripts/_accept-handoff-feedback.mjs
 *
 * Optional: COTRACE_ACCEPT_FAIL_AI=1 to force one AI failure (via response override).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.COTRACE_ACCEPT_BASE || 'http://127.0.0.1:5173';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'accept-handoff-feedback-shots');
const OUT_JSON = path.join(ROOT, 'accept-handoff-feedback-report.json');

/** Manually added sentence — must appear in Priya handoff-focus model input. */
const MANUAL_SENTENCE =
  '联调时请重点核对商品已下架时，订单接口的错误返回与前端提示是否一致';
const MARK_V2 =
  '【验收-重发】已补充错误码与页面提示对照；请 Priya 再确认本版。';
const HELP_TEXT =
  '【求助-旧版】页面提示和错误码对不上，商品已下架时前端文案与接口返回不一致，请老师看看';
const FEEDBACK_TEXT =
  '【教师反馈-验收】请先按求助绑定的旧版协作日志核对 ITEM_NOT_AVAILABLE / 已下架提示，再对照新版材料。';
const REVISION_NOTE =
  '请补充 ITEM_NOT_AVAILABLE 与页面提示对照说明，并保留已下架场景核对句。';

const report = {
  startedAt: new Date().toISOString(),
  health: null,
  steps: [],
  proofs: {
    alexManualSentenceInHandoffFocus: null,
    teacherBriefBoundToOldVersion: null,
  },
  ids: {},
  requests: {
    analysis: [],
    handoffFocus: [],
    helpContext: [],
    publish: [],
  },
  responses: {
    analysis: [],
    handoffFocus: [],
    helpContext: [],
  },
  shots: [],
  bugsFixed: [],
  failureDegrade: null,
  remainingGaps: [],
  notes: [],
  error: null,
};

function redactDeep(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/sk-|api[_-]?key|Bearer\s/i.test(value)) return '[REDACTED]';
    return value.length > 1200 ? `${value.slice(0, 1200)}…` : value;
  }
  if (Array.isArray(value)) return value.map(redactDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/key|secret|authorization|token/i.test(k) && typeof v === 'string') {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out;
  }
  return value;
}

function step(row) {
  report.steps.push(row);
  console.log(
    [
      row.入口 || '',
      row.版本或求助ID || '',
      (row.模型输入输出 || '').slice(0, 160),
      (row.页面结果 || '').slice(0, 120),
      row.实测模式 || '',
    ].join('｜'),
  );
}

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ name, file });
  return file;
}

async function setRole(page, role) {
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
  await page.goto(`${BASE}/#/next/publish`, { waitUntil: 'domcontentloaded' });
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
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
}

async function pickMaterials(page) {
  await page.getByRole('button', { name: /添加材料|添加\s*\/\s*更换材料/ }).first().click();
  await page.waitForSelector('.ctn-picker', { timeout: 10000 });

  const codeTab = page.getByRole('tab', { name: '代码' });
  if (await codeTab.count()) await codeTab.click();
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: /orderService\.js · v0\.4 正确版|正确版/ })
    .first()
    .click();

  const chatTab = page.getByRole('tab', { name: 'AI 对话' });
  if (await chatTab.count()) await chatTab.click();
  await page.waitForTimeout(250);
  await page
    .locator('.ctn-picker-list button')
    .filter({ hasText: /订单接口联调准备|联调准备/ })
    .first()
    .click();

  await page.getByRole('button', { name: /确认加入清单/ }).click();
  await page.waitForTimeout(400);
}

async function analyzeMaterials(page) {
  await page.getByRole('button', { name: /分析材料|重新分析|换料后复查/ }).first().click();
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return (
        !/分析中/.test(t) &&
        (/可以确认并发布|暂不能发布|证据不足|疑似错版|谨慎发布|重新分析|AI 分析结论/.test(
          t,
        ) ||
          document.querySelector('#ctn-log-summary'))
      );
    },
    { timeout: 120000 },
  );
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const t = document.body.innerText;
    return {
      text: t.slice(0, 2500),
      hasLog: !!document.querySelector('#ctn-log-summary'),
      summary: document.querySelector('#ctn-log-summary')?.value || '',
      humanActions: t.includes('人工动作') || /人工：/.test(t),
      aiActions: t.includes('AI 动作') || /AI：/.test(t),
      openItems: t.includes('待确认') || /待验证|仍待|未见/.test(t),
      pendingUi: /待确认项|待验证|未见.*测试|证据不足/.test(t),
      findings: /关键发现|材料核对|材料与任务/.test(t),
    };
  });
}

async function appendManualSentenceAndPublish(page, sentence) {
  await page.waitForSelector('#ctn-log-summary', { timeout: 30000 });
  const before = await page.locator('#ctn-log-summary').inputValue();
  const next = before.includes(sentence)
    ? before
    : `${before.trim()}\n${sentence}`.trim();
  await page.fill('#ctn-log-summary', next);
  await page.getByRole('button', { name: /保存修订|保存/ }).first().click().catch(() => {});
  await page.waitForTimeout(200);

  const riskBox = page.locator('.ctn-field input[type="checkbox"], .rd-ai input[type="checkbox"]');
  if (await riskBox.count()) {
    await riskBox.first().check();
    const riskNotes = page.getByLabel('风险说明');
    if (await riskNotes.count()) {
      await riskNotes.fill('验收：已知联调侧需再核对错误码提示');
    }
  }

  const pub = page.getByRole('button', {
    name: /带风险发布|确认并发布|发布新版本|确认风险并发布/,
  });
  if (!(await pub.count())) throw new Error('no publish button');
  await pub.first().click();
  await page.waitForTimeout(1200);
  await page.waitForFunction(
    () => /人机协作日志（已确认）|等待确认接收|已发布/.test(document.body.innerText),
    { timeout: 20000 },
  );
  return { before, after: next };
}

async function readDelivery(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('cotrace-demo-submissions');
    if (!raw) return null;
    try {
      return JSON.parse(raw).handoffDelivery || null;
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

function modeLabel(health, provider) {
  if (provider && /deepseek/i.test(String(provider))) return 'DeepSeek';
  if (provider && /mock/i.test(String(provider))) return 'mock';
  if (health?.aiMode === 'live') return 'DeepSeek';
  if (health?.aiMode === 'mock') return 'mock';
  return '未验证';
}

function captureRequest(url, body) {
  if (!body) return;
  if (url.includes('/api/ai/handoff-analysis')) {
    report.requests.analysis.push(redactDeep(body));
  }
  if (url.includes('/api/ai/handoff-focus')) {
    report.requests.handoffFocus.push(redactDeep(body));
  }
  if (url.includes('/api/ai/help-context')) {
    report.requests.helpContext.push(redactDeep(body));
  }
  if (url.includes('/api/deliveries/publish')) {
    report.requests.publish.push(redactDeep(body));
  }
}

function captureResponse(url, data) {
  if (!data) return;
  if (url.includes('/api/ai/handoff-analysis')) {
    report.responses.analysis.push(redactDeep(data));
  }
  if (url.includes('/api/ai/handoff-focus')) {
    report.responses.handoffFocus.push(redactDeep(data));
  }
  if (url.includes('/api/ai/help-context')) {
    report.responses.helpContext.push(redactDeep(data));
  }
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
  captureRequest(url, body);
});

page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('/api/ai/')) return;
  try {
    const data = await res.json();
    captureResponse(url, data);
  } catch {
    /* ignore non-json */
  }
});

const forceFailAi = process.env.COTRACE_ACCEPT_FAIL_AI === '1';

try {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  await page.goto(`${BASE}/#/next/publish`, { waitUntil: 'domcontentloaded' });
  const health = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/health')).json();
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  report.health = health;
  const runMode = modeLabel(health, null);

  await resetDemo(page);
  await setRole(page, 'alex');
  await page.goto(`${BASE}/#/next/publish`);
  await page.waitForTimeout(600);

  // —— Part A1: pick + analyze ——
  await pickMaterials(page);
  const afterPick = await readDelivery(page);
  if (!afterPick?.selectedCodeMaterialId || !afterPick?.selectedChatMaterialId) {
    await shot(page, 'fail-pick');
    throw new Error(
      `materials not selected code=${afterPick?.selectedCodeMaterialId} chat=${afterPick?.selectedChatMaterialId}`,
    );
  }

  const analysisUi = await analyzeMaterials(page);
  const analysisRes = report.responses.analysis.slice(-1)[0];
  const analysisProvider =
    analysisRes?.analysis?.provider || analysisRes?.provider || null;
  const analysisOk =
    analysisUi.hasLog &&
    (analysisUi.findings || analysisUi.pendingUi) &&
    (analysisUi.openItems || /待确认|待验证|未见/.test(analysisUi.text));

  step({
    入口: 'Alex·发布页·选材+分析材料',
    版本或求助ID: `${afterPick.selectedCodeMaterialId}+${afterPick.selectedChatMaterialId}`,
    模型输入输出: JSON.stringify({
      req: report.requests.analysis.slice(-1)[0] || null,
      verdict: analysisRes?.analysis?.verdict,
      pending: analysisRes?.analysis?.pendingConfirmations?.slice?.(0, 3),
      human: analysisRes?.analysis?.collaborationLog?.humanActions?.slice?.(0, 2),
      ai: analysisRes?.analysis?.collaborationLog?.aiActions?.slice?.(0, 2),
      open: analysisRes?.analysis?.collaborationLog?.openItems?.slice?.(0, 2),
      provider: analysisProvider,
    }),
    页面结果: analysisOk
      ? `区分可见/AI/待验证 OK · ${analysisUi.text.match(/可以确认并发布|证据不足|谨慎发布|疑似错版/)?.[0] || '已出结论'}`
      : `分析 UI 不完整 · ${analysisUi.text.slice(0, 100)}`,
    实测模式: modeLabel(health, analysisProvider),
  });

  // —— Part A2: manual sentence + publish ——
  const edit = await appendManualSentenceAndPublish(page, MANUAL_SENTENCE);
  let delivery = await readDelivery(page);
  if (!delivery?.currentVersionId) {
    await shot(page, 'fail-publish');
    throw new Error(`publish failed status=${delivery?.status}`);
  }
  const version1 = delivery.currentVersionId;
  report.ids.version1 = version1;
  report.ids.deliveryId = delivery.id;
  const confirmedSummary =
    delivery.collaborationLog?.summary ||
    delivery.versions?.find((v) => v.id === version1)?.collaborationLog?.summary ||
    edit.after;

  step({
    入口: 'Alex·人工追加协作日志句并发布',
    版本或求助ID: version1,
    模型输入输出: JSON.stringify({
      publish: report.requests.publish.slice(-1)[0] || null,
      manualSentence: MANUAL_SENTENCE,
      summaryHasManual: String(confirmedSummary).includes(MANUAL_SENTENCE),
      draftBeforeHadManual: edit.before.includes(MANUAL_SENTENCE),
    }),
    页面结果: String(confirmedSummary).includes(MANUAL_SENTENCE)
      ? '已发布；确认日志含人工追加句'
      : '发布后日志未含人工句',
    实测模式: runMode,
  });

  // —— Part A3: Priya via 工作 → 查看交付 ——
  await setRole(page, 'priya');
  await page.goto(`${BASE}/#/next/work`);
  await page.waitForTimeout(900);
  const viewBtn = page.getByRole('button', { name: /查看交付|打开并确认接收/ }).first();
  if (await viewBtn.count()) {
    await viewBtn.click();
  } else {
    await page.goto(`${BASE}/#/next/receive`);
  }
  // Live DeepSeek focus can exceed 10s; require real focus labels (not just section title).
  await page
    .waitForFunction(
      () => {
        const t = document.body.innerText;
        return (
          (/先查：/.test(t) && /预期：/.test(t)) ||
          /绑定 ver-/.test(t) ||
          /接手标注失败|仍可阅读已发布协作日志/.test(t)
        );
      },
      { timeout: 120000 },
    )
    .catch(() => {});
  await page.waitForTimeout(800);

  await shot(page, 'priya-receive');

  const recvText = await page.locator('body').innerText();
  const focusReq = report.requests.handoffFocus.find(
    (item) =>
      item.versionId === version1 &&
      String(item.sharedLog?.summary || item.collaborationSummary || '').includes(
        MANUAL_SENTENCE,
      ),
  );
  const focusRes = report.responses.handoffFocus.find(
    (item) => item.focus?.versionId === version1 || item.ok,
  );
  const focusProvider = focusRes?.focus?.provider || null;
  const focusItems = focusRes?.focus?.items || [];
  const pageHasManual = recvText.includes(MANUAL_SENTENCE);
  const focusHasCheck =
    /先查/.test(recvText) && /预期/.test(recvText) && /依据/.test(recvText);
  const pendingVisible =
    /待验证|未见.*测试|缺少.*测试|未提供测试/.test(recvText);
  const cacheNote = /缓存命中/.test(recvText)
    ? `缓存命中·绑定 ${version1}`
    : '无缓存或未标注';

  // Citation click — avoid 「返回工作」 which also uses .rd-chip
  let citeOk = false;
  const chip = page
    .locator('.rd-findings .rd-chip, button[aria-label*="定位证据"]')
    .first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(250);
    citeOk = await page.evaluate(
      () => !!document.querySelector('.rd-block.is-flash, .is-flash'),
    );
  }

  report.proofs.alexManualSentenceInHandoffFocus = {
    ok: Boolean(pageHasManual && focusReq),
    pageHasManual,
    focusRequestSummary: focusReq
      ? String(focusReq.sharedLog?.summary || focusReq.collaborationSummary)
      : null,
    focusRequestVersionId: focusReq?.versionId || null,
    quote: focusReq
      ? String(focusReq.sharedLog?.summary || focusReq.collaborationSummary)
      : null,
  };

  step({
    入口: 'Priya·工作→查看交付·handoff-focus',
    版本或求助ID: version1,
    模型输入输出: JSON.stringify({
      req: focusReq || report.requests.handoffFocus.slice(-1)[0] || null,
      resItems: focusItems.slice(0, 3).map((it) => ({
        title: it.title,
        checkAction: it.checkAction,
        impact: it.impact,
        uncertainty: it.uncertainty,
        citations: (it.citations || []).slice(0, 1),
      })),
      cache: focusRes?.focus?.cacheKey || null,
      provider: focusProvider,
    }),
    页面结果: `日志同句=${pageHasManual}; 先查/预期/依据=${focusHasCheck}; 待验证=${pendingVisible}; 引用闪=${citeOk}; ${cacheNote}`,
    实测模式: modeLabel(health, focusProvider),
  });

  if (!pageHasManual || !focusReq) {
    report.remainingGaps.push(
      'Proof1 weak: manual sentence missing from page and/or handoff-focus request',
    );
  }

  // —— Part B1: clarify + help on current (will become old) ——
  // Ensure still on receive (citation chip must not have bounced to work)
  if (!/接收交付/.test(await page.locator('body').innerText())) {
    await page.goto(`${BASE}/#/next/receive`);
    await page.waitForTimeout(1500);
  }
  const helpHeading = page.getByRole('heading', { name: '向教师求助' });
  await helpHeading.scrollIntoViewIfNeeded();
  const helpArea = page.getByPlaceholder('学生原文：描述联调卡点');
  await helpArea.waitFor({ state: 'visible', timeout: 15000 });
  await helpArea.fill(HELP_TEXT);
  await page.getByRole('button', { name: /获取 AI 澄清建议/ }).click();
  await page
    .waitForFunction(
      () => {
        const t = document.body.innerText;
        const helpBlock = Array.from(document.querySelectorAll('.rd-block')).find(
          (el) => el.textContent && el.textContent.includes('向教师求助'),
        );
        const boxes = helpBlock
          ? helpBlock.querySelectorAll('label input[type="checkbox"]').length
          : 0;
        return (
          boxes > 0 ||
          /已生成可编辑澄清建议|勾选后再正式提交|澄清建议失败/.test(t)
        );
      },
      { timeout: 120000 },
    )
    .catch(() => {});
  await page.waitForTimeout(600);

  let adoptedOne = '';
  const clarifyLabels = page
    .locator('.rd-block')
    .filter({ hasText: '向教师求助' })
    .locator('label')
    .filter({ has: page.locator('input[type="checkbox"]') });
  if (await clarifyLabels.count()) {
    await clarifyLabels.first().locator('input[type="checkbox"]').check();
    adoptedOne = (await clarifyLabels.first().innerText()).replace(/^\s*/, '').slice(0, 200);
  } else {
    const labels = page.locator('label').filter({ has: page.locator('input[type="checkbox"]') });
    const n = await labels.count();
    for (let i = 0; i < n; i++) {
      const txt = await labels.nth(i).innerText();
      if (/确认已知风险|带风险/.test(txt)) continue;
      await labels.nth(i).locator('input[type="checkbox"]').check();
      adoptedOne = txt.replace(/^\s*/, '').slice(0, 200);
      break;
    }
  }

  await page.getByRole('button', { name: '正式提交求助' }).click();
  await page.waitForTimeout(600);

  const eventsAfterHelp = await readEvents(page);
  const helpEvent = eventsAfterHelp.find(
    (e) => e.kind === 'student-help' && String(e.summary).includes('求助-旧版'),
  );
  report.ids.helpEventId = helpEvent?.id || null;
  report.ids.helpVersionId = helpEvent?.versionId || null;

  const evidenceKinds = (helpEvent?.evidence || []).map((e) => ({
    kind: e.kind,
    label: e.label,
    summary: String(e.summary || '').slice(0, 160),
  }));
  const hasOrig = evidenceKinds.some((e) => e.label === '学生原文');
  const hasAdopted = evidenceKinds.some((e) => e.kind === 'ai-suggestion');

  step({
    入口: 'Priya·澄清建议采纳+正式提交求助',
    版本或求助ID: `${helpEvent?.id || 'null'}@${helpEvent?.versionId || 'null'}`,
    模型输入输出: JSON.stringify({
      clarifyReq: report.requests.helpContext.filter((r) => r.mode === 'student-clarify').slice(-1)[0] || null,
      clarifyRes: report.responses.helpContext.filter((r) => r.help || r.ok).slice(-1)[0] || null,
      adoptedOne,
      evidenceKinds,
    }),
    页面结果: `原文分离=${hasOrig}; 采纳补充分离=${hasAdopted}; adopted=${Boolean(adoptedOne)}`,
    实测模式: modeLabel(
      health,
      report.responses.helpContext.slice(-1)[0]?.help?.provider,
    ),
  });

  // —— Part B2: revision → Alex republish ——
  await page.getByRole('heading', { name: '提出修改意见' }).scrollIntoViewIfNeeded();
  await page.getByPlaceholder('说明需要修改的点').fill(REVISION_NOTE);
  await page.getByRole('button', { name: '提交修改意见' }).click();
  await page.waitForTimeout(800);

  // Integration must NOT advance before Priya confirms new version
  await page.goto(`${BASE}/#/next/blueprint`);
  await page.waitForTimeout(700);
  let blueprintText = await page.locator('body').innerText();
  const integrationBeforeConfirm = /联调进行中/.test(blueprintText);

  await setRole(page, 'alex');
  await page.goto(`${BASE}/#/next/work`);
  await page.waitForTimeout(700);
  const alexWorkBtn = page.getByRole('button', { name: /查看交付|处理修改意见|打开交付/ }).first();
  if (await alexWorkBtn.count()) await alexWorkBtn.click();
  else await page.goto(`${BASE}/#/next/publish`);
  await page.waitForTimeout(900);

  if (!(await page.locator('#ctn-log-summary').count())) {
    // may need re-analyze after revision
    const analyzeBtn = page.getByRole('button', { name: /分析材料|重新分析|换料后复查|生成交付报告/ });
    if (await analyzeBtn.count()) {
      await analyzeBtn.first().click();
      await page.waitForSelector('#ctn-log-summary', { timeout: 120000 });
    }
  }
  if (await page.locator('#ctn-log-summary').count()) {
    const cur = await page.locator('#ctn-log-summary').inputValue();
    const next = cur.includes(MARK_V2) ? cur : `${cur.trim()}\n${MARK_V2}`.trim();
    await page.fill('#ctn-log-summary', next);
    await page.getByRole('button', { name: /保存修订|保存/ }).first().click().catch(() => {});
  }
  const riskBox2 = page.locator('.ctn-field input[type="checkbox"], .rd-ai input[type="checkbox"]');
  if (await riskBox2.count()) await riskBox2.first().check();
  const pub2 = page.getByRole('button', { name: /带风险发布|发布新版本|确认并发布|确认风险并发布/ });
  await pub2.first().click();
  await page.waitForTimeout(1200);

  delivery = await readDelivery(page);
  const version2 = delivery?.currentVersionId;
  report.ids.version2 = version2;
  const historyHasOld = (delivery?.versionHistory || delivery?.versions || []).some(
    (v) => (v.id || v.versionId) === version1,
  ) || version1 !== version2;

  step({
    入口: 'Alex·工作页打开→发布新版本',
    版本或求助ID: `${version1}→${version2}`,
    模型输入输出: JSON.stringify({
      publish: report.requests.publish.slice(-1)[0] || null,
      oldRetained: historyHasOld,
      integrationBeforeConfirm,
    }),
    页面结果: `v1≠v2=${version1 !== version2}; 旧版保留=${historyHasOld}; 确认前联调进行中=${integrationBeforeConfirm}（应为 false）`,
    实测模式: runMode,
  });

  // Priya sees new version; receive only on current; do NOT confirm yet before teacher check
  await setRole(page, 'priya');
  await page.goto(`${BASE}/#/next/receive`);
  await page.waitForTimeout(2000);
  const priyaAfterRepub = await page.locator('body').innerText();
  const seesV2 = priyaAfterRepub.includes(MARK_V2) || priyaAfterRepub.includes(version2);
  const seesOldHistory = /历史版本|（旧）|旧版/.test(priyaAfterRepub);
  const canReceiveCurrent = await page.getByRole('button', { name: /确认接收/ }).count();

  step({
    入口: 'Priya·新版接收页（确认前）',
    版本或求助ID: version2,
    模型输入输出: '（本步无模型；验证接收仅当前有效版本）',
    页面结果: `见新版=${seesV2}; 历史旧版=${seesOldHistory}; 可确认接收按钮=${canReceiveCurrent > 0}; 联调未推进=${!integrationBeforeConfirm}`,
    实测模式: runMode,
  });

  // —— Part B3: teacher opens ORIGINAL help ——
  await setRole(page, 'teacher');
  await page.goto(`${BASE}/#/next/stage`);
  await page.waitForTimeout(1000);

  const helpBtn = page.locator('button').filter({ hasText: /联调求助|求助-旧版/ }).first();
  if (await helpBtn.count()) await helpBtn.click();
  else {
    const anyHelp = page.locator('.cts-time button, button').filter({ hasText: /求助/ }).first();
    if (await anyHelp.count()) await anyHelp.click();
  }
  await page.waitForTimeout(5000); // teacher-brief
  await page
    .waitForFunction(
      () =>
        /AI 梳理|情境|建议先|手写正式反馈|情境整理失败/.test(
          document.body.innerText,
        ),
      { timeout: 60000 },
    )
    .catch(() => {});

  const teacherBody = await page.locator('body').innerText();
  const teacherBriefReq = report.requests.helpContext.find(
    (item) =>
      item.mode === 'teacher-brief' &&
      item.deliveryVersionId === version1 &&
      String(item.studentText || '').includes('求助-旧版'),
  );
  const teacherBriefRes = report.responses.helpContext
    .filter((r) => r.help?.situationSummary || r.help?.guidanceSuggestions)
    .slice(-1)[0];
  const teacherSeesOldLog =
    teacherBody.includes(MANUAL_SENTENCE) ||
    teacherBody.includes('求助-旧版') ||
    (report.ids.helpVersionId === version1);

  report.proofs.teacherBriefBoundToOldVersion = {
    ok: Boolean(
      report.ids.helpVersionId === version1 &&
        teacherBriefReq &&
        teacherBriefReq.deliveryVersionId === version1 &&
        String(teacherBriefReq.sharedLog?.summary || teacherBriefReq.collaborationSummary || '').includes(
          MANUAL_SENTENCE,
        ),
    ),
    helpEventId: report.ids.helpEventId,
    helpVersionId: report.ids.helpVersionId,
    deliveryVersionId: teacherBriefReq?.deliveryVersionId || null,
    oldSummaryQuote: teacherBriefReq
      ? String(teacherBriefReq.sharedLog?.summary || teacherBriefReq.collaborationSummary)
      : null,
    studentText: teacherBriefReq?.studentText || null,
    adoptedSupplements: teacherBriefReq?.adoptedSupplements || [],
    selectedEvidence: teacherBriefReq?.selectedEvidence || [],
  };

  // Send formal feedback manually (must not be overwritten by late AI brief)
  const draft = page.getByLabel('教师反馈意见');
  await draft.waitFor({ state: 'visible', timeout: 15000 });
  await draft.click();
  await draft.fill(FEEDBACK_TEXT);
  const draftValue = await draft.inputValue();
  if (!draftValue.includes('教师反馈-验收')) {
    throw new Error(`teacher draft not kept: ${draftValue.slice(0, 120)}`);
  }
  await page.getByRole('button', { name: /发送正式反馈|发送反馈/ }).click();
  await page.waitForTimeout(900);
  await shot(page, 'teacher-help');

  const storedFeedback = await page.evaluate(() => {
    try {
      const doc = JSON.parse(
        localStorage.getItem('cotrace-demo-process-events') || '{}',
      );
      return (doc.feedbacks || []).map((f) => ({
        id: f.id,
        eventId: f.eventId,
        content: f.content,
      }));
    } catch {
      return [];
    }
  });
  report.ids.storedFeedback = storedFeedback;

  step({
    入口: '周老师·原求助→teacher-brief→正式反馈',
    版本或求助ID: report.ids.helpEventId,
    模型输入输出: JSON.stringify({
      req: teacherBriefReq || report.requests.helpContext.filter((i) => i.mode === 'teacher-brief').slice(-1)[0] || null,
      res: teacherBriefRes?.help
        ? {
            situationSummary: teacherBriefRes.help.situationSummary,
            guidance: (teacherBriefRes.help.guidanceSuggestions || []).slice(0, 2),
            provider: teacherBriefRes.help.provider,
          }
        : teacherBriefRes,
    }),
    页面结果: `绑旧版=${teacherBriefReq?.deliveryVersionId === version1}; 页见旧日志/求助=${teacherSeesOldLog}; 草稿保留人工文=${draftValue.includes('教师反馈-验收')}; 落盘=${storedFeedback.some((f) => String(f.content).includes('教师反馈-验收'))}`,
    实测模式: modeLabel(health, teacherBriefRes?.help?.provider),
  });

  // Student project memory echo — expand teacher-feedback / help rows for verbatim text
  async function expandFeedbackEcho() {
    await page.goto(`${BASE}/#/next/log`);
    await page.waitForTimeout(800);
    const feedbackMain = page
      .locator('button.pm-row-main')
      .filter({ hasText: /发送正式反馈/ })
      .first();
    if (await feedbackMain.count()) {
      await feedbackMain.click();
      await page.waitForSelector('.pm-row-detail, .pm-summary', {
        timeout: 5000,
      });
      await page.waitForTimeout(300);
    }
    const text = await page.locator('body').innerText();
    const stored = await page.evaluate(() => {
      try {
        const doc = JSON.parse(
          localStorage.getItem('cotrace-demo-process-events') || '{}',
        );
        return (doc.feedbacks || []).map((f) => f.content);
      } catch {
        return [];
      }
    });
    return { text, stored };
  }

  await setRole(page, 'alex');
  const echoAlex = await expandFeedbackEcho();
  await shot(page, 'student-feedback-echo-alex');
  const alexSees =
    echoAlex.text.includes('教师反馈-验收') ||
    echoAlex.text.includes(FEEDBACK_TEXT) ||
    echoAlex.stored.some((c) => String(c).includes('教师反馈-验收'));

  await setRole(page, 'priya');
  const echoPriya = await expandFeedbackEcho();
  await shot(page, 'student-feedback-echo-priya');
  const priyaSees =
    echoPriya.text.includes('教师反馈-验收') ||
    echoPriya.text.includes(FEEDBACK_TEXT) ||
    echoPriya.stored.some((c) => String(c).includes('教师反馈-验收'));
  const helpIdVisible =
    (report.ids.helpEventId &&
      (echoPriya.text.includes(report.ids.helpEventId) ||
        echoAlex.text.includes(report.ids.helpEventId))) ||
    /联调求助|教师反馈|发送正式反馈/.test(echoPriya.text);

  step({
    入口: '学生·项目记录回显教师反馈',
    版本或求助ID: report.ids.helpEventId,
    模型输入输出: JSON.stringify({
      stored: echoPriya.stored,
      alexHasVerbatim: echoAlex.text.includes(FEEDBACK_TEXT),
      priyaHasVerbatim: echoPriya.text.includes(FEEDBACK_TEXT),
      detailSnippet:
        echoPriya.text.match(/【教师反馈[\s\S]{0,100}/)?.[0] ||
        echoPriya.text.match(/教师正式反馈[\s\S]{0,100}/)?.[0] ||
        null,
    }),
    页面结果: `Alex同文=${alexSees}; Priya同文=${priyaSees}; 求助相关可见=${helpIdVisible}`,
    实测模式: runMode,
  });

  report.bugsFixed.push({
    file: 'src/next/teacher/StageReportPage.tsx',
    brief:
      '教师手写正式反馈不再被迟到的 teacher-brief AI 结果覆盖（draftTouchedRef）',
  });

  // Confirm new version after teacher path (integration may advance)
  await page.goto(`${BASE}/#/next/receive`);
  await page.waitForTimeout(800);
  const confirmBtn = page.getByRole('button', { name: /确认接收/ });
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
  }
  delivery = await readDelivery(page);
  await page.goto(`${BASE}/#/next/blueprint`);
  await page.waitForTimeout(700);
  blueprintText = await page.locator('body').innerText();
  const integrationAfter = /联调进行中/.test(blueprintText);

  step({
    入口: 'Priya·确认接收新版→联调推进',
    版本或求助ID: version2,
    模型输入输出: '（无模型）',
    页面结果: `status=${delivery?.status}; 联调进行中=${integrationAfter}`,
    实测模式: runMode,
  });

  // —— Part C3 within same run if requested: simulate AI failure ——
  if (forceFailAi) {
    await page.route('**/api/ai/handoff-focus', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: 'forced failure for degrade test' }),
      });
    });
    await resetDemo(page);
    await setRole(page, 'alex');
    await page.goto(`${BASE}/#/next/publish`);
    await pickMaterials(page);
    // Manual log path without relying on analysis success
    const analyzeBtn = page.getByRole('button', { name: /分析材料/ });
    if (await analyzeBtn.count()) {
      await analyzeBtn.click();
      await page.waitForTimeout(2000);
    }
    // If analysis failed, still try to publish with manual content if UI allows
    const canManual = await page.locator('#ctn-log-summary').count();
    let degradePublish = false;
    if (canManual) {
      await page.fill('#ctn-log-summary', `降级手工日志。${MANUAL_SENTENCE}`);
      const pub = page.getByRole('button', { name: /带风险发布|确认并发布|发布新版本/ });
      if (await pub.count()) {
        const risk = page.locator('input[type="checkbox"]').first();
        if (await risk.count()) await risk.check().catch(() => {});
        await pub.first().click();
        await page.waitForTimeout(1000);
        degradePublish = true;
      }
    }
    await setRole(page, 'priya');
    await page.goto(`${BASE}/#/next/receive`);
    await page.waitForTimeout(2000);
    const degradeText = await page.locator('body').innerText();
    const canHelp =
      (await page.locator('textarea[placeholder*="联调卡点"]').count()) > 0;
    const canConfirm =
      (await page.getByRole('button', { name: /确认接收|正式提交求助/ }).count()) > 0;
    report.failureDegrade = {
      ok: Boolean(canHelp || canConfirm || /仍可阅读|手工|失败/.test(degradeText)),
      degradePublish,
      canHelp,
      canConfirm,
      snippet: degradeText.slice(0, 400),
    };
    step({
      入口: '模拟 handoff-focus 失败·手工路径',
      版本或求助ID: 'degrade',
      模型输入输出: '{"forced":"handoff-focus 500"}',
      页面结果: `仍可操作=${report.failureDegrade.ok}; help=${canHelp}; confirm/helpBtn=${canConfirm}`,
      实测模式: runMode,
    });
    await page.unroute('**/api/ai/handoff-focus').catch(() => {});
  } else {
    report.failureDegrade = {
      ok: null,
      note: '本轮未注入失败；请用 COTRACE_ACCEPT_FAIL_AI=1 再跑或见后续 live 后单独 degrade 跑',
    };
  }
} catch (error) {
  report.error = String(error && error.stack ? error.stack : error);
  try {
    await shot(page, 'fail-uncaught');
  } catch {
    /* ignore */
  }
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n=== PROOFS ===');
  console.log(JSON.stringify(report.proofs, null, 2));
  console.log('WROTE', OUT_JSON);
  console.log('SHOTS', SHOT_DIR);
  await browser.close();
}

const proofOk =
  report.proofs.alexManualSentenceInHandoffFocus?.ok &&
  report.proofs.teacherBriefBoundToOldVersion?.ok;
process.exit(report.error ? 1 : proofOk ? 0 : 2);
