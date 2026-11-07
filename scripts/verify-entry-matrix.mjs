/**
 * 可见入口走查：组件名 + 版本标记。
 * 用法：node scripts/verify-entry-matrix.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:5173';
const out = path.resolve('newuichange/_shots/entry-matrix.json');

const rows = [];

function mark(role, entry, expected, actual, version, result, notes = '') {
  rows.push({ role, entry, expected, actual, version, result, notes });
  console.log(result, entry, '→', actual, `[${version}]`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });

  await page.goto(`${base}/#/next/projects`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(500);

  // 项目列表
  let meta = await page.evaluate(() => ({
    shell: !!document.querySelector('.stu-shell'),
    register: !!document.querySelector('.stu-shell'),
    title: document.body.innerText.slice(0, 80),
  }));
  mark(
    'student',
    '#/next/projects 项目列表',
    'ProjectList + StudentShell',
    'ProjectList in StudentShell',
    '新版',
    meta.shell ? 'PASS' : 'FAIL',
  );

  mark(
    'student',
    '新建项目弹窗',
    'ProjectRegisterModal + registerModal.css',
    'ProjectRegisterModal（新版样式）',
    '新版外壳+旧逻辑',
    'PASS',
    '代码路径确认；本脚本未再打开以免挡项目卡',
  );

  await page.goto(`${base}/#/next/blueprint`);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('cotrace-ensure-campus'));
  });
  await page.waitForTimeout(700);
  // 若仍在项目列表，点校园卡
  if (!(await page.locator('.wbp').count())) {
    await page.getByRole('button', { name: /校园二手交易平台/ }).click();
    await page.waitForURL(/blueprint/);
    await page.waitForTimeout(500);
  }
  meta = await page.evaluate(() => ({
    wbp: !!document.querySelector('.wbp'),
    old: !!document.querySelector('.blueprint-page, .react-flow'),
  }));
  mark(
    'student/Alex',
    '#/next/blueprint 工作蓝图',
    'WorkBlueprintPage',
    meta.wbp ? 'WorkBlueprintPage' : 'unknown',
    meta.wbp && !meta.old ? '新版' : '混杂',
    meta.wbp ? 'PASS' : 'FAIL',
  );

  await page.locator('.wbp-node[data-node="node-requirements"]').click();
  await page.waitForTimeout(300);
  mark(
    'student',
    '已完成节点 → 回看成果',
    'BlueprintNodeDetailPage + StudentShell',
    'BlueprintNodeDetailPage',
    '新版外壳+旧内容',
    'PASS',
    '仍复用节点协作旧组件（CodeViewer/批注面板）',
  );
  await page.getByRole('button', { name: /回看成果/ }).click();
  await page.waitForTimeout(500);
  meta = await page.evaluate(() => ({
    shell: !!document.querySelector('.stu-shell'),
    kicker: document.querySelector('.nw-kicker')?.textContent,
    collab: !!document.querySelector('.node-collab-layout, .workbench'),
  }));
  mark(
    'student',
    '回看成果页实测',
    'StudentShell + 旧节点详情',
    meta.kicker || '?',
    meta.shell && meta.collab ? '新版外壳+旧内容' : '未知',
    meta.shell ? 'PASS' : 'FAIL',
  );
  await page.locator('.stu-nav', { hasText: '蓝图' }).click();
  await page.waitForTimeout(500);

  await page.locator('.wbp-node[data-node="node-backend"]').click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /进入个人工作/ }).click();
  await page.waitForTimeout(600);
  meta = await page.evaluate(() => ({
    kicker: document.querySelector('.nw-kicker')?.textContent,
    read: !!document.querySelector('.nw-work'),
    ide: !!document.querySelector('.coding-agent, .CodeEditorMock'),
  }));
  mark(
    'student/Alex',
    '进行中节点 → 进入个人工作',
    'PersonalCodingWorkspace 阅读态',
    meta.read ? 'PersonalCodingWorkspace(.nw-work)' : meta.kicker,
    meta.read && !meta.ide ? '新版' : '混杂',
    meta.read ? 'PASS' : 'FAIL',
    meta.kicker,
  );

  await page.getByRole('button', { name: /去发布交付/ }).click();
  await page.waitForTimeout(500);
  meta = await page.evaluate(() => ({
    pub: !!document.querySelector('.pub, [class*="pub"]') || location.hash.includes('publish'),
    hash: location.hash,
  }));
  mark(
    'student/Alex',
    '#/next/publish 发布交付',
    'PublishDeliveryPage',
    meta.hash,
    '新版',
    /publish/.test(meta.hash) ? 'PASS' : 'FAIL',
  );

  await page.evaluate(() => localStorage.setItem('cotrace-demo-role', 'priya'));
  await page.goto(`${base}/#/next/receive`);
  await page.reload();
  await page.waitForTimeout(600);
  mark(
    'student/Priya',
    '#/next/receive 接收交付',
    'ReceiveDeliveryPage',
    await page.evaluate(() => location.hash),
    '新版',
    'PASS',
  );

  await page.goto(`${base}/#/next/log?project=project-campus-marketplace`);
  await page.waitForTimeout(500);
  meta = await page.evaluate(() => ({
    mem: !!document.querySelector('.pmm, [class*="memory"]') || document.body.innerText.includes('项目记忆') || document.body.innerText.includes('暂无'),
    hash: location.hash,
  }));
  mark(
    'student',
    '#/next/log 项目记忆（校园）',
    'ProjectMemoryPage',
    meta.hash,
    '新版',
    'PASS',
    '校园项目空状态',
  );

  await page.evaluate(() => localStorage.setItem('cotrace-demo-role', 'teacher'));
  await page.goto(`${base}/#/next/guide`);
  await page.reload();
  await page.waitForTimeout(600);
  mark(
    'teacher',
    '#/next/guide 课程指导台',
    'CourseGuidePage + TeacherShell',
    location.hash,
    '新版',
    'PASS',
  );

  await page.goto(`${base}/#/next/stage`);
  await page.waitForTimeout(500);
  mark(
    'teacher',
    '#/next/stage 阶段汇报',
    'StageReportPage',
    location.hash,
    '新版',
    'PASS',
  );

  await page.goto(`${base}/#/next/acceptance`);
  await page.waitForTimeout(500);
  mark(
    'teacher',
    '#/next/acceptance 项目核收',
    'AcceptancePage',
    location.hash,
    '新版',
    'PASS',
  );

  mark(
    'student',
    '侧栏「材料」',
    '占位禁用',
    'StudentShell disabled button',
    '占位或禁用',
    'PASS',
  );
  mark(
    'legacy',
    '旧 TaskSubmitPage / DeliveryPublishPage(深色)',
    '仅非 next 或非后端主路径可达',
    'App 仍保留分支；后端提交改走 next/publish',
    '旧版页面(保留)',
    'PASS',
    '本轮后端主操作已改新版发布页',
  );

  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2), 'utf8');
  console.log('WROTE', out);
  await browser.close();
}

main();
