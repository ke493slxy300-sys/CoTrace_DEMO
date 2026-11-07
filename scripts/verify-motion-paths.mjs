/**
 * 主路径动效 + 个人工作区回归（Playwright）。
 * 用法：node scripts/verify-motion-paths.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('newuichange/_shots');
fs.mkdirSync(outDir, { recursive: true });

const report = {
  base,
  at: new Date().toISOString(),
  checks: [],
  blocked: [],
};

function ok(name, detail) {
  report.checks.push({ name, pass: true, detail });
  console.log('PASS', name, detail || '');
}

function fail(name, detail) {
  report.checks.push({ name, pass: false, detail });
  console.log('FAIL', name, detail || '');
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

async function shot(page, name) {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.waitForTimeout(280);
  const file = path.join(outDir, `${name}-1536x1024.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function recordClip(page, name, action) {
  const framesDir = path.join(outDir, `_frames_${name}`);
  fs.mkdirSync(framesDir, { recursive: true });
  const paths = [];
  paths.push(path.join(framesDir, '00-before.png'));
  await page.screenshot({ path: paths[0], fullPage: false });
  await action();
  for (let i = 1; i <= 6; i += 1) {
    await page.waitForTimeout(70);
    const p = path.join(framesDir, `${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: p, fullPage: false });
    paths.push(p);
  }
  await page.waitForTimeout(220);
  const last = path.join(framesDir, '99-after.png');
  await page.screenshot({ path: last, fullPage: false });
  paths.push(last);
  return paths;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });

  try {
    await reset(page);

    // —— 1) 项目首页进入：首次不自动选中 ——
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForURL(/blueprint/);
    await page.waitForTimeout(700);
    const firstEnter = await page.evaluate(() => {
      const selected = document.querySelectorAll('.wbp-node.is-on').length;
      const open = document.querySelector('.wbp-dock.is-open') != null;
      const overview = document.querySelector('.wbp-overview');
      return {
        selected,
        open,
        overviewVisible: overview
          ? getComputedStyle(overview).visibility !== 'hidden'
          : false,
      };
    });
    if (firstEnter.selected === 0 && !firstEnter.open) {
      ok('首次进入蓝图不自动选中', JSON.stringify(firstEnter));
    } else {
      fail('首次进入蓝图不自动选中', JSON.stringify(firstEnter));
    }
    await shot(page, 'blueprint-overview');

    // —— 2) 打开节点详情：节点/线先亮，面板进入 ——
    const openFrames = await recordClip(page, 'detail-open-live', async () => {
      await page.locator('.wbp-node[data-node="node-requirements"]').click();
    });
    const openState = await page.evaluate(() => {
      const node = document.querySelector('.wbp-node[data-node="node-requirements"]');
      const dock = document.querySelector('.wbp-dock');
      const detail = document.querySelector('.wbp-detail');
      const related = document.querySelectorAll('.wbp-edge.is-related').length;
      return {
        nodeOn: node?.classList.contains('is-on') ?? false,
        dockOpen: dock?.classList.contains('is-open') ?? false,
        detailOpacity: detail ? getComputedStyle(detail).opacity : null,
        related,
        title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
      };
    });
    if (openState.nodeOn && openState.dockOpen && Number(openState.detailOpacity) > 0.9) {
      ok('首次打开节点详情', JSON.stringify(openState));
    } else {
      fail('首次打开节点详情', JSON.stringify(openState));
    }

    // —— 3) 切节点：外框复用，内容换 ——
    const beforeMetrics = await page.evaluate(() => {
      const dock = document.querySelector('.wbp-dock');
      const detail = document.querySelector('.wbp-detail');
      return {
        dockH: dock ? getComputedStyle(dock).height : null,
        detailH: detail ? getComputedStyle(detail).height : null,
        open: document.querySelector('.wbp-dock.is-open') != null,
      };
    });
    await page.locator('.wbp-node[data-node="node-backend"]').click();
    await page.waitForTimeout(120);
    const switchState = await page.evaluate((before) => {
      const dock = document.querySelector('.wbp-dock');
      const detail = document.querySelector('.wbp-detail');
      const body = document.querySelector('.wbp-detail-body');
      return {
        before,
        dockH: dock ? getComputedStyle(dock).height : null,
        detailH: detail ? getComputedStyle(detail).height : null,
        sameDockH: before.dockH === (dock ? getComputedStyle(dock).height : null),
        stillOpen: document.querySelector('.wbp-dock.is-open') != null,
        swapClass: body?.classList.contains('is-swap') ?? false,
        title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
        selected: document.querySelector('.wbp-node.is-on')?.getAttribute('data-node'),
      };
    }, beforeMetrics);
    if (
      switchState.sameDockH &&
      switchState.stillOpen &&
      switchState.selected === 'node-backend' &&
      /后端/.test(switchState.title || '')
    ) {
      ok('切节点复用面板外框', JSON.stringify(switchState));
    } else {
      fail('切节点复用面板外框', JSON.stringify(switchState));
    }

    // —— 4) 画布滚动位置保持 ——
    const scrollKeep = await page.evaluate(() => {
      const wrap = document.querySelector('.wbp-canvas-wrap');
      if (!wrap) return { ok: false, reason: 'no wrap' };
      wrap.scrollTop = 40;
      const before = wrap.scrollTop;
      document.querySelector('.wbp-node[data-node="node-frontend"]')?.click();
      const after = wrap.scrollTop;
      return { ok: before === after, before, after };
    });
    if (scrollKeep.ok) ok('切节点保持滚动位置', JSON.stringify(scrollKeep));
    else fail('切节点保持滚动位置', JSON.stringify(scrollKeep));

    // —— 5) 关闭 ——
    await page.locator('.wbp-canvas').click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(350);
    const closed = await page.evaluate(() => ({
      selected: document.querySelectorAll('.wbp-node.is-on').length,
      open: document.querySelector('.wbp-dock.is-open') != null,
      overviewVisible:
        getComputedStyle(document.querySelector('.wbp-overview')).visibility !==
        'hidden',
    }));
    if (closed.selected === 0 && !closed.open && closed.overviewVisible) {
      ok('关闭详情面板', JSON.stringify(closed));
    } else {
      fail('关闭详情面板', JSON.stringify(closed));
    }

    // —— 6) 快速点选 ——
    const rapid = await page.evaluate(async () => {
      const ids = [
        'node-requirements',
        'node-database',
        'node-backend',
        'node-frontend',
        'node-integration',
      ];
      for (const id of ids) {
        document.querySelector(`.wbp-node[data-node="${id}"]`)?.click();
        await new Promise((r) => setTimeout(r, 40));
      }
      await new Promise((r) => setTimeout(r, 300));
      return {
        selected: document.querySelector('.wbp-node.is-on')?.getAttribute('data-node'),
        open: document.querySelector('.wbp-dock.is-open') != null,
        title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
      };
    });
    if (rapid.selected === 'node-integration' && rapid.open) {
      ok('连续快速点选终态稳定', JSON.stringify(rapid));
    } else {
      fail('连续快速点选终态稳定', JSON.stringify(rapid));
    }

    // —— 7) 后端接口 → 进入个人工作（直达材料阅读工作区）→ 返回恢复选中 ——
    await page.locator('.wbp-node[data-node="node-backend"]').click();
    await page.waitForTimeout(350);
    const enterBtn = page.locator('.wbp-detail button', {
      hasText: /进入个人工作|查看任务说明|回看成果/,
    });
    await enterBtn.first().click();
    await page.waitForTimeout(700);
    const codingPath = await shot(page, 'coding-work');
    const nodeWorkPath = await shot(page, 'node-work');
    const onPersonal = await page.evaluate(() => ({
      shell: document.querySelector('.stu-shell') != null,
      kicker: document.querySelector('.nw-kicker')?.textContent?.trim(),
      materials: document.querySelector('.nw-work, .nw-file-list, .workbench') != null,
      delivery: !!Array.from(document.querySelectorAll('button')).find((b) =>
        /发布交付/.test(b.textContent || ''),
      ),
      navBlueprint: !!Array.from(document.querySelectorAll('.stu-nav')).find((b) =>
        /蓝图/.test(b.textContent || ''),
      ),
      navWork: document.querySelector('.stu-nav.is-on')?.textContent?.includes('工作'),
    }));
    if (
      onPersonal.shell &&
      /个人工作区|个人工作/.test(onPersonal.kicker || '') &&
      onPersonal.materials &&
      onPersonal.delivery &&
      onPersonal.navBlueprint
    ) {
      ok(
        '个人工作区迁入 StudentShell',
        `${JSON.stringify(onPersonal)} · ${codingPath}`,
      );
    } else {
      fail('个人工作区迁入 StudentShell', JSON.stringify(onPersonal));
    }

    await page.locator('.stu-nav', { hasText: '蓝图' }).click();
    await page.waitForTimeout(700);
    const restored = await page.evaluate(() => ({
      selected: document.querySelector('.wbp-node.is-on')?.getAttribute('data-node'),
      open: document.querySelector('.wbp-dock.is-open') != null,
      title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
    }));
    if (restored.selected === 'node-backend' && restored.open) {
      ok('返回蓝图恢复选中节点', JSON.stringify(restored));
    } else {
      fail('返回蓝图恢复选中节点', JSON.stringify(restored));
    }

    // —— 8) 发布 / 接收 ——
    await page.goto(`${base}/#/next/publish`);
    await page.waitForTimeout(500);
    const pubBefore = await shot(page, 'publish-before');
    const pubBtn = page.locator('button', { hasText: /^发布交付$/ });
    if (await pubBtn.count()) {
      await pubBtn.first().click();
      await page.waitForTimeout(500);
      const pubAfter = await shot(page, 'publish-after');
      const pubReceipt = await page.evaluate(() =>
        document.body.innerText.includes('等待确认接收') ||
        document.body.innerText.includes('等待接收') ||
        document.body.innerText.includes('已发布'),
      );
      if (pubReceipt) ok('发布交付回执', `${pubBefore} → ${pubAfter}`);
      else fail('发布交付回执', '未见等待确认接收/已发布文案');
    } else {
      fail('发布交付按钮', '未找到');
    }

    await page.evaluate(() => localStorage.setItem('cotrace-demo-role', 'priya'));
    await page.goto(`${base}/#/next/receive`);
    await page.reload();
    await page.waitForTimeout(700);
    await shot(page, 'receive-before');
    const recvBtn = page.locator('button', { hasText: /确认接收/ });
    if (await recvBtn.count()) {
      await recvBtn.first().click();
      await page.waitForTimeout(500);
      await shot(page, 'receive-after');
      const recvOk = await page.evaluate(() =>
        /已接收|已接手|联调/.test(document.body.innerText),
      );
      if (recvOk) ok('确认接收回执', 'receive-after');
      else fail('确认接收回执', '未见接收后文案');
    } else {
      fail('确认接收按钮', '未找到（可能已接收）');
    }

    // —— 9) 项目记忆 ——
    await page.goto(`${base}/#/next/log?project=project-seatflow-demo`);
    await page.waitForTimeout(600);
    await shot(page, 'memory-seatflow');
    const memExpand = page.locator('button', { hasText: /展开|查看|详情/ }).first();
    if (await page.locator('.pm-card, .pm-item, article').count()) {
      ok('项目记忆页可打开', 'seatflow');
    } else {
      fail('项目记忆页可打开', '无卡片');
    }

    // —— 10) 教师阶段汇报 / 核收（需教师角色） ——
    await page.evaluate(() => localStorage.setItem('cotrace-demo-role', 'teacher'));
    await page.goto(`${base}/#/next/guide`);
    await page.reload();
    await page.waitForTimeout(600);
    await shot(page, 'guide-after');
    const guideOk = await page.evaluate(() =>
      /指导|课堂|待办|核收/.test(document.body.innerText),
    );
    if (guideOk) ok('教师指导台', 'opened');
    else fail('教师指导台', '文案不符');

    await page.goto(`${base}/#/next/stage`);
    await page.waitForTimeout(600);
    await shot(page, 'stage');
    const stageOk = await page.evaluate(() =>
      /阶段|汇报|反馈|事件/.test(document.body.innerText),
    );
    if (stageOk) ok('教师阶段汇报页', 'opened');
    else fail('教师阶段汇报页', '文案不符');

    await page.goto(`${base}/#/next/acceptance`);
    await page.waitForTimeout(600);
    await shot(page, 'acceptance-after');
    const acceptOk = await page.evaluate(() =>
      /核收|验收|提交|v1/.test(document.body.innerText),
    );
    if (acceptOk) ok('教师核收页', 'opened');
    else fail('教师核收页', '文案不符');

    // —— 11) prefers-reduced-motion：打开/关闭直达终态 ——
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => localStorage.setItem('cotrace-demo-role', 'alex'));
    await page.goto(`${base}/#/next/projects`);
    await page.reload();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForURL(/blueprint/);
    await page.waitForTimeout(600);
    await page.locator('.wbp-node[data-node="node-database"]').click();
    await page.waitForTimeout(80);
    const reduceOpen = await page.evaluate(() => {
      const detail = document.querySelector('.wbp-detail');
      const cs = detail ? getComputedStyle(detail) : null;
      return {
        match: matchMedia('(prefers-reduced-motion: reduce)').matches,
        open: document.querySelector('.wbp-dock.is-open') != null,
        opacity: cs?.opacity,
        transform: cs?.transform,
        transition: cs?.transitionDuration,
      };
    });
    await page.locator('.wbp-canvas').click({ position: { x: 16, y: 16 } });
    await page.waitForTimeout(80);
    const reduceClosed = await page.evaluate(() => {
      const detail = document.querySelector('.wbp-detail');
      const cs = detail ? getComputedStyle(detail) : null;
      return {
        open: document.querySelector('.wbp-dock.is-open') != null,
        selected: document.querySelectorAll('.wbp-node.is-on').length,
        opacity: cs?.opacity,
        transition: cs?.transitionDuration,
      };
    });
    if (
      reduceOpen.match &&
      reduceOpen.open &&
      Number(reduceOpen.opacity) > 0.95 &&
      (!reduceOpen.transition || reduceOpen.transition === '0s')
    ) {
      ok('reduced-motion 打开直达', JSON.stringify(reduceOpen));
    } else {
      fail('reduced-motion 打开直达', JSON.stringify(reduceOpen));
    }
    if (!reduceClosed.open && reduceClosed.selected === 0) {
      ok('reduced-motion 关闭直达', JSON.stringify(reduceClosed));
    } else {
      fail('reduced-motion 关闭直达', JSON.stringify(reduceClosed));
    }

    report.openFrames = openFrames;
    report.nodeWorkShot = nodeWorkPath;
  } catch (err) {
    report.blocked.push(String(err?.stack || err));
    console.error(err);
  } finally {
    const out = path.join(outDir, 'motion-verify.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
    console.log('REPORT', out);
    await browser.close();
  }

  const failed = report.checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 || report.blocked.length ? 1 : 0);
}

main();
