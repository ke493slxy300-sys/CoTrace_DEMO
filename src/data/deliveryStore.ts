/**
 * 交付草稿 / 发布 / 接收。
 * 状态转移在 deliveryHandoff；落盘走 demoSubmission 的同一份文档，不再写 cotrace-demo-delivery。
 */

import { useSyncExternalStore } from 'react';
import type { Delivery } from '../types/handoff';
import { getBackendSubmissionFiles } from '../datasets/built-in/campus-marketplace/content/backendPack';
import type { DemoSubmission } from './demoSubmission';
import {
  commitHandoffDelivery,
  getHandoffDelivery,
  rehydrateSubmissionDocument,
  subscribeSubmissionDocument,
} from './demoSubmission';
import {
  publishDeliveryRecord,
  readSharedDelivery,
  receiveDeliveryRecord,
  resolveVisibleDelivery,
  withDeliveryDraft,
  withDeliveryDraftAllowRevision,
  type DeliveryDraftPatch,
} from './deliveryHandoff';
import {
  applyAnalysisToDelivery,
  applyManualLogEdit,
  attachFocusAnnotation,
  attachHelpRequest,
  markAnalysisPending,
  markHelpRequestGuided,
  publishDeliveryChain,
  receiveDeliveryChain,
  requestRevisionChain,
  selectMaterials,
} from './deliveryChain';
import { createDraftDelivery } from './handoffDemoSeed';
import { getMemberById } from './members';
import { appendProcessEvent } from './processEventStore';
import type {
  CollaborationLog,
  DeliveryAnalysis,
  HandoffFocusAnnotation,
  StudentHelpRequest,
} from '../types/handoff';
import {
  syncPublishSnapshot,
  syncReceiveDelivery,
  syncRevisionRequest,
  syncStudentHelp,
} from '../api/cotraceApi';

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedDelivery: Delivery | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function invalidateCache(): void {
  cachedDelivery = null;
  for (const listener of listeners) listener();
}

subscribeSubmissionDocument(invalidateCache);

function currentDelivery(): Delivery {
  if (!cachedDelivery) {
    cachedDelivery = resolveVisibleDelivery(getHandoffDelivery());
  }
  return cachedDelivery;
}

function buildPublicSnapshot(delivery: Delivery): DemoSubmission {
  const publisherName =
    getMemberById(delivery.publisherId)?.name ?? delivery.publisherId;
  const orderService = getBackendSubmissionFiles().find((file) =>
    file.name.replace(/\\/g, '/').endsWith('src/services/orderService.js'),
  );
  const codeFiles = orderService
    ? [{ ...orderService, taskId: delivery.nodeId }]
    : [];
  codeFiles.push({
    id: 'file-order-api',
    name: '04_订单API接口规范.md',
    language: 'markdown',
    content:
      '订单 API 接口规范。错误码与前端提示对照见课程材料《前后端联调说明》。',
    taskId: delivery.nodeId,
    source: 'preset',
  });

  return {
    id: delivery.id,
    projectId: delivery.projectId,
    nodeId: delivery.nodeId,
    taskId: delivery.nodeId,
    author: publisherName,
    description: delivery.summary,
    codeFiles,
    traceCards: [
      {
        id: 'trace-tests-and-limit',
        title: '完成异常测试并记录事务限制',
        fragmentSummary: delivery.verifiedItems[0] ?? delivery.summary,
        humanUnderstanding:
          '本阶段保留 sold 的临时语义，不扩展支付、取消和卖家拒绝。',
        humanDecision: '公开这项限制，并把待联调验证留给交易流程联调。',
      },
    ],
    createdAt: delivery.publishedAt ?? delivery.receivedAt ?? nowIso(),
  };
}

export function getDelivery(): Delivery {
  return currentDelivery();
}

export function getDeliveryById(id: string): Delivery | null {
  const delivery = getDelivery();
  return delivery.id === id ? delivery : null;
}

/** 给教师端或另一视角读取：与 getDelivery 同一条记录。 */
export function getDeliveryForMember(memberId: string): Delivery {
  return readSharedDelivery(getHandoffDelivery(), memberId);
}

export function updateDeliverySummary(
  summary: string,
  actorId: string,
): Delivery {
  return updateDeliveryDraft({ summary }, actorId);
}

/** 草稿 / 待修改 可保存使用说明与接手提示（含结构块 / sourceIds）。 */
export function updateDeliveryDraft(
  patch: DeliveryDraftPatch,
  actorId: string,
): Delivery {
  const current = currentDelivery();
  if (actorId !== current.publisherId) return current;
  const edited = withDeliveryDraftAllowRevision(current, patch);
  if (!edited.ok) return current;
  const saved = commitHandoffDelivery(edited.delivery, null);
  cachedDelivery = saved;
  return saved;
}

function persistDelivery(delivery: Delivery, withSnapshot: boolean): Delivery {
  const saved = commitHandoffDelivery(
    delivery,
    withSnapshot ? buildPublicSnapshot(delivery) : null,
  );
  cachedDelivery = saved;
  return saved;
}

export function setDeliveryMaterials(
  actorId: string,
  codeMaterialId: string | null,
  chatMaterialId: string | null,
): Delivery {
  const current = currentDelivery();
  if (actorId !== current.publisherId) return current;
  return persistDelivery(
    selectMaterials(current, codeMaterialId, chatMaterialId),
    false,
  );
}

export function beginDeliveryAnalysis(actorId: string): {
  delivery: Delivery;
  requestToken: number;
} {
  const current = currentDelivery();
  if (actorId !== current.publisherId) {
    return { delivery: current, requestToken: current.analysisRequestToken };
  }
  const next = markAnalysisPending(current);
  const saved = persistDelivery(next, false);
  return { delivery: saved, requestToken: saved.analysisRequestToken };
}

export function applyDeliveryAnalysis(
  actorId: string,
  analysis: DeliveryAnalysis,
  requestToken: number,
): Delivery {
  const current = currentDelivery();
  if (actorId !== current.publisherId) return current;
  return persistDelivery(
    applyAnalysisToDelivery(current, analysis, requestToken),
    false,
  );
}

export function updateCollaborationLog(
  actorId: string,
  log: CollaborationLog,
): Delivery {
  const current = currentDelivery();
  if (actorId !== current.publisherId) return current;
  return persistDelivery(applyManualLogEdit(current, log), false);
}

export type ChainPublishResult =
  | { ok: true; delivery: Delivery; versionId: string }
  | {
      ok: false;
      reason:
        | 'not-publisher'
        | 'already-received'
        | 'risk-required'
        | 'no-materials'
        | 'irrelevant-blocked';
    };

export function publishDeliveryWithChain(
  actorId: string,
  options: {
    riskAcknowledged?: boolean;
    riskNotes?: string;
    patch?: DeliveryDraftPatch;
  } = {},
): ChainPublishResult {
  const current = currentDelivery();
  const result = publishDeliveryChain(current, {
    actorId,
    now: nowIso(),
    riskAcknowledged: options.riskAcknowledged,
    riskNotes: options.riskNotes,
    patch: options.patch,
  });
  if (!result.ok) return { ok: false, reason: result.reason };

  const saved = persistDelivery(result.delivery, true);
  const publisherName =
    getMemberById(saved.publisherId)?.name ?? saved.publisherId;
  const receiverName =
    getMemberById(saved.receiverId)?.name ?? saved.receiverId;
  const riskNote = saved.riskAcknowledged
    ? `（已确认风险：${saved.riskNotes || saved.analysis?.verdict || '见分析'}）`
    : '';
  appendProcessEvent({
    id: result.eventId,
    projectId: saved.projectId,
    dateLabel: '今天',
    title: `${saved.title} ${saved.version} 已发布`,
    statusLabel: '等待确认接收',
    statusTone: 'warning',
    kind: 'delivery-published',
    summary: `${publisherName} 已将交付交给 ${receiverName}${riskNote}。材料：${saved.selectedCodeMaterialId} + ${saved.selectedChatMaterialId}`,
    authorLabel: `${publisherName} · 发布交付`,
    deliveryId: saved.id,
    versionId: result.versionId,
    evidence: [
      {
        id: `ev-pub-log-${result.versionId}`,
        kind: 'student-edit',
        label: '人机协作日志',
        summary: saved.collaborationLog?.summary || saved.brief || saved.summary,
        at: saved.publishedAt ?? nowIso(),
        linkLabel: '查看日志',
      },
    ],
  });
  void syncPublishSnapshot({
    actorId,
    idempotencyKey: `pub-${result.versionId}`,
    authorLabel: `${publisherName} · 发布交付`,
    eventId: result.eventId,
    snapshot: {
      deliveryId: saved.id,
      versionId: result.versionId,
      version: saved.version,
      publishedAt: saved.publishedAt ?? nowIso(),
      codeMaterialId: saved.selectedCodeMaterialId || '',
      chatMaterialId: saved.selectedChatMaterialId || '',
      summary: saved.summary,
      brief: saved.brief,
      collaborationLog: saved.collaborationLog,
      analysis: saved.analysis,
      riskAcknowledged: saved.riskAcknowledged,
      riskNotes: saved.riskNotes,
      manuallyEdited: Boolean(saved.collaborationLog?.manuallyEdited),
      publisherId: saved.publisherId,
      receiverId: saved.receiverId,
      projectId: saved.projectId,
      title: saved.title,
      status: saved.status,
    },
  });
  return { ok: true, delivery: saved, versionId: result.versionId };
}

export type RevisionResult =
  | { ok: true; delivery: Delivery }
  | {
      ok: false;
      reason: 'not-receiver' | 'not-published' | 'empty-note' | 'stale-version';
    };

export function requestDeliveryRevision(
  actorId: string,
  note: string,
  evidenceLocator?: string,
  expectedVersionId?: string,
): RevisionResult {
  const current = currentDelivery();
  const result = requestRevisionChain(
    current,
    actorId,
    note,
    nowIso(),
    evidenceLocator,
    expectedVersionId,
  );
  if (!result.ok) return { ok: false, reason: result.reason };
  const saved = persistDelivery(result.delivery, true);
  const receiverName =
    getMemberById(saved.receiverId)?.name ?? saved.receiverId;
  appendProcessEvent({
    id: result.eventId,
    projectId: saved.projectId,
    dateLabel: '今天',
    title: `${saved.title} ${saved.version} 需修改`,
    statusLabel: '待修改',
    statusTone: 'warning',
    kind: 'delivery-revision',
    summary: note.trim(),
    authorLabel: `${receiverName} · 修改意见`,
    deliveryId: saved.id,
    versionId: saved.revisionRequest?.versionId,
    evidence: evidenceLocator
      ? [
          {
            id: `ev-rev-${saved.revisionRequest?.versionId}`,
            kind: 'student-edit',
            label: '证据定位',
            summary: evidenceLocator,
            at: nowIso(),
            linkLabel: '查看定位',
          },
        ]
      : [],
  });
  void syncRevisionRequest({
    actorId,
    deliveryId: saved.id,
    versionId: saved.revisionRequest?.versionId || saved.currentVersionId || '',
    projectId: saved.projectId,
    note: note.trim(),
    authorLabel: `${receiverName} · 修改意见`,
    eventId: result.eventId,
    at: nowIso(),
  });
  return { ok: true, delivery: saved };
}

export function saveFocusAnnotation(
  focus: HandoffFocusAnnotation,
): Delivery {
  return persistDelivery(
    attachFocusAnnotation(currentDelivery(), focus),
    false,
  );
}

export function markDeliveryHelpGuided(helpEventId?: string): Delivery {
  return persistDelivery(
    markHelpRequestGuided(currentDelivery(), helpEventId),
    false,
  );
}

export function submitStudentHelp(
  help: Omit<StudentHelpRequest, 'id' | 'createdAt' | 'status'>,
): Delivery {
  const full: StudentHelpRequest = {
    ...help,
    id: `help-${help.versionId}-${Date.now()}`,
    createdAt: nowIso(),
    status: 'open',
  };
  const saved = persistDelivery(
    attachHelpRequest(currentDelivery(), full),
    false,
  );
  const authorName = getMemberById(help.authorId)?.name ?? help.authorId;
  appendProcessEvent({
    id: `event-student-help-${full.id}`,
    projectId: help.projectId,
    dateLabel: '今天',
    title: '联调求助 · 待教师指导',
    statusLabel: '待指导',
    statusTone: 'warning',
    kind: 'student-help',
    summary: help.studentText,
    authorLabel: `${authorName} · 提交求助`,
    deliveryId: help.deliveryId,
    versionId: help.versionId,
    evidence: [
      {
        id: `ev-help-orig-${full.id}`,
        kind: 'student-edit',
        label: '学生原文',
        summary: help.studentText,
        at: full.createdAt,
        linkLabel: '查看原文',
      },
      ...help.adoptedClarify.map((item, index) => ({
        id: `ev-help-ai-${full.id}-${index}`,
        kind: 'ai-suggestion' as const,
        label: '学生采纳的 AI 补充',
        summary: item,
        at: full.createdAt,
        linkLabel: '查看补充',
      })),
    ],
  });
  void syncStudentHelp({
    id: full.id,
    projectId: help.projectId,
    deliveryId: help.deliveryId,
    versionId: help.versionId,
    studentText: help.studentText,
    adoptedClarify: help.adoptedClarify,
    authorId: help.authorId,
    authorLabel: `${authorName} · 提交求助`,
    createdAt: full.createdAt,
  });
  return saved;
}

export type PublishResult =
  | { ok: true; delivery: Delivery }
  | {
      ok: false;
      reason: 'already-published' | 'already-received' | 'not-publisher';
    };

export type PublishDeliveryInput = DeliveryDraftPatch;

export function publishDelivery(
  actorId: string,
  summaryOrPatch?: string | PublishDeliveryInput,
): PublishResult {
  let current = currentDelivery();
  const patch: DeliveryDraftPatch | null =
    summaryOrPatch == null
      ? null
      : typeof summaryOrPatch === 'string'
        ? { summary: summaryOrPatch }
        : summaryOrPatch;

  if (patch && current.status === 'draft') {
    const edited = withDeliveryDraft(current, patch);
    if (edited.ok) current = edited.delivery;
  }

  const result = publishDeliveryRecord(current, nowIso(), actorId);
  if (!result.ok) return { ok: false, reason: result.reason };

  const saved = commitHandoffDelivery(
    result.delivery,
    buildPublicSnapshot(result.delivery),
  );
  cachedDelivery = saved;

  const publisherName =
    getMemberById(saved.publisherId)?.name ?? saved.publisherId;
  const receiverName =
    getMemberById(saved.receiverId)?.name ?? saved.receiverId;
  appendProcessEvent({
    id: result.eventId,
    projectId: saved.projectId,
    dateLabel: '今天',
    title: `${saved.title} ${saved.version} 已发布`,
    statusLabel: '等待确认接收',
    statusTone: 'warning',
    kind: 'delivery-published',
    summary: `${publisherName} 已将交付交给 ${receiverName}，等待确认接收后开始交易流程联调。`,
    authorLabel: `${publisherName} · 发布交付`,
    deliveryId: saved.id,
    evidence: [
      {
        id: 'ev-pub-files',
        kind: 'student-edit',
        label: '交付材料',
        summary: saved.files.map((file) => file.name).join('、'),
        at: saved.publishedAt ?? nowIso(),
        linkLabel: '查看文件',
      },
    ],
  });

  return { ok: true, delivery: saved };
}

export type ReceiveResult =
  | { ok: true; delivery: Delivery; integrationNodeId: string }
  | {
      ok: false;
      reason:
        | 'not-published'
        | 'already-received'
        | 'not-receiver'
        | 'stale-version';
    };

export function receiveDelivery(
  actorId: string,
  expectedVersionId?: string,
): ReceiveResult {
  const current = currentDelivery();

  // 有版本链时走新状态机；旧草稿直发仍兼容原记录函数
  if (current.currentVersionId || expectedVersionId) {
    const chained = receiveDeliveryChain(
      current,
      actorId,
      nowIso(),
      expectedVersionId ?? current.currentVersionId ?? undefined,
    );
    if (!chained.ok) return { ok: false, reason: chained.reason };
    const saved = persistDelivery(chained.delivery, true);
    const receiverName =
      getMemberById(saved.receiverId)?.name ?? saved.receiverId;
    appendProcessEvent({
      id: chained.eventId,
      projectId: saved.projectId,
      dateLabel: '今天',
      title: `${saved.title} ${saved.version} 已接收`,
      statusLabel: '进行中',
      statusTone: 'success',
      kind: 'delivery-received',
      summary: saved.nextStep,
      authorLabel: `${receiverName} · 确认接收`,
      deliveryId: saved.id,
      versionId: saved.currentVersionId ?? undefined,
      evidence: [
        {
          id: `ev-recv-next-${saved.currentVersionId ?? saved.id}`,
          kind: 'verification',
          label: '下一步',
          summary: saved.nextStep,
          at: saved.receivedAt ?? nowIso(),
          linkLabel: '查看联调节点',
        },
      ],
    });
    void syncReceiveDelivery({
      actorId,
      deliveryId: saved.id,
      versionId: saved.currentVersionId || '',
      projectId: saved.projectId,
      authorLabel: `${receiverName} · 确认接收`,
      eventId: chained.eventId,
      idempotencyKey: `rcv-${saved.currentVersionId}`,
      at: saved.receivedAt ?? nowIso(),
      summary: saved.nextStep,
    });
    return {
      ok: true,
      delivery: saved,
      integrationNodeId: chained.integrationNodeId,
    };
  }

  const result = receiveDeliveryRecord(current, [], nowIso(), actorId);
  if (!result.ok) return { ok: false, reason: result.reason };

  const saved = persistDelivery(result.delivery, true);

  const receiverName =
    getMemberById(saved.receiverId)?.name ?? saved.receiverId;
  appendProcessEvent({
    id: result.eventId,
    projectId: saved.projectId,
    dateLabel: '今天',
    title: `${saved.title} ${saved.version} 已接收`,
    statusLabel: '进行中',
    statusTone: 'success',
    kind: 'delivery-received',
    summary: saved.nextStep,
    authorLabel: `${receiverName} · 确认接收`,
    deliveryId: saved.id,
    evidence: [
      {
        id: 'ev-recv-next',
        kind: 'verification',
        label: '下一步',
        summary: saved.nextStep,
        at: saved.receivedAt ?? nowIso(),
        linkLabel: '查看联调节点',
      },
    ],
  });

  return {
    ok: true,
    delivery: saved,
    integrationNodeId: result.integrationNodeId,
  };
}

export function resetDeliveryStore(): void {
  cachedDelivery = null;
}

export function rehydrateDeliveryStore(): void {
  cachedDelivery = null;
  rehydrateSubmissionDocument();
  cachedDelivery = null;
}

export function subscribeDelivery(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_DELIVERY = createDraftDelivery();

export function useDelivery(): Delivery {
  return useSyncExternalStore(
    subscribeDelivery,
    getDelivery,
    () => SERVER_DELIVERY,
  );
}
