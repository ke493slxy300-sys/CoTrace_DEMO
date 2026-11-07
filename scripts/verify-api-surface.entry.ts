/**
 * P1–P3 服务端面：focus 缓存、交付快照、后续 AI。
 */
import assert from 'node:assert/strict';
import {
  buildFocusCacheKey,
  clearFocusCache,
  HANDOFF_FOCUS_PROMPT_VERSION,
} from '../server/ai/focusCache';
import {
  runHandoffFocus,
  runStageBriefAi,
} from '../server/ai/index';
import {
  upsertPublishedVersion,
  getVersionSnapshot,
  markReceived,
  peekIdempotent,
  setIdempotent,
} from '../server/delivery/serverDeliveryStore';

clearFocusCache();

const focusReq = {
  deliveryId: 'del-1',
  versionId: 'ver-1',
  projectId: 'proj-1',
  collaborationSummary: '摘要',
  risks: [] as string[],
  sharedLog: {
    summary: '摘要',
    humanActions: ['人工'],
    aiActions: ['AI'],
    openItems: ['待确认'],
  },
  integrationGoal: '联调',
  codeBody: 'SELF_PURCHASE updateIfStatus ITEM_NOT_AVAILABLE',
  chatBody: '聊天记录',
  codeMaterialId: 'mat-code-order-v04',
  chatMaterialId: 'mat-chat-order-v04',
};

const key = buildFocusCacheKey(focusReq);
assert.ok(key.length > 8);
assert.ok(HANDOFF_FOCUS_PROMPT_VERSION.startsWith('focus-prompt'));

const first = await runHandoffFocus(focusReq);
assert.equal(first.ok, true);
if (first.ok) {
  assert.ok(!String(first.result.cacheKey).endsWith(':hit'));
}

const second = await runHandoffFocus(focusReq);
assert.equal(second.ok, true);
if (second.ok) {
  assert.match(String(second.result.cacheKey), /:hit$/);
}

const forced = await runHandoffFocus({ ...focusReq, bypassCache: true });
assert.equal(forced.ok, true);
if (forced.ok) {
  assert.ok(!String(forced.result.cacheKey).endsWith(':hit'));
}

upsertPublishedVersion({
  deliveryId: 'del-1',
  versionId: 'ver-1',
  version: 'v0.4',
  publishedAt: new Date().toISOString(),
  codeMaterialId: 'mat-code-order-v04',
  chatMaterialId: 'mat-chat-order-v04',
  summary: '摘要',
  brief: 'brief',
  collaborationLog: {
    summary: '摘要',
    humanActions: [],
    aiActions: [],
    openItems: [],
    citations: [],
    manuallyEdited: false,
  },
  analysis: null,
  riskAcknowledged: false,
  riskNotes: '',
  manuallyEdited: false,
  publisherId: 'alex',
  receiverId: 'priya',
  projectId: 'proj-1',
  title: '订单服务',
  status: 'published',
});
assert.equal(getVersionSnapshot('del-1', 'ver-1')?.versionId, 'ver-1');
assert.equal(markReceived('del-1', 'ver-1', new Date().toISOString()).ok, true);
assert.equal(markReceived('del-1', 'ver-old', new Date().toISOString()).ok, false);

setIdempotent('k1', { ok: true });
assert.equal(peekIdempotent('k1').hit, true);

assert.equal(
  (
    await runStageBriefAi({
      projectId: 'proj-1',
      eventsSummary: 'delivery-published: 已发布',
    })
  ).ok,
  true,
);

console.log(
  JSON.stringify({
    ok: true,
    focusCache: true,
    deliverySnapshot: true,
    demoCoreAi: ['handoff-focus', 'help-context', 'stage-brief'],
    excludedFromDemo: ['blueprint-suggest', 'memory-draft', 'progress-qa'],
    promptVersion: HANDOFF_FOCUS_PROMPT_VERSION,
  }),
);
