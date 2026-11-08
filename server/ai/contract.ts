/**
 * 模型调用统一契约：mock 与 live 共用。
 * CoTrace AI 只做理解、标注和总结；禁止写代码/改文件/推进任务状态。
 */

export type MatchVerdict =
  | 'match'
  | 'suspect-wrong-version'
  | 'irrelevant'
  | 'insufficient-evidence';

export type MaterialCitation = {
  materialId: string;
  fragmentId?: string;
  excerpt: string;
  note: string;
};

export type CollaborationLogDraft = {
  summary: string;
  humanActions: string[];
  aiActions: string[];
  openItems: string[];
  citations: MaterialCitation[];
};

export type HandoffAnalysisResult = {
  verdict: MatchVerdict;
  differences: string[];
  citations: MaterialCitation[];
  collaborationLog: CollaborationLogDraft;
  pendingConfirmations: string[];
  risks: string[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

export type HandoffAnalysisRequest = {
  projectId: string;
  taskId: string;
  codeMaterialId: string;
  chatMaterialId: string;
  /** 丢弃迟到响应用 */
  requestToken?: number;
  /** 业务层提供的上游任务目标（可选；缺省时服务端按校园二手演示常量装配） */
  taskGoal?: string;
};

export type HandoffFocusItem = {
  title: string;
  impact: string;
  checkAction: string;
  risk: string;
  /** 证据不足或推断时的不确定性说明 */
  uncertainty: string;
  citations: MaterialCitation[];
};

export type HandoffFocusResult = {
  items: HandoffFocusItem[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
  cacheKey: string;
};

export type SharedLogPayload = {
  summary: string;
  humanActions: string[];
  aiActions: string[];
  openItems: string[];
};

export type HandoffFocusRequest = {
  deliveryId: string;
  versionId: string;
  projectId: string;
  /** @deprecated 兼容旧调用；优先使用 sharedLog.summary */
  collaborationSummary: string;
  risks: string[];
  riskNotes?: string;
  riskAcknowledged?: boolean;
  /** Alex 确认后的本版协作日志（业务层从发布快照提供） */
  sharedLog: SharedLogPayload;
  /** 下游联调目标 */
  integrationGoal: string;
  codeBody: string;
  chatBody: string;
  codeMaterialId: string;
  chatMaterialId: string;
  /** 为 true 时跳过服务端 focus 缓存 */
  bypassCache?: boolean;
};

export type HelpContextMode = 'student-clarify' | 'teacher-brief';

export type HelpContextResult = {
  mode: HelpContextMode;
  studentOriginal: string;
  situationSummary: string;
  keyDisagreements: string[];
  missingInfo: string[];
  guidanceSuggestions: string[];
  clarifyPrompts: string[];
  citations: MaterialCitation[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

export type HelpContextRequest = {
  mode: HelpContextMode;
  projectId: string;
  taskId: string;
  deliveryVersionId: string;
  studentText: string;
  /** @deprecated 兼容；优先 sharedLog.summary */
  collaborationSummary: string;
  sharedEvidence: string[];
  /** 学生选中的证据摘录 */
  selectedEvidence: string[];
  /** 学生已采纳的澄清补充（teacher-brief） */
  adoptedSupplements: string[];
  /** 该版本共享协作日志 */
  sharedLog: SharedLogPayload;
};

export type AiProviderMode = 'mock' | 'live';

/** 校园二手交易平台 · 订单创建交付任务目标（服务端装配，避免散落英文硬编码） */
export const CAMPUS_ORDER_HANDOFF_TASK_GOAL =
  '校园二手交易平台 · 订单创建服务 v0.4 交付：材料应体现自购校验、条件更新（可售状态）、商品快照，以及可观察的测试运行结果；联调侧还需核对 ITEM_NOT_AVAILABLE 与前端提示一致。';

export const CAMPUS_INTEGRATION_GOAL =
  '交易流程联调：商品详情页购买 → 创建订单接口 → 结果反馈使用同一套状态与错误语义；优先核对 ITEM_NOT_AVAILABLE（商品已被其他买家购买）的前端提示是否与接口约定一致。';

export function resolveTaskGoal(
  projectId: string,
  taskId: string,
  override?: string,
): string {
  if (override?.trim()) return override.trim();
  if (
    projectId === 'project-campus-marketplace' ||
    taskId === 'node-backend' ||
    taskId.includes('backend')
  ) {
    return CAMPUS_ORDER_HANDOFF_TASK_GOAL;
  }
  return `项目 ${projectId} 任务 ${taskId}：请对照任务目标核对所选材料是否匹配。`;
}

/** True when a live provider API key is present (DeepSeek preferred). */
export function hasLiveApiKey(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    (env.DEEPSEEK_API_KEY ?? '').trim() ||
      (env.OPENAI_API_KEY ?? '').trim() ||
      (env.COTRACE_AI_API_KEY ?? '').trim(),
  );
}

/**
 * AI mode for demo/API:
 * - COTRACE_AI_MODE=mock → always mock (verify scripts)
 * - COTRACE_AI_MODE=live → live if key present, else mock (avoid hard crash)
 * - unset → live when key present, otherwise mock
 */
export function resolveAiMode(
  env: NodeJS.ProcessEnv = process.env,
): AiProviderMode {
  const raw = (env.COTRACE_AI_MODE ?? env.AI_MODE ?? '').trim().toLowerCase();
  const keyed = hasLiveApiKey(env);
  if (raw === 'mock') return 'mock';
  if (raw === 'live') return keyed ? 'live' : 'mock';
  return keyed ? 'live' : 'mock';
}

export function normalizeSharedLog(
  raw: unknown,
  fallbackSummary = '',
): SharedLogPayload {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      summary: String(obj.summary ?? fallbackSummary ?? ''),
      humanActions: Array.isArray(obj.humanActions)
        ? obj.humanActions.map(String)
        : [],
      aiActions: Array.isArray(obj.aiActions) ? obj.aiActions.map(String) : [],
      openItems: Array.isArray(obj.openItems) ? obj.openItems.map(String) : [],
    };
  }
  return {
    summary: fallbackSummary,
    humanActions: [],
    aiActions: [],
    openItems: [],
  };
}
