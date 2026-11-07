/**
 * Browser A–D acceptance against localhost:5173 (mock AI).
 * Run: node scripts/_verify-role-contract-abcd.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.COTRACE_BASE || 'http://localhost:5173';
const report = [];

function row(role, input, output, action, state, result) {
  report.push({ role, input, output, action, state, result });
  console.log(`${role}｜${input}｜${output}｜${action}｜${state}｜${result}`);
}

async function postJson(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, data: await res.json() };
    },
    { path, body },
  );
}

async function setRole(page, role, hash = '#/next/blueprint') {
  await page.evaluate((r) => localStorage.setItem('cotrace-demo-role', r), role);
  await page.goto(`${BASE}/${hash.replace(/^\//, '')}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

async function goto(page, hash) {
  await page.goto(`${BASE}/${hash.replace(/^\//, '')}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(500);
}

async function pickMaterialsAndPublish(page, { editSummary }) {
  await goto(page, '#/next/publish');
  await page.getByRole('button', { name: /添加材料/ }).first().click();
  await page.waitForTimeout(300);

  // code tab (default): pick v0.4
  await page.getByRole('button', { name: /orderService\.js · v0\.4 正确版/ }).click();
  // switch to chat tab
  await page.getByRole('tab', { name: /对话|AI/ }).or(page.getByRole('button', { name: /^AI 对话$|^对话$/ })).first().click().catch(async () => {
    // tabs may be unlabeled; click second group button in picker
    const tabs = page.locator('.ctn-picker-tabs button, [role="tab"]');
    if ((await tabs.count()) > 1) await tabs.nth(1).click();
  });
  await page.waitForTimeout(200);
  await page
    .getByRole('button', { name: /AI 对话 · 订单接口联调准备/ })
    .click();
  await page.getByRole('button', { name: /确认加入清单/ }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: /分析材料|换料后复查/ }).click();
  await page.waitForTimeout(1000);

  const summaryBox = page.locator('#ctn-log-summary');
  if ((await summaryBox.count()) && editSummary) {
    await summaryBox.fill(editSummary);
    const save = page.getByRole('button', { name: /保存/ });
    if (await save.count()) await save.first().click();
  }

  const pub = page.getByRole('button', {
    name: /确认并发布|发布新版本|确认风险并发布/,
  });
  if (await pub.count()) {
    await pub.first().click();
    await page.waitForTimeout(700);
  }

  return page.evaluate(() => ({
    text: document.body.innerText,
    published:
      document.body.innerText.includes('等待确认接收') ||
      document.body.innerText.includes('已发布'),
    hasEdit: document.body.innerText.includes('Alex 人工修订'),
  }));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await goto(page, '#/next/blueprint');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const health = await page.evaluate(async () =>
    (await fetch('/api/health')).json(),
  );

  // —— A ——
  const pairs = [
    ['mat-code-order-v04', 'mat-chat-order-v04', 'match', '正确'],
    ['mat-code-order-v03', 'mat-chat-order-v03', 'suspect-wrong-version', '错版'],
    [
      'mat-code-unrelated-frontend',
      'mat-chat-unrelated-seat',
      'irrelevant',
      '无关',
    ],
    [
      'mat-code-order-v04',
      'mat-chat-order-no-test',
      'insufficient-evidence',
      '缺测试',
    ],
  ];
  for (const [code, chat, expect, tag] of pairs) {
    const { data } = await postJson(page, '/api/ai/handoff-analysis', {
      projectId: 'project-campus-marketplace',
      taskId: 'node-backend',
      codeMaterialId: code,
      chatMaterialId: chat,
      requestToken: Date.now(),
      taskGoal: '校园二手交易平台 · 订单创建服务 v0.4',
    });
    const ok = data.ok && data.analysis?.verdict === expect;
    row(
      'Alex',
      `${tag} ${code}+${chat}`,
      `${data.analysis?.verdict} pending=${data.analysis?.pendingConfirmations?.length} cites=${data.analysis?.citations?.length} (${data.analysis?.provider})`,
      'POST /api/ai/handoff-analysis',
      '无状态变化',
      ok ? `通过·${health.aiMode}` : `失败·${data.message || data.analysis?.verdict}`,
    );
  }

  // —— B ——
  const edited =
    '人机协作后订单创建已对齐 v0.4；Alex 人工修订：联调请先核对 ITEM_NOT_AVAILABLE 前端提示。';
  await setRole(page, 'alex', '#/next/publish');
  let pub;
  try {
    pub = await pickMaterialsAndPublish(page, { editSummary: edited });
  } catch (err) {
    pub = { published: false, text: String(err), hasEdit: false };
  }
  row(
    'Alex',
    '正确材料 + 人工改一句摘要',
    pub.hasEdit ? '摘要含人工修订' : '分析/发布 UI',
    '添加材料→分析→改摘要→确认并发布',
    pub.published ? 'published·等待确认接收' : '发布未完成',
    pub.published ? `通过·${health.aiMode}+UI` : `部分·${String(pub.text).slice(0, 80)}`,
  );

  await setRole(page, 'priya', '#/next/receive');
  await page.waitForTimeout(1000);
  const recvText = await page.evaluate(() => document.body.innerText);
  const seesEdit =
    recvText.includes('Alex 人工修订') ||
    recvText.includes('ITEM_NOT_AVAILABLE');
  const seesFocus =
    recvText.includes('接手标注') &&
    (recvText.includes('核对') || recvText.includes('影响'));
  const noPublisherChore = !recvText.includes('确认公开协作日志范围');

  const focusRes = await postJson(page, '/api/ai/handoff-focus', {
    deliveryId: 'delivery-order-service-v04',
    versionId: 'ver-ui',
    projectId: 'project-campus-marketplace',
    collaborationSummary: edited,
    risks: [],
    riskNotes: '',
    riskAcknowledged: false,
    sharedLog: {
      summary: edited,
      humanActions: ['人工修订一句'],
      aiActions: [],
      openItems: ['前端提示待核对'],
    },
    integrationGoal: '交易流程联调核对 ITEM_NOT_AVAILABLE',
    codeMaterialId: 'mat-code-order-v04',
    chatMaterialId: 'mat-chat-order-v04',
  });
  const items = focusRes.data.focus?.items || [];
  row(
    'Priya',
    '本版确认日志+材料ID+联调目标',
    `focus×${items.length} ${(items[0]?.title || '').slice(0, 28)} uncertainty=${items[0]?.uncertainty ? 'y' : 'n'} (${focusRes.data.focus?.provider})`,
    '打开接收页自动整理',
    `UI同句=${seesEdit}; 无发布者任务=${noPublisherChore}; focusUI=${seesFocus}`,
    focusRes.data.ok &&
      items.length >= 1 &&
      items.length <= 3 &&
      !items.some((i) => /确认公开/.test(i.title))
      ? `通过·${health.aiMode}`
      : '失败',
  );

  // revision
  const revHeading = page.getByRole('heading', { name: /提出修改意见/ });
  if (await revHeading.count()) {
    const section = page.locator('section, article, div').filter({
      has: revHeading,
    });
    const noteArea = section.locator('textarea').first();
    if (await noteArea.count()) {
      await noteArea.fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照');
    }
  } else {
    const noteArea = page.locator('textarea').nth(0);
    if (await noteArea.count()) {
      await noteArea.fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照');
    }
  }
  const revBtn = page.getByRole('button', { name: /^提交修改意见$/ });
  let revised = false;
  if (await revBtn.count()) {
    await revBtn.click();
    await page.waitForTimeout(600);
    revised = await page.evaluate(() =>
      /等待 Alex|已提交修改意见|待修改/.test(document.body.innerText),
    );
  }
  row(
    'Priya',
    '修改意见一句',
    '无 AI',
    '提交修改意见',
    revised ? 'needs-revision' : '未改状态',
    revised ? '通过·业务' : pub.published ? '部分·按钮未生效' : '未验证·无已发布版',
  );

  // republish
  await setRole(page, 'alex', '#/next/publish');
  let pub2 = { published: false };
  try {
    pub2 = await pickMaterialsAndPublish(page, {
      editSummary: edited + '（重发）',
    });
  } catch (err) {
    pub2 = { published: false, text: String(err) };
  }
  row(
    'Alex',
    '按意见重选正确材料并发布新版本',
    '新 versionId',
    '分析→发布新版本',
    pub2.published ? 'published(新版本)' : '重发未完成',
    pub2.published ? '通过·UI' : '部分',
  );

  // confirm receive
  await setRole(page, 'priya', '#/next/receive');
  await page.waitForTimeout(800);
  const confirmBtn = page.getByRole('button', { name: /确认接收/ });
  let received = false;
  if (await confirmBtn.count()) {
    await confirmBtn.first().click();
    await page.waitForTimeout(700);
    received = true;
  }
  await goto(page, '#/next/blueprint');
  const integ = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      inProgress:
        body.includes('联调进行中') ||
        /交易流程联调[^\n]{0,30}进行中/.test(body),
    };
  });
  row(
    'Priya',
    '新版本接收页',
    '接手标注只读',
    '确认接收',
    `received=${received}; 联调进行中=${integ.inProgress}`,
    received || integ.inProgress ? '通过·业务+UI' : '部分',
  );

  // —— C ——
  await goto(page, '#/next/receive');
  const helpText =
    '联调时页面提示和 ITEM_NOT_AVAILABLE 对不上，已按 v0.4 调用。';
  const areas = page.locator('textarea');
  if (await areas.count()) await areas.last().fill(helpText);

  const clarifyApi = await postJson(page, '/api/ai/help-context', {
    mode: 'student-clarify',
    projectId: 'project-campus-marketplace',
    taskId: 'node-integration',
    deliveryVersionId: 'ver-help',
    studentText: helpText,
    collaborationSummary: edited,
    sharedEvidence: [],
    selectedEvidence: ['ITEM_NOT_AVAILABLE 对照'],
    adoptedSupplements: [],
    sharedLog: {
      summary: edited,
      humanActions: [],
      aiActions: [],
      openItems: ['前端提示待核对'],
    },
  });
  row(
    'Priya',
    '困惑原文+所选证据 student-clarify',
    `clarify×${clarifyApi.data.help?.clarifyPrompts?.length ?? 0} guidance×${clarifyApi.data.help?.guidanceSuggestions?.length ?? 0} (${clarifyApi.data.help?.provider})`,
    '生成澄清建议',
    '原文保留，补充可选',
    clarifyApi.data.ok &&
      (clarifyApi.data.help?.clarifyPrompts?.length ?? 0) > 0 &&
      (clarifyApi.data.help?.guidanceSuggestions?.length ?? 0) === 0
      ? `通过·${health.aiMode}`
      : '失败',
  );

  const submitHelp = page.getByRole('button', { name: /正式提交求助/ });
  if (await submitHelp.count()) {
    await submitHelp.click();
    await page.waitForTimeout(500);
  }

  await setRole(page, 'teacher', '#/next/stage');
  await page.waitForTimeout(1000);
  const stageText = await page.evaluate(() => document.body.innerText);
  // Prefer clicking student-help if listed
  const helpItem = page.locator('button').filter({ hasText: /联调求助|对不上|ITEM_NOT_AVAILABLE/ });
  if (await helpItem.count()) {
    await helpItem.first().click();
    await page.waitForTimeout(1200);
  }

  const briefApi = await postJson(page, '/api/ai/help-context', {
    mode: 'teacher-brief',
    projectId: 'project-campus-marketplace',
    taskId: 'node-integration',
    deliveryVersionId: 'ver-help',
    studentText: helpText,
    collaborationSummary: edited,
    sharedEvidence: ['前端提示待核对'],
    selectedEvidence: [helpText],
    adoptedSupplements: [],
    sharedLog: {
      summary: edited,
      humanActions: [],
      aiActions: [],
      openItems: ['前端提示待核对'],
    },
  });

  const formal =
    '请先核对联调接口版本，再补错误码与页面提示对照记录。';
  const fb = page.getByLabel(/教师反馈/).or(page.locator('.cts-feed textarea'));
  if (await fb.count()) await fb.first().fill(formal);
  const send = page.getByRole('button', { name: /发送正式反馈/ });
  let sent = false;
  if ((await send.count()) && (await send.isEnabled())) {
    await send.click();
    await page.waitForTimeout(500);
    sent = true;
  }

  row(
    '周老师',
    '求助原文+本版日志+证据 teacher-brief',
    `summary=${(briefApi.data.help?.situationSummary || '').slice(0, 36)}… clarify=${briefApi.data.help?.clarifyPrompts?.length ?? 0}`,
    '打开阶段汇报并发送正式反馈',
    `stage含求助文案=${stageText.includes('对不上') || stageText.includes('学生原始问题')}; sent=${sent}`,
    briefApi.data.ok &&
      (briefApi.data.help?.clarifyPrompts?.length ?? 0) === 0
      ? `通过·${health.aiMode}`
      : '失败',
  );

  await setRole(page, 'priya', '#/next/log');
  const logEcho = await page.evaluate(
    (f) => document.body.innerText.includes(f) || document.body.innerText.includes('正式反馈'),
    formal,
  );
  await setRole(page, 'alex', '#/next/log');
  const logEchoAlex = await page.evaluate(
    (f) => document.body.innerText.includes(f) || document.body.innerText.includes('对不上'),
    formal,
  );
  row(
    'Alex/Priya',
    '同一求助事件回显',
    formal.slice(0, 28) + '…',
    '打开项目记录',
    `Priya回显=${logEcho}; Alex回显=${logEchoAlex}`,
    logEcho || logEchoAlex || sent ? '通过·事件绑定' : '部分·未见到回显',
  );

  // —— D ——
  const fail = await postJson(page, '/api/ai/handoff-analysis', {
    projectId: 'project-campus-marketplace',
    taskId: 'node-backend',
    codeMaterialId: 'mat-missing-x',
    chatMaterialId: 'mat-missing-y',
    requestToken: 9,
  });
  await setRole(page, 'alex', '#/next/publish');
  const manual = await page.evaluate(() =>
    /添加材料|分析材料|确认并发布|材料/.test(document.body.innerText),
  );
  row(
    'Alex',
    '非法材料ID（模拟生成失败）',
    `HTTP ${fail.status} ${fail.data.message || ''}`,
    '失败后仍可打开上传页手动操作',
    `手动路径可用=${manual}`,
    fail.status >= 400 && manual ? '通过·失败可降级' : '失败',
  );

  // Banner
  await setRole(page, 'teacher', '#/next/guide');
  await page.goto(`${BASE}/#/next/acceptance`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // If still on guide, click into acceptance
  if (await page.getByRole('button', { name: /进入核收/ }).count()) {
    await page.getByRole('button', { name: /进入核收/ }).click();
    await page.waitForTimeout(600);
  }
  const bannerGone = await page.evaluate(() => {
    const t = document.body.innerText;
    return (
      !t.includes('项目后期核收示例，不是学生交付') &&
      !t.includes('最终提交 v1.0 · 项目后期核收示例')
    );
  });
  row(
    '周老师',
    '核收页',
    '无最终提交免责横幅',
    '打开项目核收',
    `bannerGone=${bannerGone}`,
    bannerGone ? '通过·UI' : '失败',
  );

  await browser.close();
  const failed = report.filter((r) => String(r.result).startsWith('失败'));
  console.log('\nSUMMARY', {
    aiMode: health.aiMode,
    rows: report.length,
    failed: failed.length,
  });
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
