/**
 * 跨端交付链验收：材料相符 / 错版 / 无关 / 证据不足、换料复查、
 * 风险发布、修订重发、旧版不可接收、教师反馈回流。
 * mock 默认；若 COTRACE_AI_MODE=live 则顺带打真实模型并记录。
 */

import assert from 'node:assert/strict';
import {
  assertMaterialBodiesReadable,
  loadMaterialBody,
} from '../server/materials/bodies.ts';
import { listDemoMaterials } from '../server/materials/catalog.ts';
import {
  CAMPUS_INTEGRATION_GOAL,
  resolveAiMode,
  runHandoffAnalysis,
  runHandoffFocus,
  runHelpContext,
} from '../server/ai/index.ts';
import {
  applyAnalysisToDelivery,
  publishDeliveryChain,
  receiveDeliveryChain,
  requestRevisionChain,
  selectMaterials,
} from '../src/data/deliveryChain.ts';
import { createDraftDelivery } from '../src/data/handoffDemoSeed.ts';
import {
  appendProcessEvent,
  getAllFeedbacks,
  getProcessEvents,
  resetProcessEventStore,
  sendTeacherFeedback,
} from '../src/data/processEventStore.ts';
import type { DeliveryAnalysis } from '../src/types/handoff.ts';

const report: Array<Record<string, unknown>> = [];

function logCase(name: string, data: Record<string, unknown>) {
  report.push({ name, ...data });
  console.log(`✔ ${name}`, JSON.stringify(data));
}

assertMaterialBodiesReadable();
assert.equal(listDemoMaterials().length, 7);

async function analyzePair(codeId: string, chatId: string) {
  const result = await runHandoffAnalysis({
    projectId: 'project-campus-marketplace',
    taskId: 'node-backend',
    codeMaterialId: codeId,
    chatMaterialId: chatId,
  });
  assert.equal(result.ok, true, `analysis failed for ${codeId}+${chatId}`);
  if (!result.ok) throw new Error(result.message);
  return result.result;
}

// 1) 相符
{
  const result = await analyzePair('mat-code-order-v04', 'mat-chat-order-v04');
  assert.equal(result.verdict, 'match');
  assert.match(result.collaborationLog.summary, /订单|自购|测试/);
  assert.ok(result.citations.length > 0);
  logCase('材料相符', {
    verdict: result.verdict,
    provider: result.provider,
    model: result.modelLabel,
    latencyMs: result.latencyMs,
  });
}

// 2) 错版
{
  const result = await analyzePair('mat-code-order-v03', 'mat-chat-order-v03');
  assert.equal(result.verdict, 'suspect-wrong-version');
  assert.ok(
    result.differences.some((item) =>
      /矛盾|旧|缺少|错版|v0\.3|sold|售出|自购|条件更新/.test(item),
    ),
  );
  logCase('材料错版', {
    verdict: result.verdict,
    differences: result.differences,
    provider: result.provider,
  });
}

// 3) 无关
{
  const result = await analyzePair(
    'mat-code-unrelated-frontend',
    'mat-chat-unrelated-seat',
  );
  assert.equal(result.verdict, 'irrelevant');
  assert.equal(result.collaborationLog.humanActions.length, 0);
  assert.ok(/无关|虚构/.test(result.collaborationLog.summary));
  logCase('材料无关', {
    verdict: result.verdict,
    summary: result.collaborationLog.summary,
    provider: result.provider,
  });
}

// 4) 证据不足
{
  const result = await analyzePair(
    'mat-code-order-v04',
    'mat-chat-order-no-test',
  );
  assert.equal(result.verdict, 'insufficient-evidence');
  assert.ok(result.collaborationLog.openItems.some((item) => /测试/.test(item)));
  logCase('证据不足', {
    verdict: result.verdict,
    openItems: result.collaborationLog.openItems,
    provider: result.provider,
  });
}

// 5) 换料复查 + 风险发布 + 修订重发 + 旧版不可接收 + 反馈回流
{
  resetProcessEventStore();
  let delivery = createDraftDelivery();
  delivery = selectMaterials(
    delivery,
    'mat-code-order-v03',
    'mat-chat-order-v03',
  );
  const token1 = delivery.analysisRequestToken;
  const wrong = await analyzePair(
    delivery.selectedCodeMaterialId!,
    delivery.selectedChatMaterialId!,
  );
  const analysis1: DeliveryAnalysis = {
    analysisId: 'a1',
    requestToken: token1,
    ...wrong,
    collaborationLog: { ...wrong.collaborationLog, manuallyEdited: false },
    codeMaterialId: delivery.selectedCodeMaterialId!,
    chatMaterialId: delivery.selectedChatMaterialId!,
    createdAt: new Date().toISOString(),
  };
  delivery = applyAnalysisToDelivery(delivery, analysis1, token1);
  assert.equal(delivery.analysis?.verdict, 'suspect-wrong-version');

  // 换料 → 旧分析作废
  delivery = selectMaterials(
    delivery,
    'mat-code-order-v04',
    'mat-chat-order-v04',
  );
  assert.equal(delivery.analysisStale, true);
  assert.equal(delivery.analysis, null);
  assert.equal(delivery.collaborationLog, null);

  const token2 = delivery.analysisRequestToken;
  const match = await analyzePair(
    delivery.selectedCodeMaterialId!,
    delivery.selectedChatMaterialId!,
  );
  const analysis2: DeliveryAnalysis = {
    analysisId: 'a2',
    requestToken: token2,
    ...match,
    collaborationLog: { ...match.collaborationLog, manuallyEdited: false },
    codeMaterialId: delivery.selectedCodeMaterialId!,
    chatMaterialId: delivery.selectedChatMaterialId!,
    createdAt: new Date().toISOString(),
  };
  // 迟到的错版分析应丢弃
  delivery = applyAnalysisToDelivery(delivery, analysis1, token1);
  assert.equal(delivery.analysis, null);
  delivery = applyAnalysisToDelivery(delivery, analysis2, token2);
  assert.equal(delivery.analysis?.verdict, 'match');

  // 人工修订后发布
  delivery = {
    ...delivery,
    collaborationLog: {
      ...delivery.collaborationLog!,
      summary: `${delivery.collaborationLog!.summary}（Alex 修订）`,
      manuallyEdited: true,
    },
    brief: `${delivery.brief}（Alex 修订）`,
  };

  const published = publishDeliveryChain(delivery, {
    actorId: delivery.publisherId,
    now: '2026-11-06T12:00:00.000Z',
    riskAcknowledged: false,
  });
  assert.equal(published.ok, true);
  if (!published.ok) throw new Error('publish');
  delivery = published.delivery;
  const version1 = published.versionId;

  // Priya 接手标注：业务层附带本版确认日志
  {
    const codeBody = loadMaterialBody(delivery.selectedCodeMaterialId!)!.body;
    const chatBody = loadMaterialBody(delivery.selectedChatMaterialId!)!.body;
    const sharedLog = {
      summary: delivery.collaborationLog?.summary || '',
      humanActions: delivery.collaborationLog?.humanActions || [],
      aiActions: delivery.collaborationLog?.aiActions || [],
      openItems: delivery.collaborationLog?.openItems || [],
    };
    const focus = await runHandoffFocus({
      deliveryId: delivery.id,
      versionId: version1,
      projectId: delivery.projectId,
      collaborationSummary: sharedLog.summary,
      risks: delivery.analysis?.risks || [],
      riskNotes: delivery.riskNotes,
      riskAcknowledged: delivery.riskAcknowledged,
      sharedLog,
      integrationGoal: CAMPUS_INTEGRATION_GOAL,
      codeBody,
      chatBody,
      codeMaterialId: delivery.selectedCodeMaterialId!,
      chatMaterialId: delivery.selectedChatMaterialId!,
    });
    assert.equal(focus.ok, true);
    if (!focus.ok) throw new Error(focus.message);
    assert.ok(focus.result.items.length >= 1 && focus.result.items.length <= 3);
    assert.ok(
      !focus.result.items.some((item) => /确认公开/.test(item.title)),
    );
    assert.ok(focus.result.items.every((item) => item.uncertainty !== undefined));
    logCase('接手关注项', {
      count: focus.result.items.length,
      titles: focus.result.items.map((item) => item.title),
      provider: focus.result.provider,
    });
  }

  // Priya 提修改意见
  const revision = requestRevisionChain(
    delivery,
    delivery.receiverId,
    '请补充 ITEM_NOT_AVAILABLE 与页面提示对照说明',
    '2026-11-06T12:10:00.000Z',
    'mat-chat-order-v04#frag-chat-tests',
    version1,
  );
  assert.equal(revision.ok, true);
  if (!revision.ok) throw new Error('revision');
  delivery = revision.delivery;
  assert.equal(delivery.status, 'needs-revision');

  // 重发新版本
  delivery = selectMaterials(
    delivery,
    'mat-code-order-v04',
    'mat-chat-order-v04',
  );
  const token3 = delivery.analysisRequestToken;
  const again = await analyzePair(
    delivery.selectedCodeMaterialId!,
    delivery.selectedChatMaterialId!,
  );
  delivery = applyAnalysisToDelivery(
    delivery,
    {
      analysisId: 'a3',
      requestToken: token3,
      ...again,
      collaborationLog: {
        ...again.collaborationLog,
        summary: '修订后发布：补充错误码对照说明。',
        manuallyEdited: true,
      },
      codeMaterialId: delivery.selectedCodeMaterialId!,
      chatMaterialId: delivery.selectedChatMaterialId!,
      createdAt: new Date().toISOString(),
    },
    token3,
  );
  const published2 = publishDeliveryChain(delivery, {
    actorId: delivery.publisherId,
    now: '2026-11-06T12:20:00.000Z',
  });
  assert.equal(published2.ok, true);
  if (!published2.ok) throw new Error('republish');
  delivery = published2.delivery;
  const version2 = published2.versionId;
  assert.notEqual(version1, version2);
  assert.equal(delivery.publishedVersions.length, 2);

  // 旧版本不能确认
  const stale = receiveDeliveryChain(
    delivery,
    delivery.receiverId,
    '2026-11-06T12:30:00.000Z',
    version1,
  );
  assert.equal(stale.ok, false);
  if (stale.ok) throw new Error('stale should fail');
  assert.equal(stale.reason, 'stale-version');

  const received = receiveDeliveryChain(
    delivery,
    delivery.receiverId,
    '2026-11-06T12:31:00.000Z',
    version2,
  );
  assert.equal(received.ok, true);
  if (!received.ok) throw new Error('receive');
  delivery = received.delivery;
  assert.equal(delivery.status, 'received');

  // 教师反馈回流
  const helpId = 'event-student-help-test';
  appendProcessEvent({
    id: helpId,
    projectId: delivery.projectId,
    dateLabel: '今天',
    title: '联调求助 · 待教师指导',
    statusLabel: '待指导',
    statusTone: 'warning',
    kind: 'student-help',
    summary: '页面提示和错误码对不上',
    authorLabel: 'Priya · 提交求助',
    deliveryId: delivery.id,
    versionId: version2,
    evidence: [
      {
        id: 'ev-help-1',
        kind: 'student-edit',
        label: '学生原文',
        summary: '页面提示和错误码对不上',
        at: '2026-11-06T12:32:00.000Z',
        linkLabel: '查看原文',
      },
    ],
  });
  const sharedLogForHelp = {
    summary: delivery.collaborationLog?.summary || '',
    humanActions: delivery.collaborationLog?.humanActions || [],
    aiActions: delivery.collaborationLog?.aiActions || [],
    openItems: delivery.collaborationLog?.openItems || [],
  };
  const helpAi = await runHelpContext({
    mode: 'teacher-brief',
    projectId: delivery.projectId,
    taskId: delivery.integrationNodeId,
    deliveryVersionId: version2,
    studentText: '页面提示和错误码对不上',
    collaborationSummary: sharedLogForHelp.summary,
    sharedEvidence: sharedLogForHelp.openItems,
    selectedEvidence: ['页面提示和错误码对不上'],
    adoptedSupplements: [],
    sharedLog: sharedLogForHelp,
  });
  assert.equal(helpAi.ok, true);
  if (helpAi.ok) {
    assert.equal(helpAi.result.clarifyPrompts.length, 0);
    assert.ok(helpAi.result.situationSummary.length > 0);
  }

  const feedback = sendTeacherFeedback(
    helpId,
    '请先核对接口版本，再补错误码与页面提示对照。',
  );
  assert.equal(feedback.ok, true);
  const events = getProcessEvents();
  assert.ok(events.some((event) => event.kind === 'teacher-feedback'));
  assert.ok(getAllFeedbacks().some((item) => item.eventId === helpId));

  logCase('修订重发与反馈回流', {
    version1,
    version2,
    received: delivery.status,
    helpProvider: helpAi.ok ? helpAi.result.provider : 'fail',
    feedbackOk: feedback.ok,
    eventKinds: events.map((event) => event.kind),
  });
}

// 6) 带风险发布（错版）
{
  let delivery = createDraftDelivery();
  delivery = selectMaterials(
    delivery,
    'mat-code-order-v03',
    'mat-chat-order-v04',
  );
  const token = delivery.analysisRequestToken;
  const wrongMix = await analyzePair(
    delivery.selectedCodeMaterialId!,
    delivery.selectedChatMaterialId!,
  );
  delivery = applyAnalysisToDelivery(
    delivery,
    {
      analysisId: 'risk',
      requestToken: token,
      ...wrongMix,
      collaborationLog: { ...wrongMix.collaborationLog, manuallyEdited: false },
      codeMaterialId: delivery.selectedCodeMaterialId!,
      chatMaterialId: delivery.selectedChatMaterialId!,
      createdAt: new Date().toISOString(),
    },
    token,
  );
  const blocked = publishDeliveryChain(delivery, {
    actorId: delivery.publisherId,
    now: '2026-11-06T13:00:00.000Z',
    riskAcknowledged: false,
  });
  assert.equal(blocked.ok, false);

  const forced = publishDeliveryChain(delivery, {
    actorId: delivery.publisherId,
    now: '2026-11-06T13:01:00.000Z',
    riskAcknowledged: true,
    riskNotes: '已知代码可能为旧版，接收方需自行核对',
  });
  assert.equal(forced.ok, true);
  if (!forced.ok) throw new Error('risk publish');
  assert.equal(forced.delivery.riskAcknowledged, true);
  logCase('带风险发布', {
    verdict: delivery.analysis?.verdict,
    riskNotes: forced.delivery.riskNotes,
  });
}

// 正文可读抽检
{
  const code = loadMaterialBody('mat-code-order-v04');
  const chat = loadMaterialBody('mat-chat-order-v04');
  assert.ok(code && /SELF_PURCHASE_NOT_ALLOWED/.test(code.body));
  assert.ok(chat && /测试/.test(chat.body));
}

console.log('\nAI mode:', resolveAiMode());
console.log('REPORT_JSON', JSON.stringify(report, null, 2));
console.log('delivery-chain verify: ok');
