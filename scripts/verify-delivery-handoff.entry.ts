/**
 * 交付状态链：发布一条、双方读同一 id、接收前后联调节点、拒绝重复、重置回草稿。
 * 另覆盖本地 mock「整理接手提示」成功 / 越界拒绝 / 失败后仍可手填发布。
 * 由 scripts/verify-delivery-handoff.mjs 用 esbuild 打包后执行。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyReceivedIntegration,
  publishDeliveryRecord,
  readSharedDelivery,
  receiveDeliveryRecord,
  resolveVisibleDelivery,
  withDeliveryDraft,
} from '../src/data/deliveryHandoff.ts';
import {
  clearAllSubmissions,
  commitHandoffDelivery,
  getHandoffDelivery,
  getSubmission,
  listSubmissionNodeIds,
} from '../src/data/demoSubmission.ts';
import {
  organizeHandoffBriefMock,
  validateHandoffBriefOutput,
} from '../src/data/handoffBriefMock.ts';
import {
  assertHandoffBriefSourcesReadable,
  HANDOFF_BRIEF_DEFAULT_SOURCE_IDS,
} from '../src/data/handoffBriefSources.ts';
import { createDraftDelivery } from '../src/data/handoffDemoSeed.ts';
import type { DemoSubmission } from '../src/data/demoSubmission.ts';

/** npm run verify:delivery 从仓库根目录执行 */
const apiSpecPath = path.join(
  process.cwd(),
  'public',
  'docs',
  'sources',
  '04_订单API接口规范.md',
);
assert.ok(fs.existsSync(apiSpecPath), 'missing API spec markdown');
assert.ok(
  fs.readFileSync(apiSpecPath, 'utf8').trim().length > 0,
  'API spec markdown empty',
);

const sources = assertHandoffBriefSourcesReadable();
assert.equal(sources.bodies.length, 3);
for (const body of sources.bodies) {
  assert.ok(body.body.trim().length > 0, `empty source ${body.id}`);
}

const mockOk = organizeHandoffBriefMock({
  sourceIds: HANDOFF_BRIEF_DEFAULT_SOURCE_IDS,
  mode: 'success',
});
assert.equal(mockOk.ok, true);
if (!mockOk.ok) throw new Error('mock success');
assert.match(mockOk.payload.brief, /ITEM_NOT_AVAILABLE/);
assert.match(mockOk.payload.brief, /商品详情页/);
assert.match(mockOk.payload.brief, /未见前端联调/);
assert.ok(
  mockOk.payload.evidenceAndOpen.some((item) => item.kind === 'unverified'),
);
assert.equal(validateHandoffBriefOutput(mockOk.payload).ok, true);

const mockCode = organizeHandoffBriefMock({ mode: 'code-request' });
assert.equal(mockCode.ok, false);
if (mockCode.ok) throw new Error('code-request should fail');
assert.equal(mockCode.reason, 'out-of-bounds');

const mockFail = organizeHandoffBriefMock({ mode: 'failure' });
assert.equal(mockFail.ok, false);
if (mockFail.ok) throw new Error('failure mode');
assert.equal(mockFail.reason, 'generation-failed');

{
  const manual = createDraftDelivery();
  const priorBrief = '手填：先核对 ITEM_NOT_AVAILABLE 文案，未见前端联调结果。';
  const edited = withDeliveryDraft(manual, {
    summary: manual.summary,
    brief: priorBrief,
    changes: [
      {
        body: '手填变更说明',
        kind: 'fact',
        sourceIds: [...HANDOFF_BRIEF_DEFAULT_SOURCE_IDS],
      },
    ],
    downstreamImpact: [],
    suggestedChecks: [],
    evidenceAndOpen: [
      {
        body: '未验证：未见前端联调结果',
        kind: 'unverified',
        sourceIds: [HANDOFF_BRIEF_DEFAULT_SOURCE_IDS[2]!],
      },
    ],
    sourceIds: [...HANDOFF_BRIEF_DEFAULT_SOURCE_IDS],
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error('manual draft');
  // 模拟失败后不覆盖：仍用 edited 发布
  const publishedManual = publishDeliveryRecord(
    edited.delivery,
    '2026-11-06T05:00:00.000Z',
    edited.delivery.publisherId,
  );
  assert.equal(publishedManual.ok, true);
  if (!publishedManual.ok) throw new Error('manual publish');
  assert.equal(publishedManual.delivery.brief, priorBrief);
  assert.equal(publishedManual.delivery.summary, manual.summary);
  assert.ok(publishedManual.delivery.brief !== publishedManual.delivery.summary);
}

const NOW = '2026-11-06T04:00:00.000Z';
const LATER = '2026-11-06T04:00:01.000Z';

function integrationNodes() {
  return [
    {
      id: 'node-backend',
      status: 'in-progress',
      name: '后端 API',
    },
    {
      id: 'node-integration',
      status: 'todo',
      name: '交易流程联调',
    },
    {
      id: 'node-frontend',
      status: 'in-progress',
      name: '前端页面',
    },
  ];
}

function snapshotFor(deliveryId: string, projectId: string, nodeId: string): DemoSubmission {
  return {
    id: deliveryId,
    projectId,
    nodeId,
    taskId: nodeId,
    author: 'Alex Lee',
    description: '摘要',
    codeFiles: [],
    traceCards: [],
    createdAt: NOW,
  };
}

clearAllSubmissions();

const draft = createDraftDelivery();
assert.equal(draft.status, 'draft');
assert.equal(draft.integrationNodeId, 'node-integration');
assert.equal(draft.files.length, 2);
assert.equal(getHandoffDelivery(), null);

const published = publishDeliveryRecord(draft, NOW, draft.publisherId);
assert.equal(published.ok, true);
if (!published.ok) throw new Error('publish');
assert.equal(published.delivery.id, draft.id);
assert.equal(published.delivery.status, 'published');
assert.ok(published.eventId);

commitHandoffDelivery(
  published.delivery,
  snapshotFor(published.delivery.id, published.delivery.projectId, published.delivery.nodeId),
);

assert.equal(listSubmissionNodeIds().length, 1);
const stored = getHandoffDelivery();
assert.ok(stored);
assert.equal(stored?.id, draft.id);
assert.equal(stored?.status, 'published');

const alex = readSharedDelivery(stored, draft.publisherId);
const priya = readSharedDelivery(stored, draft.receiverId);
assert.equal(alex.id, priya.id);
assert.equal(alex.status, priya.status);
assert.equal(alex.publishedAt, priya.publishedAt);
assert.equal(
  getSubmission(stored!.nodeId, stored!.projectId)?.id,
  stored?.id,
);

const nodesBefore = integrationNodes();
const projected = applyReceivedIntegration(nodesBefore, stored!);
assert.equal(
  projected.find((node) => node.id === 'node-integration')?.status,
  'todo',
);
assert.equal(nodesBefore[1]?.status, 'todo');
assert.equal(
  projected.find((node) => node.id === 'node-backend')?.status,
  'in-progress',
);

const tooEarly = receiveDeliveryRecord(draft, nodesBefore, LATER, draft.receiverId);
assert.equal(tooEarly.ok, false);
if (tooEarly.ok) throw new Error('early receive');
assert.equal(
  tooEarly.nodes.find((node) => node.id === 'node-integration')?.status,
  'todo',
);

const wrongActor = receiveDeliveryRecord(
  stored!,
  nodesBefore,
  LATER,
  draft.publisherId,
);
assert.equal(wrongActor.ok, false);
if (wrongActor.ok) throw new Error('publisher receive');
assert.equal(wrongActor.reason, 'not-receiver');
assert.equal(
  wrongActor.nodes.find((node) => node.id === 'node-integration')?.status,
  'todo',
);

const received = receiveDeliveryRecord(
  stored!,
  nodesBefore,
  LATER,
  draft.receiverId,
);
assert.equal(received.ok, true);
if (!received.ok) throw new Error('receive');
assert.equal(received.delivery.id, draft.id);
assert.equal(received.delivery.status, 'received');
assert.equal(
  received.nodes.find((node) => node.id === 'node-integration')?.status,
  'in-progress',
);
assert.equal(
  received.nodes.find((node) => node.id === 'node-backend')?.status,
  'in-progress',
);
assert.equal(
  received.nodes.find((node) => node.id === 'node-frontend')?.status,
  'in-progress',
);
assert.equal(nodesBefore[1]?.status, 'todo', '原蓝图数组不应被改写');
assert.equal(received.integrationNodeId, 'node-integration');
assert.equal(received.delivery.nextStep, '可以开始交易流程联调');

const duplicatePublish = publishDeliveryRecord(
  received.delivery,
  LATER,
  draft.publisherId,
);
assert.equal(duplicatePublish.ok, false);
if (duplicatePublish.ok) throw new Error('dup publish');
assert.equal(duplicatePublish.reason, 'already-received');
assert.equal(duplicatePublish.eventId, null);

commitHandoffDelivery(received.delivery, snapshotFor(
  received.delivery.id,
  received.delivery.projectId,
  received.delivery.nodeId,
));
assert.equal(listSubmissionNodeIds().length, 1);
assert.equal(getHandoffDelivery()?.id, draft.id);

const duplicateReceive = receiveDeliveryRecord(
  getHandoffDelivery()!,
  received.nodes,
  LATER,
  draft.receiverId,
);
assert.equal(duplicateReceive.ok, false);
if (duplicateReceive.ok) throw new Error('dup receive');
assert.equal(duplicateReceive.reason, 'already-received');
assert.equal(duplicateReceive.eventId, null);

const secondPublishAttempt = publishDeliveryRecord(
  getHandoffDelivery()!,
  LATER,
  draft.publisherId,
);
assert.equal(secondPublishAttempt.ok, false);

clearAllSubmissions();
assert.equal(getHandoffDelivery(), null);
assert.equal(listSubmissionNodeIds().length, 0);
const reset = resolveVisibleDelivery(getHandoffDelivery());
assert.equal(reset.status, 'draft');
assert.equal(reset.id, draft.id);
assert.equal(reset.publishedAt, null);
assert.equal(reset.receivedAt, null);

const afterResetNodes = applyReceivedIntegration(integrationNodes(), reset);
assert.equal(
  afterResetNodes.find((node) => node.id === 'node-integration')?.status,
  'todo',
);

console.log('verify-delivery-handoff: ok (incl. handoff brief mock)');
