/**
 * P0 回归：蓝图浮层 + 个人工作区材料/批注 + Alex→Priya 交接。
 * 用法：node scripts/verify-p0-regression.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('newuichange/_shots');
const framesRoot = path.join(outDir, '_frames_p0');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(framesRoot, { recursive: true });

const report = {
  base,
  at: new Date().toISOString(),
  checks: [],
  recordings: [],
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

async function reset(page) {
  await page.goto(`${base}/#/next/projects`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(500);
}

async function shot(page, name, size) {
  await page.setViewportSize(size);
  await page.waitForTimeout(280);
  const file = path.join(
    outDir,
    `${name}-${size.width}x${size.height}.png`,
  );
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function recordFrames(page, name, action) {
  const dir = path.join(framesRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  const paths = [];
  const before = path.join(dir, '00-before.png');
  await page.screenshot({ path: before, fullPage: false });
  paths.push(before);
  await action();
  for (let i = 1; i <= 8; i += 1) {
    await page.waitForTimeout(90);
    const p = path.join(dir, `${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: p, fullPage: false });
    paths.push(p);
  }
  await page.waitForTimeout(250);
  const after = path.join(dir, '99-after.png');
  await page.screenshot({ path: after, fullPage: false });
  paths.push(after);
  report.recordings.push({ name, frames: paths });
  return paths;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1024 },
  });

  try {
    await reset(page);
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForURL(/blueprint/);
    await page.waitForTimeout(700);

    // —— 默认态：验收节点完整可见（两分辨率）——
    for (const size of [
      { width: 1536, height: 1024 },
      { width: 1440, height: 960 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(350);
      const vis = await page.evaluate(() => {
        const wrap = document.querySelector('.wbp-canvas-wrap');
        const node = document.querySelector(
          '.wbp-node[data-node="node-acceptance"]',
        );
        const dock = document.querySelector('.wbp-dock');
        if (!wrap || !node) return { ok: false, reason: 'missing' };
        const wr = wrap.getBoundingClientRect();
        const nr = node.getBoundingClientRect();
        const dockH = dock?.getBoundingClientRect().height ?? -1;
        const fully =
          nr.top >= wr.top - 1 &&
          nr.bottom <= wr.bottom + 1 &&
          nr.left >= wr.left - 1 &&
          nr.right <= wr.right + 1;
        return {
          ok: fully,
          dockH,
          nodeTop: Math.round(nr.top),
          nodeBottom: Math.round(nr.bottom),
          wrapBottom: Math.round(wr.bottom),
          wrapH: Math.round(wr.height),
        };
      });
      const shotPath = await shot(page, 'blueprint-default-accept', size);
      if (vis.ok && vis.dockH < 40) {
        ok(
          `默认态验收节点可见 ${size.width}x${size.height}`,
          `${JSON.stringify(vis)} · ${shotPath}`,
        );
      } else {
        fail(
          `默认态验收节点可见 ${size.width}x${size.height}`,
          `${JSON.stringify(vis)} · ${shotPath}`,
        );
      }
    }

    await page.setViewportSize({ width: 1536, height: 1024 });

    // —— 录屏帧：默认 → 点节点 → 切换 → 关闭 ——
    const blueprintFrames = await recordFrames(page, 'blueprint-detail-flow', async () => {
      await page.locator('.wbp-node[data-node="node-requirements"]').click();
      await page.waitForTimeout(400);
      await page.locator('.wbp-node[data-node="node-backend"]').click();
      await page.waitForTimeout(350);
      await page.locator('.wbp-node[data-node="node-frontend"]').click();
      await page.waitForTimeout(350);
      await page.getByRole('button', { name: '关闭节点详情' }).click();
      await page.waitForTimeout(300);
    });
    ok('蓝图交互连续截帧', blueprintFrames.join(' | '));

    // 结构断言：浮层不挤压
    await page.locator('.wbp-node[data-node="node-backend"]').click();
    await page.waitForTimeout(400);
    const overlay = await page.evaluate(() => {
      const wrap = document.querySelector('.wbp-canvas-wrap');
      const dock = document.querySelector('.wbp-dock');
      const detail = document.querySelector('.wbp-detail');
      const beforeH = wrap?.getBoundingClientRect().height ?? 0;
      return {
        dockOpen: dock?.classList.contains('is-open') ?? false,
        detailOpacity: detail ? getComputedStyle(detail).opacity : null,
        wrapH: Math.round(beforeH),
        dockPosition: dock ? getComputedStyle(dock).position : null,
        hasClose: !!document.querySelector('.wbp-detail-close'),
        title: document.querySelector('.wbp-detail h2')?.textContent?.trim(),
      };
    });
    if (
      overlay.dockOpen &&
      Number(overlay.detailOpacity) > 0.9 &&
      overlay.dockPosition === 'absolute' &&
      overlay.hasClose
    ) {
      ok('详情为底部浮层', JSON.stringify(overlay));
    } else {
      fail('详情为底部浮层', JSON.stringify(overlay));
    }

    // Esc 关闭 + 焦点回节点
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const afterEsc = await page.evaluate(() => ({
      open: document.querySelector('.wbp-dock.is-open') != null,
      focus:
        document.activeElement?.getAttribute?.('data-node') ??
        document.activeElement?.className,
    }));
    if (!afterEsc.open && afterEsc.focus === 'node-backend') {
      ok('Esc 关闭并回焦节点', JSON.stringify(afterEsc));
    } else {
      fail('Esc 关闭并回焦节点', JSON.stringify(afterEsc));
    }

    // —— 进入个人工作区 ——
    await page.locator('.wbp-node[data-node="node-backend"]').click();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: /进入个人工作/ }).click();
    await page.waitForTimeout(700);
    const workShot = await shot(page, 'coding-work-read', {
      width: 1536,
      height: 1024,
    });
    const workMeta = await page.evaluate(() => ({
      shell: !!document.querySelector('.stu-shell'),
      kicker: document.querySelector('.nw-kicker')?.textContent?.trim(),
      hasIdeSubmit: !!Array.from(document.querySelectorAll('button')).find((b) =>
        /提交任务/.test(b.textContent || ''),
      ),
      hasPublish: !!Array.from(document.querySelectorAll('button')).find((b) =>
        /去发布交付|发布交付/.test(b.textContent || ''),
      ),
      fileCount: document.querySelectorAll('.nw-file').length,
      annoCount: document.querySelectorAll('.nw-anno').length,
      aiLock: document.querySelector('.nw-ai-lock')?.textContent?.trim(),
    }));
    if (
      workMeta.shell &&
      /个人工作区/.test(workMeta.kicker || '') &&
      /当前视角 Alex/.test(workMeta.kicker || '') &&
      !/负责人 Maya Chen · 你/.test(workMeta.kicker || '') &&
      !workMeta.hasIdeSubmit &&
      workMeta.fileCount > 0 &&
      workMeta.annoCount > 0
    ) {
      ok('个人工作区阅读态（Alex 视角）', `${JSON.stringify(workMeta)} · ${workShot}`);
    } else {
      fail('个人工作区阅读态（Alex 视角）', `${JSON.stringify(workMeta)} · ${workShot}`);
    }

    // 录屏帧：切文件 → 点批注 → 证据
    const workFrames = await recordFrames(page, 'workspace-anno-flow', async () => {
      const files = page.locator('.nw-file');
      if ((await files.count()) > 1) await files.nth(1).click();
      await page.waitForTimeout(250);
      const lineAnno = page.locator('.nw-anno', {
        hasText: /ITEM_NOT_AVAILABLE|orderService/,
      });
      if (await lineAnno.count()) await lineAnno.first().click();
      else await page.locator('.nw-anno').first().click();
      await page.waitForTimeout(400);
    });
    const annoState = await page.evaluate(() => {
      const onAnno = document.querySelector('.nw-anno.is-on');
      const code = document.querySelector('.nw-code');
      const highlight = document.querySelectorAll(
        '.is-highlight, .line-highlight, .code-line.is-active, [data-highlighted]',
      ).length;
      const fileOn = document.querySelector('.nw-file.is-on')?.textContent?.trim();
      const explain = document.querySelector('.nw-ai-body')?.textContent?.trim();
      return {
        anno: onAnno?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120),
        fileOn,
        highlight,
        explain: explain?.slice(0, 160),
        hasCode: !!code,
      };
    });
    if (annoState.anno && annoState.fileOn && /orderService|针对批注/.test(
      `${annoState.fileOn} ${annoState.explain || ''}`,
    )) {
      ok('批注回到材料证据', `${JSON.stringify(annoState)} · frames=${workFrames.length}`);
    } else {
      fail('批注回到材料证据', JSON.stringify(annoState));
    }
    ok('工作区交互连续截帧', workFrames.join(' | '));

    // —— Alex 发布 → Priya 接收 → 联调进行中 ——
    await page.getByRole('button', { name: /去发布交付/ }).click();
    await page.waitForTimeout(600);
    const pubBtn = page.locator('button', { hasText: /^发布交付$/ });
    if (await pubBtn.count()) {
      await pubBtn.first().click();
      await page.waitForTimeout(500);
      const pubOk = await page.evaluate(
        () =>
          document.body.innerText.includes('等待确认接收') ||
          document.body.innerText.includes('等待接收') ||
          document.body.innerText.includes('已发布'),
      );
      if (pubOk) ok('Alex 发布交付', '等待确认接收/已发布');
      else fail('Alex 发布交付', '未见回执');
    } else {
      fail('Alex 发布交付', '无发布按钮');
    }

    await page.evaluate(() =>
      localStorage.setItem('cotrace-demo-role', 'priya'),
    );
    await page.goto(`${base}/#/next/receive`);
    await page.reload();
    await page.waitForTimeout(700);
    const recvBtn = page.locator('button', { hasText: /确认接收/ });
    if (await recvBtn.count()) {
      await recvBtn.first().click();
      await page.waitForTimeout(600);
      ok('Priya 确认接收', 'clicked');
    } else {
      fail('Priya 确认接收', '无确认接收按钮');
    }

    await page.goto(`${base}/#/next/blueprint`);
    await page.waitForTimeout(700);
    const live = await page.evaluate(() => {
      const node = document.querySelector(
        '.wbp-node[data-node="node-integration"]',
      );
      return {
        text: node?.textContent?.replace(/\s+/g, ' ').trim(),
        badge: document
          .querySelector('.wbp-delivery-badge')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      };
    });
    const liveShot = await shot(page, 'blueprint-received-live', {
      width: 1536,
      height: 1024,
    });
    if (
      /进行中/.test(live.text || '') &&
      /已接手|已接收/.test(live.badge || '')
    ) {
      ok('联调进入进行中', `${JSON.stringify(live)} · ${liveShot}`);
    } else {
      fail('联调进入进行中', `${JSON.stringify(live)} · ${liveShot}`);
    }

    report.untested.push(
      '旧版 #/blueprint（非 next）画布未走查',
      '教师指导台反馈发送后学生侧回看未走查',
      '真实摄像头录屏文件未导出（本轮以连续截帧代替）',
      '新建自定义项目全流程未走查',
    );
  } catch (err) {
    fail('脚本异常', String(err));
  } finally {
    const reportPath = path.join(outDir, 'p0-regression.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('REPORT', reportPath);
    await browser.close();
  }
}

main();
