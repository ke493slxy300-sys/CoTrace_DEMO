/**
 * 跨端交付链状态转移（纯函数）。
 * 路径：草稿 → 已发布待接收 → 待修改 → 新版本待接收 → 已接收；也可直接接收。
 */

import type {
  CollaborationLog,
  Delivery,
  DeliveryAnalysis,
  DeliveryStatus,
  DeliveryVersionSnapshot,
  HandoffBriefBlock,
  HandoffFocusAnnotation,
  RevisionRequest,
  StudentHelpRequest,
} from '../types/handoff';
import type { DeliveryDraftPatch } from './deliveryHandoff';
import { withDeliveryDraft } from './deliveryHandoff';

export type PublishChainInput = {
  actorId: string;
  now: string;
  riskAcknowledged?: boolean;
  riskNotes?: string;
  patch?: DeliveryDraftPatch & {
    collaborationLog?: CollaborationLog | null;
    selectedCodeMaterialId?: string | null;
    selectedChatMaterialId?: string | null;
    analysis?: DeliveryAnalysis | null;
  };
};

export type PublishChainResult =
  | { ok: true; delivery: Delivery; eventId: string; versionId: string }
  | {
      ok: false;
      reason:
        | 'not-publisher'
        | 'already-received'
        | 'risk-required'
        | 'no-materials'
        | 'irrelevant-blocked';
      delivery: Delivery;
    };

export type RevisionChainResult =
  | { ok: true; delivery: Delivery; eventId: string }
  | {
      ok: false;
      reason: 'not-receiver' | 'not-published' | 'empty-note' | 'stale-version';
      delivery: Delivery;
    };

export type ReceiveChainResult =
  | { ok: true; delivery: Delivery; eventId: string; integrationNodeId: string }
  | {
      ok: false;
      reason:
        | 'not-receiver'
        | 'not-published'
        | 'already-received'
        | 'stale-version';
      delivery: Delivery;
    };

function blocksFromLog(
  log: CollaborationLog | null,
  materialIds: string[],
): {
  brief: string;
  changes: HandoffBriefBlock[];
  downstreamImpact: HandoffBriefBlock[];
  suggestedChecks: HandoffBriefBlock[];
  evidenceAndOpen: HandoffBriefBlock[];
  sourceIds: string[];
} {
  if (!log) {
    return {
      brief: '',
      changes: [],
      downstreamImpact: [],
      suggestedChecks: [],
      evidenceAndOpen: [],
      sourceIds: materialIds,
    };
  }
  const src = materialIds;
  return {
    brief: log.summary,
    changes: log.humanActions.map((body) => ({
      body,
      kind: 'fact' as const,
      sourceIds: [...src],
    })),
    downstreamImpact: log.aiActions.map((body) => ({
      body,
      kind: 'suggestion' as const,
      sourceIds: [...src],
    })),
    suggestedChecks: [],
    evidenceAndOpen: log.openItems.map((body) => ({
      body,
      kind: 'unverified' as const,
      sourceIds: [...src],
    })),
    sourceIds: src,
  };
}

function nextVersionLabel(delivery: Delivery): string {
  const count = delivery.publishedVersions.length;
  if (count === 0) return delivery.version || 'v0.4';
  return `v0.4.${count}`;
}

export function applyAnalysisToDelivery(
  delivery: Delivery,
  analysis: DeliveryAnalysis,
  requestToken: number,
): Delivery {
  if (requestToken !== delivery.analysisRequestToken) {
    return delivery; // 迟到响应丢弃
  }
  if (
    analysis.codeMaterialId !== delivery.selectedCodeMaterialId ||
    analysis.chatMaterialId !== delivery.selectedChatMaterialId
  ) {
    return delivery;
  }
  const materialIds = [
    analysis.codeMaterialId,
    analysis.chatMaterialId,
  ].filter(Boolean);
  const fromLog = blocksFromLog(analysis.collaborationLog, materialIds);
  return {
    ...delivery,
    analysis,
    analysisStale: false,
    collaborationLog: {
      ...analysis.collaborationLog,
      manuallyEdited: false,
    },
    brief: fromLog.brief,
    changes: fromLog.changes,
    downstreamImpact: fromLog.downstreamImpact,
    suggestedChecks: fromLog.suggestedChecks,
    evidenceAndOpen: fromLog.evidenceAndOpen,
    sourceIds: fromLog.sourceIds,
    riskAcknowledged: false,
    riskNotes: '',
  };
}

export function selectMaterials(
  delivery: Delivery,
  codeMaterialId: string | null,
  chatMaterialId: string | null,
): Delivery {
  if (delivery.status !== 'draft' && delivery.status !== 'needs-revision') {
    return delivery;
  }
  const changed =
    codeMaterialId !== delivery.selectedCodeMaterialId ||
    chatMaterialId !== delivery.selectedChatMaterialId;
  if (!changed) {
    return {
      ...delivery,
      selectedCodeMaterialId: codeMaterialId,
      selectedChatMaterialId: chatMaterialId,
    };
  }
  // 换料作废旧分析；未人工确认的日志草稿一并清空，已手改摘要则保留
  const keepManualLog =
    delivery.collaborationLog?.manuallyEdited === true
      ? {
          ...delivery.collaborationLog,
          aiActions: [],
          citations: [],
        }
      : null;
  return {
    ...delivery,
    selectedCodeMaterialId: codeMaterialId,
    selectedChatMaterialId: chatMaterialId,
    analysisRequestToken: delivery.analysisRequestToken + 1,
    analysisStale: true,
    analysis: null,
    collaborationLog: keepManualLog,
    brief: keepManualLog?.summary ?? '',
    changes: [],
    downstreamImpact: [],
    suggestedChecks: [],
    evidenceAndOpen: [],
    sourceIds: [],
    riskAcknowledged: false,
    riskNotes: '',
  };
}

export function markAnalysisPending(delivery: Delivery): Delivery {
  return {
    ...delivery,
    analysisRequestToken: delivery.analysisRequestToken + 1,
    analysisStale: true,
  };
}

export function applyManualLogEdit(
  delivery: Delivery,
  log: CollaborationLog,
): Delivery {
  if (delivery.status !== 'draft' && delivery.status !== 'needs-revision') {
    return delivery;
  }
  const materialIds = [
    delivery.selectedCodeMaterialId,
    delivery.selectedChatMaterialId,
  ].filter((id): id is string => Boolean(id));
  const fromLog = blocksFromLog({ ...log, manuallyEdited: true }, materialIds);
  return {
    ...delivery,
    collaborationLog: { ...log, manuallyEdited: true },
    brief: fromLog.brief,
    changes: fromLog.changes,
    downstreamImpact: fromLog.downstreamImpact,
    suggestedChecks: fromLog.suggestedChecks,
    evidenceAndOpen: fromLog.evidenceAndOpen,
    sourceIds: fromLog.sourceIds,
  };
}

function requiresRisk(delivery: Delivery): boolean {
  const verdict = delivery.analysis?.verdict;
  return (
    verdict === 'suspect-wrong-version' ||
    verdict === 'insufficient-evidence' ||
    Boolean(delivery.analysis?.risks.length)
  );
}

export function publishDeliveryChain(
  delivery: Delivery,
  input: PublishChainInput,
): PublishChainResult {
  if (input.actorId !== delivery.publisherId) {
    return { ok: false, reason: 'not-publisher', delivery };
  }
  if (delivery.status === 'received') {
    return { ok: false, reason: 'already-received', delivery };
  }
  if (
    delivery.status !== 'draft' &&
    delivery.status !== 'needs-revision' &&
    delivery.status !== 'published'
  ) {
    return { ok: false, reason: 'already-received', delivery };
  }
  // 已发布未改状态时拒绝重复发布（需先被标 needs-revision）
  if (delivery.status === 'published') {
    return { ok: false, reason: 'already-received', delivery };
  }

  let current = delivery;
  if (input.patch) {
    const {
      collaborationLog,
      selectedCodeMaterialId,
      selectedChatMaterialId,
      analysis,
      ...briefPatch
    } = input.patch;
    const edited = withDeliveryDraft(
      {
        ...current,
        status: 'draft',
      },
      briefPatch,
    );
    if (edited.ok) current = { ...edited.delivery, status: delivery.status };
    if (collaborationLog) {
      current = applyManualLogEdit(current, {
        summary: collaborationLog.summary,
        humanActions: collaborationLog.humanActions,
        aiActions: collaborationLog.aiActions,
        openItems: collaborationLog.openItems,
        citations: collaborationLog.citations,
        manuallyEdited: Boolean(collaborationLog.manuallyEdited),
      });
    }
    if (selectedCodeMaterialId !== undefined) {
      current = {
        ...current,
        selectedCodeMaterialId,
      };
    }
    if (selectedChatMaterialId !== undefined) {
      current = {
        ...current,
        selectedChatMaterialId,
      };
    }
    if (analysis !== undefined) {
      current = { ...current, analysis };
    }
  }

  if (!current.selectedCodeMaterialId || !current.selectedChatMaterialId) {
    return { ok: false, reason: 'no-materials', delivery: current };
  }
  if (current.analysis?.verdict === 'irrelevant') {
    return { ok: false, reason: 'irrelevant-blocked', delivery: current };
  }
  if (requiresRisk(current) && !input.riskAcknowledged) {
    return { ok: false, reason: 'risk-required', delivery: current };
  }

  const versionLabel = nextVersionLabel(current);
  const versionId = `ver-${current.id}-${current.publishedVersions.length + 1}`;
  const snapshot: DeliveryVersionSnapshot = {
    versionId,
    version: versionLabel,
    publishedAt: input.now,
    codeMaterialId: current.selectedCodeMaterialId,
    chatMaterialId: current.selectedChatMaterialId,
    summary: current.summary,
    brief: current.brief,
    collaborationLog: current.collaborationLog
      ? structuredClone(current.collaborationLog)
      : null,
    analysis: current.analysis ? structuredClone(current.analysis) : null,
    riskAcknowledged: Boolean(input.riskAcknowledged),
    riskNotes: input.riskNotes?.trim() || current.riskNotes || '',
    manuallyEdited: Boolean(current.collaborationLog?.manuallyEdited),
    changes: structuredClone(current.changes),
    downstreamImpact: structuredClone(current.downstreamImpact),
    suggestedChecks: structuredClone(current.suggestedChecks),
    evidenceAndOpen: structuredClone(current.evidenceAndOpen),
    sourceIds: [...current.sourceIds],
  };

  const next: Delivery = {
    ...current,
    status: 'published',
    version: versionLabel,
    publishedAt: input.now,
    receivedAt: null,
    currentVersionId: versionId,
    publishedVersions: [...current.publishedVersions, snapshot],
    riskAcknowledged: Boolean(input.riskAcknowledged),
    riskNotes: snapshot.riskNotes,
    revisionRequest: null,
    focusAnnotation: null,
  };

  return {
    ok: true,
    delivery: next,
    eventId: `event-delivery-published-${versionId}`,
    versionId,
  };
}

export function requestRevisionChain(
  delivery: Delivery,
  actorId: string,
  note: string,
  now: string,
  evidenceLocator?: string,
  expectedVersionId?: string,
): RevisionChainResult {
  if (actorId !== delivery.receiverId) {
    return { ok: false, reason: 'not-receiver', delivery };
  }
  if (delivery.status !== 'published') {
    return { ok: false, reason: 'not-published', delivery };
  }
  if (
    expectedVersionId &&
    delivery.currentVersionId &&
    expectedVersionId !== delivery.currentVersionId
  ) {
    return { ok: false, reason: 'stale-version', delivery };
  }
  const trimmed = note.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty-note', delivery };
  }
  const revision: RevisionRequest = {
    versionId: delivery.currentVersionId ?? '',
    note: trimmed,
    evidenceLocator,
    at: now,
    authorId: actorId,
  };
  return {
    ok: true,
    delivery: {
      ...delivery,
      status: 'needs-revision',
      revisionRequest: revision,
    },
    eventId: `event-delivery-revision-${revision.versionId}`,
  };
}

export function receiveDeliveryChain(
  delivery: Delivery,
  actorId: string,
  now: string,
  expectedVersionId?: string,
): ReceiveChainResult {
  if (actorId !== delivery.receiverId) {
    return { ok: false, reason: 'not-receiver', delivery };
  }
  if (delivery.status !== 'published') {
    return {
      ok: false,
      reason: delivery.status === 'received' ? 'already-received' : 'not-published',
      delivery,
    };
  }
  if (
    expectedVersionId &&
    delivery.currentVersionId &&
    expectedVersionId !== delivery.currentVersionId
  ) {
    return { ok: false, reason: 'stale-version', delivery };
  }
  return {
    ok: true,
    delivery: {
      ...delivery,
      status: 'received',
      receivedAt: now,
    },
    eventId: `event-delivery-received-${delivery.currentVersionId ?? delivery.id}`,
    integrationNodeId: delivery.integrationNodeId,
  };
}

export function attachFocusAnnotation(
  delivery: Delivery,
  focus: HandoffFocusAnnotation,
): Delivery {
  if (delivery.status !== 'published' && delivery.status !== 'received') {
    return delivery;
  }
  if (focus.versionId !== delivery.currentVersionId) return delivery;
  return { ...delivery, focusAnnotation: focus };
}

export function attachHelpRequest(
  delivery: Delivery,
  help: StudentHelpRequest,
): Delivery {
  return { ...delivery, helpRequest: help };
}

export function markHelpRequestGuided(
  delivery: Delivery,
  helpIdOrEventHint?: string,
): Delivery {
  if (!delivery.helpRequest || delivery.helpRequest.status === 'guided') {
    return delivery;
  }
  if (
    helpIdOrEventHint &&
    !helpIdOrEventHint.includes(delivery.helpRequest.id) &&
    helpIdOrEventHint !== delivery.helpRequest.id
  ) {
    return delivery;
  }
  return {
    ...delivery,
    helpRequest: { ...delivery.helpRequest, status: 'guided' },
  };
}

export function getVersionSnapshot(
  delivery: Delivery,
  versionId: string,
): DeliveryVersionSnapshot | null {
  return (
    delivery.publishedVersions.find((item) => item.versionId === versionId) ??
    null
  );
}

export type HandoffAudience = 'publisher' | 'receiver';

/** 主路径上的交接状态：按正在看的人说一句。 */
export function handoffStatusLine(
  status: DeliveryStatus,
  audience: HandoffAudience,
): string {
  if (status === 'published') {
    return audience === 'receiver' ? '等你确认' : '已交给 Priya，等她确认';
  }
  if (status === 'received') return '已确认';
  if (status === 'needs-revision') {
    return audience === 'receiver' ? '已让 Alex 修改' : 'Priya 要改这一版';
  }
  return '这一版还没交给 Priya';
}

export function statusLabel(status: DeliveryStatus): string {
  if (status === 'draft') return '草稿';
  return handoffStatusLine(status, 'publisher');
}
