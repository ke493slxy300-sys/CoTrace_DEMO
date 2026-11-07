/**
 * 前端调用 /api/*。材料正文与模型调用走服务端；业务状态仍由共享 store 持久化。
 * 发布快照在浏览器：后续 AI 由业务层附带本版确认日志与角色可见证据。
 */

import type {
  DeliveryAnalysis,
  HandoffFocusAnnotation,
  MatchVerdict,
  MaterialCitation,
  CollaborationLog,
  SharedLogPayload,
} from '../types/handoff';

export type DemoMaterialCatalogItem = {
  id: string;
  title: string;
  kind: 'code' | 'ai-chat';
  versionLabel: string;
  description: string;
};

export type MaterialPreview = {
  id: string;
  title: string;
  kind: 'code' | 'ai-chat';
  versionLabel: string;
  preview: string;
  fragmentLabels: string[];
};

type AnalysisApiResult = {
  verdict: MatchVerdict;
  differences: string[];
  citations: MaterialCitation[];
  collaborationLog: Omit<CollaborationLog, 'manuallyEdited'> & {
    manuallyEdited?: boolean;
  };
  pendingConfirmations: string[];
  risks: string[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string; status: number }> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const data = (await response.json().catch(() => ({}))) as T & {
      message?: string;
      ok?: boolean;
    };
    if (!response.ok) {
      return {
        ok: false,
        message: data.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '网络错误',
      status: 0,
    };
  }
}

export function toSharedLogPayload(
  log: CollaborationLog | SharedLogPayload | null | undefined,
  fallbackSummary = '',
): SharedLogPayload {
  if (!log) {
    return {
      summary: fallbackSummary,
      humanActions: [],
      aiActions: [],
      openItems: [],
    };
  }
  return {
    summary: log.summary || fallbackSummary,
    humanActions: [...(log.humanActions ?? [])],
    aiActions: [...(log.aiActions ?? [])],
    openItems: [...(log.openItems ?? [])],
  };
}

export async function fetchDemoMaterials(kind?: 'code' | 'ai-chat') {
  const query = kind ? `?kind=${kind}` : '';
  return api<{ materials: DemoMaterialCatalogItem[]; aiMode: string }>(
    `/api/demo-materials${query}`,
  );
}

export async function fetchMaterialPreview(id: string) {
  return api<MaterialPreview>(`/api/demo-materials/${id}/preview`);
}

export async function requestHandoffAnalysis(input: {
  projectId: string;
  taskId: string;
  codeMaterialId: string;
  chatMaterialId: string;
  requestToken: number;
  taskGoal?: string;
}): Promise<
  | { ok: true; analysis: DeliveryAnalysis; requestToken: number }
  | { ok: false; message: string }
> {
  const result = await api<{
    ok: boolean;
    analysis: AnalysisApiResult;
    requestToken: number | null;
    message?: string;
  }>('/api/ai/handoff-analysis', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) return result;
  const raw = result.data.analysis;
  if (!raw) return { ok: false, message: result.data.message || '分析失败' };
  const analysis: DeliveryAnalysis = {
    analysisId: `analysis-${input.requestToken}-${Date.now()}`,
    requestToken: input.requestToken,
    verdict: raw.verdict,
    differences: raw.differences ?? [],
    citations: raw.citations ?? [],
    collaborationLog: {
      summary: raw.collaborationLog?.summary ?? '',
      humanActions: raw.collaborationLog?.humanActions ?? [],
      aiActions: raw.collaborationLog?.aiActions ?? [],
      openItems: raw.collaborationLog?.openItems ?? [],
      citations: raw.collaborationLog?.citations ?? [],
      manuallyEdited: false,
    },
    pendingConfirmations: raw.pendingConfirmations ?? [],
    risks: raw.risks ?? [],
    codeMaterialId: input.codeMaterialId,
    chatMaterialId: input.chatMaterialId,
    provider: raw.provider,
    modelLabel: raw.modelLabel,
    createdAt: new Date().toISOString(),
  };
  return {
    ok: true,
    analysis,
    requestToken: input.requestToken,
  };
}

export async function requestHandoffFocus(input: {
  deliveryId: string;
  versionId: string;
  projectId: string;
  collaborationSummary: string;
  risks: string[];
  riskNotes?: string;
  riskAcknowledged?: boolean;
  sharedLog: SharedLogPayload;
  integrationGoal: string;
  codeMaterialId: string;
  chatMaterialId: string;
  bypassCache?: boolean;
}): Promise<
  | { ok: true; focus: HandoffFocusAnnotation }
  | { ok: false; message: string }
> {
  const result = await api<{
    ok: boolean;
    focus: {
      items: HandoffFocusAnnotation['items'];
      provider: 'mock' | 'live';
      modelLabel: string;
      cacheKey: string;
    };
    message?: string;
  }>('/api/ai/handoff-focus', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) return result;
  if (!result.data.focus) {
    return { ok: false, message: result.data.message || '接手标注失败' };
  }
  return {
    ok: true,
    focus: {
      cacheKey: result.data.focus.cacheKey,
      items: (result.data.focus.items ?? []).map((item) => ({
        title: item.title,
        impact: item.impact,
        checkAction: item.checkAction,
        risk: item.risk,
        uncertainty: item.uncertainty ?? '',
        citations: item.citations ?? [],
      })),
      provider: result.data.focus.provider,
      modelLabel: result.data.focus.modelLabel,
      versionId: input.versionId,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function requestHelpContext(input: {
  mode: 'student-clarify' | 'teacher-brief';
  projectId: string;
  taskId: string;
  deliveryVersionId: string;
  studentText: string;
  collaborationSummary: string;
  sharedEvidence: string[];
  selectedEvidence?: string[];
  adoptedSupplements?: string[];
  sharedLog?: SharedLogPayload;
}) {
  return api<{
    ok: boolean;
    help: {
      mode: string;
      studentOriginal: string;
      situationSummary: string;
      keyDisagreements: string[];
      missingInfo: string[];
      guidanceSuggestions: string[];
      clarifyPrompts: string[];
      provider: 'mock' | 'live';
      modelLabel: string;
    };
    message?: string;
  }>('/api/ai/help-context', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      selectedEvidence: input.selectedEvidence ?? [],
      adoptedSupplements: input.adoptedSupplements ?? [],
      sharedLog:
        input.sharedLog ??
        toSharedLogPayload(null, input.collaborationSummary),
    }),
  });
}

export async function fetchHealth() {
  return api<{ ok: boolean; aiMode: string; hasLiveKey: boolean }>(
    '/api/health',
  );
}

function withActorHeaders(actorId?: string): HeadersInit {
  return actorId ? { 'X-CoTrace-Actor': actorId } : {};
}

/** 发布后同步服务端快照（跨端 GET 同源） */
export async function syncPublishSnapshot(input: {
  actorId: string;
  idempotencyKey: string;
  authorLabel: string;
  eventId: string;
  snapshot: {
    deliveryId: string;
    versionId: string;
    version: string;
    publishedAt: string;
    codeMaterialId: string;
    chatMaterialId: string;
    summary: string;
    brief: string;
    collaborationLog: CollaborationLog | null;
    analysis: DeliveryAnalysis | null;
    riskAcknowledged: boolean;
    riskNotes: string;
    manuallyEdited: boolean;
    publisherId: string;
    receiverId: string;
    projectId: string;
    title: string;
    status: string;
  };
}) {
  return api<{ ok: boolean; replay?: boolean }>('/api/deliveries/publish', {
    method: 'POST',
    headers: withActorHeaders(input.actorId),
    body: JSON.stringify({
      idempotencyKey: input.idempotencyKey,
      authorLabel: input.authorLabel,
      eventId: input.eventId,
      snapshot: input.snapshot,
    }),
  });
}

export async function syncReceiveDelivery(input: {
  actorId: string;
  deliveryId: string;
  versionId: string;
  projectId: string;
  authorLabel: string;
  eventId: string;
  idempotencyKey: string;
  at: string;
  summary?: string;
}) {
  return api<{ ok: boolean }>('/api/deliveries/receive', {
    method: 'POST',
    headers: withActorHeaders(input.actorId),
    body: JSON.stringify(input),
  });
}

export async function syncRevisionRequest(input: {
  actorId: string;
  deliveryId: string;
  versionId: string;
  projectId: string;
  note: string;
  authorLabel: string;
  eventId: string;
  at: string;
}) {
  return api<{ ok: boolean }>('/api/deliveries/revision', {
    method: 'POST',
    headers: withActorHeaders(input.actorId),
    body: JSON.stringify(input),
  });
}

export async function syncStudentHelp(input: {
  id: string;
  projectId: string;
  deliveryId: string;
  versionId: string;
  studentText: string;
  adoptedClarify: string[];
  authorId: string;
  authorLabel: string;
  createdAt: string;
}) {
  return api<{ ok: boolean }>('/api/help', {
    method: 'POST',
    headers: withActorHeaders(input.authorId),
    body: JSON.stringify(input),
  });
}

export async function syncTeacherFeedback(input: {
  eventId: string;
  id: string;
  text: string;
  authorId: string;
  authorLabel: string;
  at: string;
}) {
  return api<{ ok: boolean }>(`/api/events/${input.eventId}/feedback`, {
    method: 'POST',
    headers: withActorHeaders(input.authorId),
    body: JSON.stringify(input),
  });
}

export async function fetchDeliveryVersion(
  deliveryId: string,
  versionId: string,
) {
  return api<{
    ok: boolean;
    snapshot?: unknown;
    materials?: unknown;
    message?: string;
  }>(`/api/deliveries/${deliveryId}/versions/${versionId}`);
}

export async function requestStageBriefAi(input: {
  projectId: string;
  eventsSummary: string;
}) {
  return api<{ ok: boolean; stage: unknown; message?: string }>(
    '/api/ai/stage-brief',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

