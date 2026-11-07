/**
 * 本轮验收：启动→蓝图→项目首页→回蓝图；节点开合与缩放；三张截图。
 * 用法：node scripts/_verify-home-zoom-detail.mjs [baseUrl]
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
  shots: {},
  untested: [],
};

function ok(name, detail) {
  report.checks.push({ name, pass: true, detail });
  console.log('PASS', name, detail || '');
}

function fail(name, detail) {
  report.checks.push({ name, pass: false, detail });
  console.log('FAIL', name, detail || '');
}

async function shot(page, name) {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.waitForTimeout(350);
  const file = path.join(outDir, `${name}-1536x1024.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots[name] = file;
  return file;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1024 },
  });

  try {
    // —— 1) 空地址启动 → 蓝图，未选中 ——
    await page.goto(`${base}/`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${base}/`);
    await page.waitForTimeout(900);
    const startHash = await page.evaluate(() => location.hash);
    const startState = await page.evaluate(() => ({
      hash: location.hash,
      hasBlueprint: !!document.querySelector('.wbp'),
      selected: document.querySelectorAll('.wbp-node.is-on').length,
      dockOpen: !!document.querySelector('.wbp-dock.is-open'),
      zoomInTools: !!document.querySelector('.wbp-canvas-wrap > .wbp-canvas-tools .wbp-zoom'),
      acceptance: (() => {
        const wrap = document.querySelector('.wbp-canvas-wrap');
        const node = document.querySelector('.wbp-node[data-node="node-acceptance"]');
        if (!wrap || !node) return null;
        const wr = wrap.getBoundingClientRect();
        const nr = node.getBoundingClientRect();
        return {
          fully:
            nr.top >= wr.top - 1 &&
            nr.bottom <= wr.bottom + 1 &&
            nr.left >= wr.left - 1 &&
            nr.right <= wr.right + 1,
          nodeBottom: Math.round(nr.bottom),
          wrapBottom: Math.round(wr.bottom),
        };
      })(),
    }));
    if (
      (startHash === '#/next/blueprint' || startState.hash === '#/next/blueprint') &&
      startState.hasBlueprint &&
      startState.selected === 0 &&
      !startState.dockOpen
    ) {
      ok('启动默认完整蓝图且未选中', JSON.stringify(startState));
    } else {
      fail('启动默认完整蓝图且未选中', JSON.stringify({ startHash, startState }));
    }
    if (startState.zoomInTools) {
      ok('缩放控件在画布框架工具条', 'wbp-canvas-wrap > tools > zoom');
    } else {
      fail('缩放控件在画布框架工具条', JSON.stringify(startState));
    }
    if (startState.acceptance?.fully) {
      ok('默认态验收节点可见 1536x1024', JSON.stringify(startState.acceptance));
    } else {
      fail('默认态验收节点可见 1536x1024', JSON.stringify(startState.acceptance));
    }
    await shot(page, 'round-blueprint-default');

    // —— 2) 顶栏/侧栏「项目」→ 项目首页，刷新仍在首页 ——
    await page.getByRole('button', { name: '项目首页' }).click();
    await page.waitForTimeout(500);
    const onProjects = await page.evaluate(() => ({
      hash: location.hash,
      title: document.querySelector('.pl-head h1')?.textContent?.trim(),
      cards: document.querySelectorAll('.pl-card').length,
    }));
    if (onProjects.hash === '#/next/projects' && onProjects.title === '项目列表') {
      ok('侧栏进入项目首页', JSON.stringify(onProjects));
    } else {
      fail('侧栏进入项目首页', JSON.stringify(onProjects));
    }
    await page.reload();
    await page.waitForTimeout(700);
    const afterRefresh = await page.evaluate(() => location.hash);
    if (afterRefresh === '#/next/projects') {
      ok('项目首页刷新保持', afterRefresh);
    } else {
      fail('项目首页刷新保持', afterRefresh);
    }
    await shot(page, 'round-project-home');

    // —— 3) 点项目卡 → 蓝图；浏览器后退 → 列表 ——
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForTimeout(800);
    const afterCard = await page.evaluate(() => ({
      hash: location.hash,
      selected: document.querySelectorAll('.wbp-node.is-on').length,
      hasBlueprint: !!document.querySelector('.wbp'),
    }));
    if (
      afterCard.hash === '#/next/blueprint' &&
      afterCard.hasBlueprint &&
      afterCard.selected === 0
    ) {
      ok('点项目卡进入蓝图未选中', JSON.stringify(afterCard));
    } else {
      fail('点项目卡进入蓝图未选中', JSON.stringify(afterCard));
    }
    await page.goBack();
    await page.waitForTimeout(600);
    const afterBack = await page.evaluate(() => ({
      hash: location.hash,
      title: document.querySelector('.pl-head h1')?.textContent?.trim(),
    }));
    if (afterBack.hash === '#/next/projects') {
      ok('浏览器后退回项目列表', JSON.stringify(afterBack));
    } else {
      fail('浏览器后退回项目列表', JSON.stringify(afterBack));
    }

    // 再进蓝图做节点交互
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForTimeout(700);

    // —— 4) 点节点 → 浮卡；无关闭按钮；换节点更新；同节点/空白收起 ——
    const wrapH0 = await page.evaluate(
      () => document.querySelector('.wbp-canvas-wrap')?.getBoundingClientRect().height ?? 0,
    );
    await page.locator('.wbp-node[data-node="node-requirements"]').click();
    await page.waitForTimeout(450);
    const openReq = await page.evaluate((wrapHBefore) => {
      const detail = document.querySelector('.wbp-detail');
      const wrap = document.querySelector('.wbp-canvas-wrap');
      return {
        open: !!document.querySelector('.wbp-dock.is-open'),
        hasClose: !!document.querySelector('.wbp-detail-close'),
        title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
        status: document.querySelector('.wbp-detail-kicker')?.textContent?.trim(),
        key: document.querySelector('.wbp-detail-summary')?.textContent?.trim(),
        actions: document.querySelectorAll('.wbp-detail-actions button').length,
        actionText: document.querySelector('.wbp-detail-actions button')?.textContent?.trim(),
        wrapH: wrap?.getBoundingClientRect().height ?? 0,
        wrapHBefore,
        zoomBottom: (() => {
          const z = document.querySelector('.wbp-canvas-tools');
          return z ? Math.round(z.getBoundingClientRect().bottom) : null;
        })(),
      };
    }, wrapH0);
    if (
      openReq.open &&
      !openReq.hasClose &&
      openReq.actions === 1 &&
      openReq.actionText === '回看成果' &&
      Math.abs(openReq.wrapH - openReq.wrapHBefore) < 2
    ) {
      ok('节点浮卡精简且不重排画布', JSON.stringify(openReq));
    } else {
      fail('节点浮卡精简且不重排画布', JSON.stringify(openReq));
    }
    const zoomBottomOpen = openReq.zoomBottom;
    await shot(page, 'round-node-selected');

    await page.locator('.wbp-node[data-node="node-backend"]').click();
    await page.waitForTimeout(350);
    const switched = await page.evaluate((zoomBottomBefore) => {
      const tools = document.querySelector('.wbp-canvas-tools');
      return {
        title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
        action: document.querySelector('.wbp-detail-actions button')?.textContent?.trim(),
        stillOpen: !!document.querySelector('.wbp-dock.is-open'),
        selected: document.querySelector('.wbp-node.is-on')?.getAttribute('data-node'),
        zoomBottom: tools ? Math.round(tools.getBoundingClientRect().bottom) : null,
        zoomBottomBefore,
      };
    }, zoomBottomOpen);
    if (
      switched.stillOpen &&
      switched.selected === 'node-backend' &&
      switched.action === '发布交付' &&
      switched.zoomBottom === switched.zoomBottomBefore
    ) {
      ok('换节点更新内容且缩放控件位置稳定', JSON.stringify(switched));
    } else {
      fail('换节点更新内容且缩放控件位置稳定', JSON.stringify(switched));
    }

    // 点同一节点收起
    await page.locator('.wbp-node[data-node="node-backend"]').click();
    await page.waitForTimeout(350);
    const sameClose = await page.evaluate(() => ({
      open: !!document.querySelector('.wbp-dock.is-open'),
      selected: document.querySelectorAll('.wbp-node.is-on').length,
      dockH: document.querySelector('.wbp-dock')
        ? getComputedStyle(document.querySelector('.wbp-dock')).height
        : null,
    }));
    if (!sameClose.open && sameClose.selected === 0 && sameClose.dockH === '0px') {
      ok('点同一节点收起且不预留空区', JSON.stringify(sameClose));
    } else {
      fail('点同一节点收起且不预留空区', JSON.stringify(sameClose));
    }

    // 再开后点空白收起
    await page.locator('.wbp-node[data-node="node-acceptance"]').click();
    await page.waitForTimeout(350);
    const todoBrief = await page.evaluate(() => ({
      title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
      key: document.querySelector('.wbp-detail-summary')?.textContent?.trim(),
      action: document.querySelector('.wbp-detail-actions button')?.textContent?.trim(),
    }));
    if (
      todoBrief.action === '查看任务说明' &&
      String(todoBrief.key || '').includes('前置')
    ) {
      ok('待开始浮卡突出前置条件', JSON.stringify(todoBrief));
    } else {
      fail('待开始浮卡突出前置条件', JSON.stringify(todoBrief));
    }
    await page.locator('.wbp-canvas').click({ position: { x: 40, y: 40 } });
    await page.waitForTimeout(350);
    const blankClose = await page.evaluate(() => ({
      open: !!document.querySelector('.wbp-dock.is-open'),
      selected: document.querySelectorAll('.wbp-node.is-on').length,
    }));
    if (!blankClose.open && blankClose.selected === 0) {
      ok('点画布空白收起', JSON.stringify(blankClose));
    } else {
      fail('点画布空白收起', JSON.stringify(blankClose));
    }

    // —— 5) 缩放 ——
    const beforeZoom = await page.evaluate(() => ({
      label: document.querySelector('.wbp-zoom-value')?.textContent?.trim(),
      toolsBottom: Math.round(
        document.querySelector('.wbp-canvas-tools')?.getBoundingClientRect().bottom ?? 0,
      ),
      slotH: document.querySelector('.wbp-canvas-slot')?.getBoundingClientRect().height ?? 0,
    }));
    await page.getByRole('button', { name: '放大画布' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '放大画布' }).click();
    await page.waitForTimeout(250);
    const afterZoom = await page.evaluate((before) => ({
      label: document.querySelector('.wbp-zoom-value')?.textContent?.trim(),
      toolsBottom: Math.round(
        document.querySelector('.wbp-canvas-tools')?.getBoundingClientRect().bottom ?? 0,
      ),
      slotH: document.querySelector('.wbp-canvas-slot')?.getBoundingClientRect().height ?? 0,
      before,
    }), beforeZoom);
    if (
      afterZoom.label === '110%' &&
      afterZoom.toolsBottom === afterZoom.before.toolsBottom &&
      afterZoom.slotH > afterZoom.before.slotH
    ) {
      ok('缩放生效且控件位置稳定', JSON.stringify(afterZoom));
    } else {
      fail('缩放生效且控件位置稳定', JSON.stringify(afterZoom));
    }

    // 1440×960 验收节点可见（必要时）
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByRole('button', { name: '缩小画布' }).click();
    await page.getByRole('button', { name: '缩小画布' }).click();
    await page.waitForTimeout(400);
    const vis1440 = await page.evaluate(() => {
      const wrap = document.querySelector('.wbp-canvas-wrap');
      const node = document.querySelector('.wbp-node[data-node="node-acceptance"]');
      if (!wrap || !node) return { ok: false };
      const wr = wrap.getBoundingClientRect();
      const nr = node.getBoundingClientRect();
      return {
        ok:
          nr.top >= wr.top - 1 &&
          nr.bottom <= wr.bottom + 1 &&
          nr.left >= wr.left - 1 &&
          nr.right <= wr.right + 1,
        zoom: document.querySelector('.wbp-zoom-value')?.textContent?.trim(),
      };
    });
    if (vis1440.ok) {
      ok('默认态验收节点可见 1440x960', JSON.stringify(vis1440));
    } else {
      fail('默认态验收节点可见 1440x960', JSON.stringify(vis1440));
    }

    report.untested.push('未手测教师端与发布/接收完整路径（本轮范围外）');
    report.untested.push('未测 API 实验（按要求不做）');
  } finally {
    const reportPath = path.join(outDir, 'round-home-zoom-detail.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('REPORT', reportPath);
    console.log('SHOTS', JSON.stringify(report.shots, null, 2));
    await browser.close();
  }

  const failed = report.checks.filter((c) => !c.pass);
  if (failed.length) {
    console.error('FAILED_COUNT', failed.length);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
