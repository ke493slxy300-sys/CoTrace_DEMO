/**
 * 订单创建服务 v0.4 交接状态机。
 * 纯函数：不读 localStorage、不改蓝图单例。持久化由 demoSubmission 写入同一份文档。
 */

import type { Delivery, HandoffBriefBlock } from '../types/handoff';
import { createDraftDelivery } from './handoffDemoSeed';

export type DeliveryRejectReason =
  | 'already-published'
  | 'already-received'
  | 'not-published'
  | 'not-publisher'
  | 'not-receiver'
  | 'summary-locked';

export type DeliveryDraftPatch = {
  summary?: string;
  brief?: string;
  changes?: HandoffBriefBlock[];
  downstreamImpact?: HandoffBriefBlock[];
  suggestedChecks?: HandoffBriefBlock[];
  evidenceAndOpen?: HandoffBriefBlock[];
  sourceIds?: string[];
};

type NodeLike = {
  id: string;
  status: string;
};

export type PublishDeliveryResult =
  | { ok: true; delivery: Delivery; eventId: string }
  | {
      ok: false;
      reason: 'already-published' | 'already-received' | 'not-publisher';
      delivery: Delivery;
      eventId: null;
    };

export type ReceiveDeliveryResult<T extends NodeLike> =
  | {
      ok: true;
      delivery: Delivery;
      nodes: T[];
      integrationNodeId: string;
      eventId: string;
    }
  | {
      ok: false;
      reason: 'not-published' | 'already-received' | 'not-receiver';
      delivery: Delivery;
      nodes: T[];
      integrationNodeId: string;
      eventId: null;
    };

/** 没有存储记录时回到草稿；有记录则返回同一条的副本。 */
export function resolveVisibleDelivery(stored: Delivery | null): Delivery {
  return stored
    ? normalizeDeliveryBriefFields(structuredClone(stored))
    : createDraftDelivery();
}

/**
 * 发布者与接收者读取同一条交付。memberId 不参与分支，避免按角色复制种子。
 */
export function readSharedDelivery(
  stored: Delivery | null,
  _memberId: string,
): Delivery {
  return resolveVisibleDelivery(stored);
}

/** 仅草稿可改摘要；发布后锁定。 */
export function withDeliverySummary(
  delivery: Delivery,
  summary: string,
): { ok: true; delivery: Delivery } | { ok: false; reason: 'summary-locked' } {
  return withDeliveryDraft(delivery, { summary });
}

/**
 * 草稿可同时改 summary（使用说明）与 brief/结构块；发布后锁定。
 * summary 与 brief 互不替换。
 */
export function withDeliveryDraft(
  delivery: Delivery,
  patch: DeliveryDraftPatch,
): { ok: true; delivery: Delivery } | { ok: false; reason: 'summary-locked' } {
  if (delivery.status !== 'draft') {
    return { ok: false, reason: 'summary-locked' };
  }
  const next: Delivery = { ...delivery };
  if (patch.summary != null) {
    next.summary = patch.summary;
    next.agentSummaryDraft = patch.summary;
  }
  if (patch.brief != null) next.brief = patch.brief;
  if (patch.changes != null) next.changes = structuredClone(patch.changes);
  if (patch.downstreamImpact != null) {
    next.downstreamImpact = structuredClone(patch.downstreamImpact);
  }
  if (patch.suggestedChecks != null) {
    next.suggestedChecks = structuredClone(patch.suggestedChecks);
  }
  if (patch.evidenceAndOpen != null) {
    next.evidenceAndOpen = structuredClone(patch.evidenceAndOpen);
  }
  if (patch.sourceIds != null) next.sourceIds = [...patch.sourceIds];
  return { ok: true, delivery: next };
}

/** 旧存储缺 brief 字段时补齐，避免接收页读到 undefined。 */
export function normalizeDeliveryBriefFields(delivery: Delivery): Delivery {
  return {
    ...delivery,
    brief: delivery.brief ?? '',
    changes: delivery.changes ?? [],
    downstreamImpact: delivery.downstreamImpact ?? [],
    suggestedChecks: delivery.suggestedChecks ?? [],
    evidenceAndOpen: delivery.evidenceAndOpen ?? [],
    sourceIds: delivery.sourceIds ?? [],
    selectedCodeMaterialId: delivery.selectedCodeMaterialId ?? null,
    selectedChatMaterialId: delivery.selectedChatMaterialId ?? null,
    analysis: delivery.analysis ?? null,
    analysisRequestToken: delivery.analysisRequestToken ?? 0,
    analysisStale: delivery.analysisStale ?? false,
    collaborationLog: delivery.collaborationLog ?? null,
    riskAcknowledged: delivery.riskAcknowledged ?? false,
    riskNotes: delivery.riskNotes ?? '',
    currentVersionId: delivery.currentVersionId ?? null,
    publishedVersions: delivery.publishedVersions ?? [],
    revisionRequest: delivery.revisionRequest ?? null,
    focusAnnotation: delivery.focusAnnotation ?? null,
    helpRequest: delivery.helpRequest ?? null,
  };
}

/** 待修改时允许发布人改草稿字段（不改变 needs-revision 状态）。 */
export function withDeliveryDraftAllowRevision(
  delivery: Delivery,
  patch: DeliveryDraftPatch,
): { ok: true; delivery: Delivery } | { ok: false; reason: 'summary-locked' } {
  if (delivery.status === 'draft') {
    return withDeliveryDraft(delivery, patch);
  }
  if (delivery.status !== 'needs-revision') {
    return { ok: false, reason: 'summary-locked' };
  }
  const unlocked = withDeliveryDraft({ ...delivery, status: 'draft' }, patch);
  if (!unlocked.ok) return unlocked;
  return {
    ok: true,
    delivery: { ...unlocked.delivery, status: 'needs-revision' },
  };
}

export function publishDeliveryRecord(
  delivery: Delivery,
  now: string,
  actorId?: string,
): PublishDeliveryResult {
  if (actorId && actorId !== delivery.publisherId) {
    return {
      ok: false,
      reason: 'not-publisher',
      delivery,
      eventId: null,
    };
  }
  if (delivery.status === 'received') {
    return {
      ok: false,
      reason: 'already-received',
      delivery,
      eventId: null,
    };
  }
  if (delivery.status === 'published') {
    return {
      ok: false,
      reason: 'already-published',
      delivery,
      eventId: null,
    };
  }

  return {
    ok: true,
    delivery: {
      ...delivery,
      status: 'published',
      publishedAt: now,
    },
    eventId: `event-delivery-published-${delivery.id}`,
  };
}

/**
 * 接收前不改联调节点。接收成功时只把 integrationNodeId 标为 in-progress。
 * 不修改入参数组。
 */
export function applyReceivedIntegration<T extends NodeLike>(
  nodes: readonly T[],
  delivery: Pick<Delivery, 'status' | 'integrationNodeId'>,
): T[] {
  if (delivery.status !== 'received') {
    return nodes.map((node) => ({ ...node }));
  }
  return nodes.map((node) =>
    node.id === delivery.integrationNodeId
      ? ({ ...node, status: 'in-progress' } as T)
      : { ...node },
  );
}

export function receiveDeliveryRecord<T extends NodeLike>(
  delivery: Delivery,
  nodes: readonly T[],
  now: string,
  actorId?: string,
): ReceiveDeliveryResult<T> {
  const integrationNodeId = delivery.integrationNodeId;
  if (actorId && actorId !== delivery.receiverId) {
    return {
      ok: false,
      reason: 'not-receiver',
      delivery,
      nodes: applyReceivedIntegration(nodes, delivery),
      integrationNodeId,
      eventId: null,
    };
  }
  if (delivery.status === 'draft') {
    return {
      ok: false,
      reason: 'not-published',
      delivery,
      nodes: applyReceivedIntegration(nodes, delivery),
      integrationNodeId,
      eventId: null,
    };
  }
  if (delivery.status === 'received') {
    return {
      ok: false,
      reason: 'already-received',
      delivery,
      nodes: applyReceivedIntegration(nodes, delivery),
      integrationNodeId,
      eventId: null,
    };
  }

  const next: Delivery = {
    ...delivery,
    status: 'received',
    receivedAt: now,
  };
  return {
    ok: true,
    delivery: next,
    nodes: applyReceivedIntegration(nodes, next),
    integrationNodeId,
    eventId: `event-delivery-received-${delivery.id}`,
  };
}
