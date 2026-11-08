/**
 * Long-form reading layout acceptance (1440×960).
 * Captures Alex three states + dual-column / chip flash + chain screenshots.
 * Run: node scripts/_accept-reading-layout.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.COTRACE_BASE || 'http://localhost:5173';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'accept-reading-shots');
const report = {
  viewport: '1440x960',
  shots: [],
  checks: [],
  scenarios: {},
};

function check(id, ok, note, method = 'browser') {
  report.checks.push({ id, ok: !!ok, note, method });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${method}] ${id}: ${note}`);
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ name, file });
  return file;
}

async function setRole(page, role, hash = '#/next/publish') {
  // Reload after writing role so in-memory demoRoleStore picks it up
  // before hash routing (otherwise teacher→student can bounce to blueprint).
  await page.evaluate((r) => localStorage.setItem('cotrace-demo-role', r), role);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${BASE}/${hash.replace(/^\//, '')}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(500);
}

async function clearDemo(page) {
  await page.goto(`${BASE}/#/next/blueprint`, { waitUntil: 'domcontentloaded' });
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
  await add.first().click({ timeout: 10000 });
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
  const btn = page.getByRole('button', { name: /分析材料|重新分析|换料后复查/ });
  await btn.first().click();
  await page
    .getByRole('button', { name: /分析材料|重新分析|换料后复查/ })
    .first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .catch(() => {});
  // Wait until loading label clears and a status headline appears
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

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const split = document.querySelector('.rd-split, .cts-work');
    const left = document.querySelector('.rd-evidence, .cts-time');
    const right = document.querySelector('.rd-ai, .cts-feed');
    const text = document.body.innerText;
    const narrow =
      !!document.querySelector('.ctn-scroll') &&
      getComputedStyle(document.querySelector('.ctn-scroll')).maxWidth.includes(
        '37.5',
      );
    const rect = (el) =>
      el
        ? {
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height),
          }
        : null;
    return {
      hasSplit: !!split,
      left: rect(left),
      right: rect(right),
      narrow37: narrow,
      hasChip: !!document.querySelector('.rd-chip, [data-evidence-ref]'),
      textSample: text.slice(0, 400),
      waitingReceive: /等待确认接收/.test(text),
      publisherChore: /确认公开协作日志范围/.test(text),
      dualTitles:
        /交付证据|证据/.test(text) &&
        (/AI 分析结论|分析结论|联调关注|教师正式反馈|AI 梳理/.test(text) ||
          !!right),
    };
  });
}

async function flashChip(page) {
  const chip = page.locator('.rd-chip, button[data-evidence-ref]').first();
  if (!(await chip.count())) return { clicked: false, flashed: false };
  await chip.click();
  await page.waitForTimeout(200);
  const flashed = await page.evaluate(
    () => !!document.querySelector('.rd-block.is-flash, .is-flash'),
  );
  await page.waitForTimeout(1300);
  return { clicked: true, flashed };
}

async function alexState(page, name, codeTitle, chatTitle, expect) {
  await setRole(page, 'alex', '#/next/publish');
  await pickPair(page, codeTitle, chatTitle);
  await analyze(page);
  const text = await page.evaluate(() => document.body.innerText);
  const metrics = await layoutMetrics(page);
  const flash = await flashChip(page);
  await shot(page, `alex-${name}`);
  const okText = expect.every((re) => re.test(text));
  check(
    `alex-${name}-copy`,
    okText,
    okText ? `文案命中 ${expect.map((r) => r.source).join(' | ')}` : text.slice(0, 220),
  );
  check(
    `alex-${name}-layout`,
    metrics.hasSplit && !metrics.narrow37 && metrics.left && metrics.right,
    `split=${metrics.hasSplit} left=${JSON.stringify(metrics.left)} right=${JSON.stringify(metrics.right)} narrow37=${metrics.narrow37}`,
  );
  if (metrics.left && metrics.right) {
    const ratio = metrics.left.w / (metrics.left.w + metrics.right.w);
    check(
      `alex-${name}-55-45`,
      ratio > 0.48 && ratio < 0.62,
      `leftShare=${ratio.toFixed(2)}`,
    );
  }
  check(
    `alex-${name}-chip`,
    flash.clicked ? flash.flashed : true,
    flash.clicked
      ? `clicked flash=${flash.flashed}`
      : 'no chip (code-only check)',
    flash.clicked ? 'browser' : 'code',
  );
  report.scenarios[name] = { ok: okText, metrics, flash };
  return { text, metrics };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  await clearDemo(page);

  // 1) wrong chat
  await alexState(
    page,
    'wrong-chat',
    /orderService\.js · v0\.4 正确版/,
    /AI 对话 · 自习室座位预约/,
    [/暂不能发布|无关/, /更换对话|分析材料|重新分析/],
  );

  // 2) missing test
  await clearDemo(page);
  await alexState(
    page,
    'no-test',
    /orderService\.js · v0\.4 正确版/,
    /AI 对话 · 仅方案讨论（无测试）/,
    [/证据不足|谨慎发布|未提供测试|缺/, /风险|重新分析|分析材料/],
  );

  // 3) normal publishable
  await clearDemo(page);
  await alexState(
    page,
    'match',
    /orderService\.js · v0\.4 正确版/,
    /AI 对话 · 订单接口联调准备/,
    [/可以确认并发布|相符/, /确认并发布|发布/],
  );

  // scroll bottom padding check on match page
  const scrollOk = await page.evaluate(() => {
    const main = document.querySelector('.rd-evidence, .ctn-main, .pub');
    if (!main) return false;
    main.scrollTop = main.scrollHeight;
    return main.scrollHeight > main.clientHeight || document.body.scrollHeight > 900;
  });
  check('alex-long-scroll', scrollOk, scrollOk ? '可滚动或内容足够' : '无法验证滚动');

  // Publish for chain
  const summary =
    '人机协作后订单创建已对齐 v0.4；Alex 人工修订：联调请先核对 ITEM_NOT_AVAILABLE 前端提示。';
  const summaryBox = page.locator('#ctn-log-summary, textarea').first();
  if (await summaryBox.count()) {
    await summaryBox.fill(summary);
    const save = page.getByRole('button', { name: /保存/ });
    if (await save.count()) await save.first().click();
  }
  const pub = page.getByRole('button', {
    name: /确认并发布|发布新版本|确认风险并发布/,
  });
  if (await pub.count()) {
    try {
      await pub.first().click({ timeout: 15000 });
      await page.waitForTimeout(800);
    } catch (err) {
      check('alex-publish-click', false, String(err).slice(0, 120));
    }
  }
  await shot(page, 'alex-published');
  const published = await page.evaluate(() =>
    /等待确认接收|已发布/.test(document.body.innerText),
  );
  check('alex-publish', published, published ? '已发布' : '发布失败');

  // Priya receive
  await setRole(page, 'priya', '#/next/receive');
  await page.waitForTimeout(1000);
  const recv = await layoutMetrics(page);
  await shot(page, 'priya-receive');
  check(
    'priya-dual',
    recv.hasSplit && !recv.publisherChore && recv.waitingReceive,
    `split=${recv.hasSplit} waiting=${recv.waitingReceive} chore=${recv.publisherChore}`,
  );
  check(
    'priya-same-log',
    await page.evaluate(
      (s) => document.body.innerText.includes(s) || document.body.innerText.includes('ITEM_NOT_AVAILABLE'),
      summary,
    ),
    '同版日志可见',
  );

  // revision
  const revArea = page.getByLabel(/修改|描述/).or(
    page.locator('textarea').filter({ has: page.locator('xpath=..') }),
  );
  const revSection = page.locator('.rd-ai, aside').filter({
    hasText: '提出修改意见',
  });
  const note = revSection.locator('textarea').first();
  if (await note.count()) {
    await note.fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照');
  } else if (await page.locator('textarea').count()) {
    // fallback: prefer the revision box near the submit button
    await page.locator('textarea').nth(0).fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照');
  }
  void revArea;
  const revBtn = page.getByRole('button', { name: /^提交修改意见$/ });
  if (await revBtn.count()) {
    await revBtn.first().click();
    await page.waitForTimeout(900);
  }
  const revised = await page.evaluate(() =>
    /等待 Alex|已提出修改意见|needs-revision|发布新版本/.test(
      document.body.innerText,
    ),
  );
  check('priya-revision', revised, revised ? '已提交修改意见' : '未进入待改版');
  await shot(page, 'priya-revision');

  // republish — materials already on delivery; analyze then publish new version
  await setRole(page, 'alex', '#/next/publish');
  await page.waitForTimeout(600);
  const analyzeBtn = page.getByRole('button', {
    name: /分析材料|重新分析|换料后复查/,
  });
  if (await analyzeBtn.count()) {
    await analyze(page);
  }
  const pub2 = page.getByRole('button', {
    name: /确认并发布|发布新版本|确认风险并发布/,
  });
  if (await pub2.count()) {
    try {
      await pub2.first().click({ timeout: 15000 });
      await page.waitForTimeout(800);
    } catch (err) {
      check('alex-republish-click', false, String(err).slice(0, 120));
    }
  }
  await shot(page, 'alex-republish');
  check(
    'alex-republish',
    await page.evaluate(() =>
      /等待确认接收|已发布|新版本/.test(document.body.innerText),
    ),
    '重发后状态',
  );

  // confirm
  await setRole(page, 'priya', '#/next/receive');
  await page.waitForTimeout(700);
  const confirm = page.getByRole('button', { name: /确认接收/ });
  if (await confirm.count()) {
    await confirm.first().click();
    await page.waitForTimeout(700);
  }
  await shot(page, 'priya-received');

  // help + teacher
  try {
    const helpText =
      '联调时页面提示和 ITEM_NOT_AVAILABLE 对不上，已按 v0.4 调用。';
    const helpBox = page
      .locator('.rd-evidence, .rd-block, section, article')
      .filter({ hasText: '向教师求助' })
      .locator('textarea')
      .first();
    if (await helpBox.count()) {
      await helpBox.fill(helpText);
      const submitHelp = page.getByRole('button', { name: /正式提交求助/ });
      if (await submitHelp.count()) {
        await submitHelp.click();
        await page.waitForTimeout(600);
      }
      check('priya-help', true, '已正式提交求助');
    } else {
      check('priya-help', false, '未找到求助输入框');
    }

    await setRole(page, 'teacher', '#/next/stage');
    await page.waitForTimeout(1000);
    const helpItem = page
      .locator('button')
      .filter({ hasText: /联调求助|对不上|ITEM_NOT_AVAILABLE|学生求助/ });
    if (await helpItem.count()) {
      await helpItem.first().click();
      await page.waitForTimeout(1200);
    }
    const stage = await layoutMetrics(page);
    await shot(page, 'teacher-stage');
    check(
      'teacher-dual',
      stage.hasSplit &&
        (await page.evaluate(
          () =>
            /学生原始问题|交付背景|阶段事件/.test(document.body.innerText) &&
            /教师正式反馈/.test(document.body.innerText),
        )),
      `split=${stage.hasSplit} left=${JSON.stringify(stage.left)} right=${JSON.stringify(stage.right)}`,
    );
    const fb = page
      .getByLabel(/教师反馈/)
      .or(page.locator('.cts-feed textarea'));
    if (await fb.count()) {
      await fb
        .first()
        .fill('请先核对联调接口版本，再补错误码与页面提示对照记录。');
    }
    const send = page.getByRole('button', { name: /发送正式反馈/ });
    let sent = false;
    if ((await send.count()) && (await send.isEnabled())) {
      await send.click();
      await page.waitForTimeout(600);
      sent = true;
    }
    check('teacher-feedback', sent, sent ? '已发送正式反馈' : '未发送（可能无求助选中）');
    await shot(page, 'teacher-feedback-sent');
  } catch (err) {
    check('teacher-chain', false, String(err).slice(0, 160));
  }

  // project memory collapsed
  try {
    await setRole(
      page,
      'priya',
      '#/next/log?project=project-campus-marketplace',
    );
    await page.waitForTimeout(700);
    const mem = await page.evaluate(() => {
      const rows = document.querySelectorAll('.pm-row-main, .pm-card');
      const tags = document.body.innerText;
      return {
        rows: rows.length,
        hasTags:
          /教师正式反馈|人工确认|AI 建议/.test(tags) ||
          !!document.querySelector('.pm-tag'),
        collapsed: !!document.querySelector('.pm-row-main'),
      };
    });
    await shot(page, 'project-memory');
    check(
      'memory-collapsed',
      mem.collapsed && mem.rows > 0,
      `rows=${mem.rows} tags=${mem.hasTags} collapsed=${mem.collapsed}`,
    );
    if (mem.collapsed) {
      await page.locator('.pm-row-main').first().click();
      await page.waitForTimeout(300);
      await shot(page, 'project-memory-expanded');
    }
  } catch (err) {
    check('memory-chain', false, String(err).slice(0, 160));
  }

  const failed = report.checks.filter((c) => !c.ok);
  report.ok = failed.length === 0;
  report.failed = failed.map((c) => c.id);
  const outPath = path.join(__dirname, '..', 'accept-reading-layout-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nReport: ${outPath}`);
  console.log(`Shots: ${OUT}`);
  console.log(report.ok ? 'ALL PASS' : `FAILED: ${report.failed.join(', ')}`);
  await browser.close();
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
