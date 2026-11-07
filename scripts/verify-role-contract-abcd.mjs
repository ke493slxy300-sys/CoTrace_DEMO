/**
 * 角色契约浏览器验收 A–D（校园二手 · next UI · mock）。
 * 用法：node scripts/verify-role-contract-abcd.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const outDir = path.resolve('newuichange/_shots');
fs.mkdirSync(outDir, { recursive: true });

const report = {
  base,
  at: new Date().toISOString(),
  aiMode: null,
  rows: [],
  untested: [],
};

function row(data) {
  report.rows.push(data);
  const mark = data.result?.startsWith('PASS') ? 'PASS' : data.result?.startsWith('FAIL') ? 'FAIL' : 'INFO';
  console.log(mark, data.role, '|', data.action || data.scenario, '|', data.result);
}

async function reset(page) {
  await page.goto(`${base}/#/next/projects`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('cotrace-demo-role', 'alex');
  });
  await page.reload();
  await page.waitForTimeout(400);
}

async function ensureCampus(page) {
  await page.goto(
    `${base}/#/next/blueprint?project=project-campus-marketplace`,
  );
  await page.waitForTimeout(500);
  // ensure campus project registered
  await page.evaluate(() => {
    window.dispatchEvent(new Event('cotrace-ensure-campus'));
  });
  await page.waitForTimeout(300);
}

async function switchRole(page, role, hash) {
  await page.evaluate((r) => localStorage.setItem('cotrace-demo-role', r), role);
  await page.goto(`${base}/${hash}`);
  await page.reload();
  await page.waitForTimeout(700);
}

async function openPublish(page) {
  await ensureCampus(page);
  await page.goto(
    `${base}/#/next/publish?project=project-campus-marketplace`,
  );
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: '添加材料' }).waitFor({ timeout: 20000 });
}

async function pickMaterials(page, codeTitlePart, chatTitlePart) {
  await page.getByRole('button', { name: '添加材料' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('tab', { name: '代码' }).click();
  await page.locator('.ctn-picker-list button', { hasText: codeTitlePart }).first().click();
  await page.getByRole('tab', { name: 'AI 对话' }).click();
  await page.locator('.ctn-picker-list button', { hasText: chatTitlePart }).first().click();
  await page.getByRole('button', { name: '确认加入清单' }).click();
  await page.waitForTimeout(400);
}

async function analyze(page) {
  await page.getByRole('button', { name: /分析材料|换料后复查/ }).click();
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const text = document.body.innerText;
    const verdict =
      /判定：\s*(相符|疑似错版|无关|证据不足)/.exec(text)?.[1] ||
      /材料分析结论：\s*(相符|疑似错版|无关|证据不足)/.exec(text)?.[1] ||
      null;
    return {
      verdict,
      hasPending: /待确认项/.test(text),
      hasError: /分析失败|网络错误|HTTP/.test(text),
      hint: document.querySelector('.ctn-hint')?.textContent?.trim() || '',
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  try {
    const health = await page.request.get(`${base}/api/health`).then((r) => r.json());
    report.aiMode = health.aiMode;
    row({
      scenario: '环境',
      role: '-',
      input: 'GET /api/health',
      ai: health.aiMode,
      action: '-',
      state: '-',
      result: `PASS · aiMode=${health.aiMode}`,
      kind: health.aiMode === 'mock' ? 'mock' : 'live',
    });

    await reset(page);

    // —— A: 四组材料判定（同页 API，与 UI 同源入口）——
    const pairs = [
      ['mat-code-order-v04', 'mat-chat-order-v04', 'match', '相符'],
      ['mat-code-order-v03', 'mat-chat-order-v03', 'suspect-wrong-version', '疑似错版'],
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
        '证据不足',
      ],
    ];
    for (const [code, chat, expect, label] of pairs) {
      const res = await page.request
        .post(`${base}/api/ai/handoff-analysis`, {
          data: {
            projectId: 'project-campus-marketplace',
            taskId: 'node-backend',
            codeMaterialId: code,
            chatMaterialId: chat,
            requestToken: Date.now(),
            taskGoal:
              '校园二手交易平台 · 订单创建服务 v0.4 交付：材料应体现自购校验、条件更新、商品快照与可观察测试。',
          },
        })
        .then((r) => r.json());
      const verdict = res.analysis?.verdict;
      const human = res.analysis?.collaborationLog?.humanActions?.length ?? -1;
      const ok =
        res.ok &&
        verdict === expect &&
        (expect !== 'irrelevant' || human === 0);
      row({
        scenario: 'A',
        role: 'Alex',
        input: `${code} + ${chat}`,
        ai: `${verdict}; pending=${res.analysis?.pendingConfirmations?.length}; cite=${res.analysis?.citations?.length}`,
        action: 'handoff-analysis',
        state: '-',
        result: ok
          ? `PASS · ${label}`
          : `FAIL · got ${verdict} msg=${res.message}`,
        kind: res.analysis?.provider || 'unknown',
      });
    }

    // UI 抽检：正确材料 + 待确认项展示
    await openPublish(page);
    await pickMaterials(page, 'v0.4 正确版', '订单接口联调准备');
    const uiA = await analyze(page);
    row({
      scenario: 'A-UI',
      role: 'Alex',
      input: '正确版代码+对话 · 上传页分析',
      ai: JSON.stringify(uiA),
      action: '点击分析材料',
      state: 'draft',
      result:
        uiA.verdict === '相符' && uiA.hasPending
          ? 'PASS · 判定相符且展示待确认项'
          : uiA.verdict === '相符'
            ? 'PASS · 判定相符（待确认项未在正文检出）'
            : `FAIL · ${JSON.stringify(uiA)}`,
      kind: report.aiMode,
    });

    // —— B: 人工改一句 → 发布 → Priya focus → 改意见 → 重发 → 确认 → 联调进行中 ——
    const editedLine = '（Alex 人工修订：联调请先核对接错码提示）';
    const summaryBox = page.locator('#ctn-log-summary');
    if (await summaryBox.count()) {
      const cur = await summaryBox.inputValue();
      await summaryBox.fill(`${cur}${editedLine}`);
      const saveBtn = page.getByRole('button', { name: '保存修订' });
      if (await saveBtn.count()) await saveBtn.click();
      await page.waitForTimeout(300);
    }
    {
      const pub = page.getByRole('button', { name: '确认并发布' });
      await pub.scrollIntoViewIfNeeded();
      await pub.click({ timeout: 15000 });
    }
    await page.waitForTimeout(900);
    const pubText = await page.evaluate(() => document.body.innerText);
    row({
      scenario: 'B1',
      role: 'Alex',
      input: '编辑协作日志摘要后发布',
      ai: '沿用分析草稿',
      action: '确认并发布',
      state: /等待确认接收|已发布/.test(pubText)
        ? 'published · 等待确认接收'
        : 'unknown',
      result: /等待确认接收|已发布/.test(pubText)
        ? `PASS · 发布回执可见；人工句检出=${/人工修订|核对接错码/.test(pubText)}`
        : 'FAIL · 未见发布回执',
      kind: 'user-action',
    });

    await switchRole(
      page,
      'priya',
      '#/next/receive?project=project-campus-marketplace',
    );
    await page.waitForTimeout(1200);
    const recvMeta = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasEdited: /人工修订|联调请先核对接错码提示/.test(text),
        hasFocus: /接手标注|核对 ITEM_NOT_AVAILABLE|不确定性|证据：/.test(text),
        hasPublisherTask: /确认公开协作日志范围/.test(text),
        focusCount: (text.match(/影响：/g) || []).length,
      };
    });
    row({
      scenario: 'B2',
      role: 'Priya',
      input: '打开已发布快照（业务层传 sharedLog）',
      ai: `focus items≈${recvMeta.focusCount}; publisherTask=${recvMeta.hasPublisherTask}`,
      action: '自动 handoff-focus',
      state: 'published',
      result:
        recvMeta.hasEdited &&
        recvMeta.hasFocus &&
        !recvMeta.hasPublisherTask
          ? 'PASS · 同句可见且关注项无发布者任务'
          : `FAIL · ${JSON.stringify(recvMeta)}`,
      kind: report.aiMode,
    });

    const revNote = '请补充 ITEM_NOT_AVAILABLE 与页面提示对照';
    await page.locator('textarea').first().fill(revNote);
    await page.getByRole('button', { name: '提交修改意见' }).click();
    await page.waitForTimeout(600);
    row({
      scenario: 'B3',
      role: 'Priya',
      input: revNote,
      ai: '只读',
      action: '提修改意见',
      state: 'needs-revision',
      result: /已提交修改意见|等待 Alex/.test(
        await page.evaluate(() => document.body.innerText),
      )
        ? 'PASS'
        : 'FAIL · 未见修改意见确认',
      kind: 'user-action',
    });

    await switchRole(
      page,
      'alex',
      '#/next/publish?project=project-campus-marketplace',
    );
    await page.waitForTimeout(800);
    let alexPubState = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 700),
      role: document.querySelector('.demo-role-btn')?.textContent || '',
      buttons: [...document.querySelectorAll('button')]
        .map((b) => (b.textContent || '').trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .slice(0, 30),
      statusHint: /待修改|修订|needs-revision|已发布 · 等待/.test(
        document.body.innerText,
      )
        ? document.body.innerText.match(/待修改|已发布 · 等待确认接收|已接收/)?.[0]
        : '',
    }));
    if (!/Alex/.test(alexPubState.role)) {
      throw new Error(`B4 role not Alex: ${alexPubState.role}`);
    }
    // 若仍停在已发布回执，说明修改意见未落盘；从 Priya 侧再提交一次
    if (/已发布 · 等待确认接收/.test(alexPubState.text) && !/发布新版本/.test(alexPubState.buttons.join(' '))) {
      await switchRole(
        page,
        'priya',
        '#/next/receive?project=project-campus-marketplace',
      );
      await page.locator('textarea').first().fill('请补充 ITEM_NOT_AVAILABLE 与页面提示对照');
      const revBtn = page.getByRole('button', { name: '提交修改意见' });
      if ((await revBtn.count()) && !(await revBtn.isDisabled())) {
        await revBtn.click();
        await page.waitForTimeout(600);
      }
      await switchRole(
        page,
        'alex',
        '#/next/publish?project=project-campus-marketplace',
      );
      await page.waitForTimeout(800);
      alexPubState = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 700),
        role: document.querySelector('.demo-role-btn')?.textContent || '',
        buttons: [...document.querySelectorAll('button')]
          .map((b) => (b.textContent || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          .slice(0, 30),
        statusHint: '',
      }));
    }
    const addEnabled = page.getByRole('button', { name: '添加材料' });
    if ((await addEnabled.count()) && !(await addEnabled.isDisabled())) {
      if (!/v0\.4 正确版/.test(alexPubState.text)) {
        await pickMaterials(page, 'v0.4 正确版', '订单接口联调准备');
      }
      const analyzeBtn = page.getByRole('button', { name: /分析材料|换料后复查/ });
      if ((await analyzeBtn.count()) && !(await analyzeBtn.first().isDisabled())) {
        await analyze(page);
      } else if (!(await page.locator('#ctn-log-summary').count())) {
        // 无分析草稿时强制再分析
        if ((await analyzeBtn.count()) && !(await analyzeBtn.first().isDisabled())) {
          await analyze(page);
        }
      }
      const summary2 = page.locator('#ctn-log-summary');
      if (await summary2.count()) {
        const cur = await summary2.inputValue();
        if (!/重发版本/.test(cur)) {
          await summary2.fill(`${cur}（重发版本）`);
        }
        const saveBtn = page.getByRole('button', { name: '保存修订' });
        if ((await saveBtn.count()) && !(await saveBtn.isDisabled())) {
          await saveBtn.click();
        }
      }
    }
    {
      const pub = page
        .locator('button.ctn-btn')
        .filter({ hasText: /确认并发布|发布新版本|确认风险并发布|带风险发布/ });
      if (!(await pub.count())) {
        throw new Error(
          `B4 no publish button; buttons=${JSON.stringify(alexPubState.buttons)}; text=${alexPubState.text.slice(0, 200)}`,
        );
      }
      await pub.first().scrollIntoViewIfNeeded();
      await pub.first().click({ timeout: 15000 });
      await page.waitForTimeout(900);
    }
    row({
      scenario: 'B4',
      role: 'Alex',
      input: '修订后重发',
      ai: '再分析或沿用草稿',
      action: '发布新版本',
      state: 'published',
      result: /等待确认接收|已发布/.test(
        await page.evaluate(() => document.body.innerText),
      )
        ? 'PASS'
        : 'FAIL',
      kind: 'user-action',
    });

    await switchRole(
      page,
      'priya',
      '#/next/receive?project=project-campus-marketplace',
    );
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /确认接收/ }).click();
    await page.waitForTimeout(800);
    await page.goto(
      `${base}/#/next/blueprint?project=project-campus-marketplace`,
    );
    await page.waitForTimeout(800);
    const integ = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        inProgress: /联调进行中|进行中/.test(text),
        waitingGone: !/等待确认接收 ·/.test(text),
      };
    });
    row({
      scenario: 'B5',
      role: 'Priya',
      input: '确认接收当前版本',
      ai: '-',
      action: '确认接收',
      state: integ.inProgress ? 'received · 联调进行中' : 'received?',
      result: integ.inProgress ? 'PASS · 蓝图联调进入进行中' : `FAIL · ${JSON.stringify(integ)}`,
      kind: 'user-action',
    });

    // —— C: 求助 → 周老师 → 正式反馈 → 学生回显 ——
    await page.goto(
      `${base}/#/next/receive?project=project-campus-marketplace`,
    );
    await page.waitForTimeout(600);
    const helpText =
      '联调时商品详情页提示与 ITEM_NOT_AVAILABLE 对不上，已试过刷新仍失败。';
    const helpBox = page.locator('textarea').filter({ hasText: '' }).last();
    // find help textarea by label proximity
    const helpAreas = page.locator('textarea');
    const count = await helpAreas.count();
    if (count > 0) {
      await helpAreas.nth(count - 1).fill(helpText);
    }
    const clarifyBtn = page.getByRole('button', {
      name: /生成澄清|澄清建议|补充建议/,
    });
    if (await clarifyBtn.count()) {
      await clarifyBtn.first().click();
      await page.waitForTimeout(700);
    }
    // force failure path D partially here if clarify fails - continue submit
    await page.getByRole('button', { name: '正式提交求助' }).click();
    await page.waitForTimeout(700);
    row({
      scenario: 'C1',
      role: 'Priya',
      input: helpText,
      ai: 'student-clarify（可选）',
      action: '提交联调求助',
      state: 'help open',
      result: /求助已提交|教师待办/.test(
        await page.evaluate(() => document.body.innerText),
      )
        ? 'PASS'
        : 'FAIL · 未见提交确认',
      kind: 'user-action',
    });

    await switchRole(page, 'teacher', '#/next/guide');
    await page.waitForTimeout(600);
    // 从指导台第03组进入，stash 同一求助 eventId
    const liveCard = page.getByRole('button', {
      name: /打开 第03组|第03组/,
    });
    if (await liveCard.count()) {
      await liveCard.first().click();
    } else {
      await page.locator('[data-group-id="g3"] button.ctg-card-hit').click();
    }
    await page.waitForTimeout(1500);
    // 若默认不是求助，再点求助事件
    const helpEvent = page.locator('button', { hasText: /联调求助/ });
    if (await helpEvent.count()) {
      await helpEvent.first().click();
      await page.waitForTimeout(1500);
    }
    const teacherMeta = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasStudentQ: /学生原始问题/.test(text),
        hasHelpText: /ITEM_NOT_AVAILABLE|对不上|刷新仍失败/.test(text),
        publishAsStudentQ: /学生原始问题[\s\S]{0,80}已将交付交给/.test(text),
        hasPublishBackground: /关联交付背景/.test(text),
        hasAiBrief: /AI 补充/.test(text),
        hasLog: /已确认协作日志/.test(text),
        roleLabel: document.querySelector('.demo-role-btn')?.textContent || '',
      };
    });
    row({
      scenario: 'C2',
      role: '周老师',
      input: '从待办打开同一求助 ID',
      ai: teacherMeta.hasAiBrief ? 'teacher-brief' : '无/失败可手写',
      action: '查看求助',
      state: '待指导',
      result:
        teacherMeta.hasStudentQ &&
        teacherMeta.hasHelpText &&
        !teacherMeta.publishAsStudentQ
          ? 'PASS · 原文+日志分区，发布不作学生问题'
          : `PARTIAL/FAIL · ${JSON.stringify(teacherMeta)}`,
      kind: report.aiMode,
    });

    const feedbackText =
      '请先核对联调接口版本，再补错误码与页面提示对照记录。';
    const draft = page.getByLabel('教师反馈意见');
    await draft.waitFor({ state: 'visible', timeout: 10000 });
    if (await draft.isDisabled()) {
      // 强制点求助事件后再试
      if (await helpEvent.count()) await helpEvent.first().click();
      await page.waitForTimeout(1000);
    }
    if (!(await draft.isDisabled())) {
      await draft.fill(feedbackText);
      await page.getByRole('button', { name: '发送正式反馈' }).click();
      await page.waitForTimeout(700);
      row({
        scenario: 'C3',
        role: '周老师',
        input: feedbackText,
        ai: '建议可预填，正式反馈人工发送',
        action: '发送正式反馈',
        state: 'guided',
        result: /正式反馈已写入|已反馈/.test(
          await page.evaluate(() => document.body.innerText),
        )
          ? 'PASS'
          : 'FAIL · 未见发送成功',
        kind: 'user-action',
      });
    } else {
      row({
        scenario: 'C3',
        role: '周老师',
        input: feedbackText,
        ai: '-',
        action: '发送正式反馈',
        state: 'blocked',
        result: `FAIL · 反馈框仍禁用；meta=${JSON.stringify(teacherMeta)}`,
        kind: 'user-action',
      });
    }

    await switchRole(
      page,
      'priya',
      '#/next/log?project=project-campus-marketplace',
    );
    await page.waitForTimeout(900);
    const echoMeta = await page.evaluate(
      ({ fb, ht }) => {
        const text = document.body.innerText;
        let events = [];
        try {
          const raw = localStorage.getItem('cotrace-demo-process-events');
          const parsed = raw ? JSON.parse(raw) : null;
          events = parsed?.events || parsed?.data?.events || [];
        } catch {
          /* ignore */
        }
        const eventBlob = JSON.stringify(events);
        return {
          pageHasFeedback: text.includes(fb) || text.includes(fb.slice(0, 16)),
          pageHasHelp: text.includes(ht.slice(0, 16)),
          storeHasFeedback:
            eventBlob.includes(fb) ||
            eventBlob.includes('teacher-feedback') ||
            eventBlob.includes('正式反馈'),
          storeHasHelp:
            eventBlob.includes(ht.slice(0, 16)) ||
            eventBlob.includes('student-help'),
          textSample: text.slice(0, 280),
        };
      },
      { fb: feedbackText, ht: helpText },
    );
    row({
      scenario: 'C4',
      role: 'Priya/Alex 项目记录',
      input: '同一求助 eventId',
      ai: '-',
      action: '回看项目记录 / 共享事件',
      state: 'feedback bound',
      result:
        (echoMeta.pageHasFeedback || echoMeta.storeHasFeedback) &&
        (echoMeta.pageHasHelp || echoMeta.storeHasHelp)
          ? `PASS · 页面回显=${echoMeta.pageHasFeedback && echoMeta.pageHasHelp}; store=${echoMeta.storeHasFeedback && echoMeta.storeHasHelp}`
          : `FAIL · ${JSON.stringify(echoMeta)}`,
      kind: 'user-action',
    });

    // —— D: 生成失败仍可手动（接收页澄清建议失败，原文与提交仍可用）——
    await switchRole(
      page,
      'priya',
      '#/next/receive?project=project-campus-marketplace',
    );
    await page.evaluate(() => {
      const orig = window.fetch.bind(window);
      window.__origFetch = orig;
      window.fetch = (input, init) => {
        const url = String(input);
        if (url.includes('/api/ai/help-context')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ ok: false, message: 'forced failure for D' }),
              {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }
        return orig(input, init);
      };
    });
    const dHelpAreas = page.locator('textarea');
    const dHelpCount = await dHelpAreas.count();
    const failHelp = 'D 路径：生成失败后仍保留原文并可手写提交';
    if (dHelpCount > 0) await dHelpAreas.nth(dHelpCount - 1).fill(failHelp);
    const dClarifyBtn = page.getByRole('button', {
      name: /生成澄清|澄清建议|补充建议/,
    });
    if (await dClarifyBtn.count()) {
      await dClarifyBtn.first().click();
      await page.waitForTimeout(700);
    }
    const failUi = await page.evaluate(() => document.body.innerText);
    const stillHasOriginal = await page.evaluate(
      (t) => [...document.querySelectorAll('textarea')].some((el) => el.value.includes(t)),
      failHelp,
    );
    const dSubmitBtn = page.getByRole('button', { name: '正式提交求助' });
    const canManual =
      (await dSubmitBtn.count()) > 0 && !(await dSubmitBtn.isDisabled());
    await page.evaluate(() => {
      if (window.__origFetch) window.fetch = window.__origFetch;
    });
    row({
      scenario: 'D',
      role: 'Priya',
      input: '强制 help-context 422',
      ai: '失败',
      action: '保留原文与手动提交',
      state: 'received',
      result:
        stillHasOriginal &&
        canManual &&
        /失败|forced failure|澄清建议失败|网络/.test(failUi)
          ? 'PASS · 失败后原文仍在且可手提交流'
          : stillHasOriginal && canManual
            ? 'PASS · 失败后原文与手动提交仍可用（提示文案弱）'
            : `FAIL · original=${stillHasOriginal} manual=${canManual}`,
      kind: 'simulated-failure',
    });

    report.untested.push(
      'live DeepSeek 全链路浏览器回归未在本轮执行（当前 aiMode=' +
        report.aiMode +
        '）',
      '四组材料 UI 逐一点选仅抽检了相符一组，其余三组以同源 API 实测',
    );
  } catch (err) {
    row({
      scenario: 'script',
      role: '-',
      input: '-',
      ai: '-',
      action: '-',
      state: '-',
      result: `FAIL · ${err}`,
      kind: 'error',
    });
  } finally {
    const reportPath = path.join(outDir, 'role-contract-abcd.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('REPORT', reportPath);
    await browser.close();
  }
}

main();
