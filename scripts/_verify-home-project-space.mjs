/**
 * 验收：启动 → 所有项目 → 刷新仍在首页 → 选项目进蓝图 → 返回所有项目
 * 截图：首页（无项目内侧栏）、项目空间（项目名 + 侧栏 + 所有项目）
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
  await page.waitForTimeout(400);
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
    // 1) 启动 Demo → 校园蓝图（项目空间）
    await page.goto(`${base}/`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${base}/`);
    await page.waitForTimeout(900);

    const start = await page.evaluate(() => ({
      hash: location.hash,
      hasBlueprint: !!document.querySelector('.wbp'),
      projectSpace: document.documentElement.querySelector('[data-project-space="true"]') != null,
      homeShell: !!document.querySelector('.stu-shell-home'),
      side: !!document.querySelector('.stu-side'),
      projectName: document.querySelector('.stu-project-name')?.textContent?.trim() || null,
      backAll: !!document.querySelector('.stu-back'),
      navLabels: [...document.querySelectorAll('.stu-nav')].map((el) =>
        el.textContent?.replace(/\s+/g, '').trim(),
      ),
    }));

    if (
      start.hash === '#/next/blueprint' &&
      start.hasBlueprint &&
      start.projectSpace &&
      !start.homeShell &&
      start.side &&
      start.projectName === '校园二手交易平台' &&
      start.backAll &&
      start.navLabels.includes('蓝图') &&
      start.navLabels.includes('工作') &&
      start.navLabels.includes('记录') &&
      start.navLabels.includes('材料')
    ) {
      ok('启动落点为项目空间蓝图', JSON.stringify(start));
    } else {
      fail('启动落点为项目空间蓝图', JSON.stringify(start));
    }
    await shot(page, 'home-layout-project-space');

    // 2) 所有项目 → 首页（无侧栏）
    await page.getByRole('button', { name: '所有项目' }).click();
    await page.waitForTimeout(500);

    const onHome = await page.evaluate(() => ({
      hash: location.hash,
      title: document.querySelector('.pl-head h1')?.textContent?.trim(),
      homeShell: !!document.querySelector('.stu-shell-home'),
      projectSpace: document.querySelector('[data-project-space="true"]') != null,
      side: !!document.querySelector('.stu-side'),
      cards: document.querySelectorAll('.pl-card').length,
      newProject: !!document.querySelector('.pl-primary'),
    }));

    if (
      onHome.hash === '#/next/projects' &&
      onHome.title === '所有项目' &&
      onHome.homeShell &&
      !onHome.projectSpace &&
      !onHome.side &&
      onHome.cards >= 2 &&
      onHome.newProject
    ) {
      ok('进入所有项目首页且无项目内侧栏', JSON.stringify(onHome));
    } else {
      fail('进入所有项目首页且无项目内侧栏', JSON.stringify(onHome));
    }

    // 3) 刷新仍在首页
    await page.reload();
    await page.waitForTimeout(700);
    const afterRefresh = await page.evaluate(() => ({
      hash: location.hash,
      homeShell: !!document.querySelector('.stu-shell-home'),
      side: !!document.querySelector('.stu-side'),
      title: document.querySelector('.pl-head h1')?.textContent?.trim(),
    }));
    if (
      afterRefresh.hash === '#/next/projects' &&
      afterRefresh.homeShell &&
      !afterRefresh.side &&
      afterRefresh.title === '所有项目'
    ) {
      ok('刷新仍在首页', JSON.stringify(afterRefresh));
    } else {
      fail('刷新仍在首页', JSON.stringify(afterRefresh));
    }
    await shot(page, 'home-layout-projects');

    // 4) 选择校园项目 → 项目蓝图（项目空间）
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForTimeout(800);

    const inProject = await page.evaluate(() => ({
      hash: location.hash,
      hasBlueprint: !!document.querySelector('.wbp'),
      projectSpace: document.querySelector('[data-project-space="true"]') != null,
      homeShell: !!document.querySelector('.stu-shell-home'),
      side: !!document.querySelector('.stu-side'),
      projectName: document.querySelector('.stu-project-name')?.textContent?.trim() || null,
      backAll: document.querySelector('.stu-back')?.textContent?.replace(/\s+/g, '').trim(),
      blueprintOn: !!document.querySelector('.stu-nav.is-on'),
      blueprintLabel: document
        .querySelector('.stu-nav.is-on')
        ?.textContent?.replace(/\s+/g, '')
        .trim(),
    }));

    if (
      inProject.hash === '#/next/blueprint' &&
      inProject.hasBlueprint &&
      inProject.projectSpace &&
      !inProject.homeShell &&
      inProject.side &&
      inProject.projectName === '校园二手交易平台' &&
      inProject.backAll === '所有项目' &&
      inProject.blueprintLabel === '蓝图'
    ) {
      ok('选择项目进入项目空间蓝图', JSON.stringify(inProject));
    } else {
      fail('选择项目进入项目空间蓝图', JSON.stringify(inProject));
    }

    // 刷新蓝图仍在项目空间
    await page.reload();
    await page.waitForTimeout(800);
    const refreshBlueprint = await page.evaluate(() => ({
      hash: location.hash,
      projectSpace: document.querySelector('[data-project-space="true"]') != null,
      hasBlueprint: !!document.querySelector('.wbp'),
      projectName: document.querySelector('.stu-project-name')?.textContent?.trim() || null,
    }));
    if (
      refreshBlueprint.hash === '#/next/blueprint' &&
      refreshBlueprint.projectSpace &&
      refreshBlueprint.hasBlueprint &&
      refreshBlueprint.projectName === '校园二手交易平台'
    ) {
      ok('刷新蓝图仍在项目空间', JSON.stringify(refreshBlueprint));
    } else {
      fail('刷新蓝图仍在项目空间', JSON.stringify(refreshBlueprint));
    }

    // 5) 返回所有项目
    await page.getByRole('button', { name: '所有项目' }).click();
    await page.waitForTimeout(500);
    const backHome = await page.evaluate(() => ({
      hash: location.hash,
      homeShell: !!document.querySelector('.stu-shell-home'),
      side: !!document.querySelector('.stu-side'),
    }));
    if (backHome.hash === '#/next/projects' && backHome.homeShell && !backHome.side) {
      ok('返回所有项目', JSON.stringify(backHome));
    } else {
      fail('返回所有项目', JSON.stringify(backHome));
    }

    // 教师落到指导台（学生首页 hash）
    await page.evaluate(() => {
      localStorage.setItem('cotrace-demo-role', 'teacher');
    });
    // 必须整页重载，才能让 demoRole 内存缓存从 localStorage 重新读取
    await page.goto(`${base}/#/next/projects`);
    await page.reload();
    await page.waitForTimeout(900);
    const teacherLand = await page.evaluate(() => ({
      hash: location.hash,
      guide: !!document.querySelector('[data-teacher-place="guide"]'),
    }));
    if (teacherLand.hash === '#/next/guide' && teacherLand.guide) {
      ok('教师打开学生首页 hash 落到指导台', JSON.stringify(teacherLand));
    } else {
      fail('教师打开学生首页 hash 落到指导台', JSON.stringify(teacherLand));
    }

    // 恢复学生角色，避免污染后续本地调试
    await page.evaluate(() => {
      localStorage.setItem('cotrace-demo-role', 'alex');
    });

    report.untested.push('未手测新建项目完整流程与 SeatFlow 记录页细节');
    report.untested.push('未测发布/接收完整交接路径（本轮范围外）');
  } finally {
    const reportPath = path.join(outDir, 'home-project-space.json');
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
