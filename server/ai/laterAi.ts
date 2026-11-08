/**
 * P3 后续接入点：进度问答、阶段汇报整理、记忆草稿、蓝图初稿。
 * mock/live 同入口；禁止输出代码/命令。
 */

import { resolveAiMode, type MaterialCitation } from './contract';
import { callDeepseekChat, callDeepseekChatStream } from './deepseekClient';

export type ProgressQaResult = {
  answer: string;
  nextChecks: string[];
  citations: MaterialCitation[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

export type ProgressQaStreamEvent =
  | { type: 'meta'; aiMode: string }
  | { type: 'token'; text: string }
  | { type: 'result'; result: ProgressQaResult }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type StageBriefAiResult = {
  stageSummary: string;
  evidenceGaps: string[];
  teachingHints: string[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

export type MemoryDraftResult = {
  decisionDraft: string;
  rationale: string[];
  openQuestions: string[];
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

export type BlueprintSuggestResult = {
  suggestedNodes: { title: string; reason: string }[];
  caution: string;
  provider: 'mock' | 'live';
  modelLabel: string;
  latencyMs: number;
};

function mockProgress(question: string): ProgressQaResult {
  const started = Date.now();
  return {
    answer: `针对「${question.slice(0, 80)}」：请先对照当前交付版本的协作日志与待确认项，再决定是否联调。`,
    nextChecks: ['核对当前可接收版本', '确认错误码与前端提示一致'],
    citations: [],
    provider: 'mock',
    modelLabel: 'mock-progress-qa',
    latencyMs: Date.now() - started,
  };
}

function mockStage(eventsSummary: string): StageBriefAiResult {
  const started = Date.now();
  return {
    stageSummary: `阶段整理（模拟）：${eventsSummary.slice(0, 120) || '暂无事件摘要'}`,
    evidenceGaps: ['缺可观察测试输出时不得标已验证'],
    teachingHints: ['先让学生指出本版与联调目标的差异，再给正式反馈'],
    provider: 'mock',
    modelLabel: 'mock-stage-brief',
    latencyMs: Date.now() - started,
  };
}

function mockMemory(topic: string): MemoryDraftResult {
  const started = Date.now();
  return {
    decisionDraft: `关于「${topic.slice(0, 60)}」的候选决定：保留已确认事实，将推断标为待核对。`,
    rationale: ['仅使用已共享材料', '不把 AI 建议写成最终决定'],
    openQuestions: ['是否已有可回查的测试或接口证据？'],
    provider: 'mock',
    modelLabel: 'mock-memory-draft',
    latencyMs: Date.now() - started,
  };
}

function mockBlueprint(goal: string): BlueprintSuggestResult {
  const started = Date.now();
  return {
    suggestedNodes: [
      {
        title: '接口约定核对',
        reason: `服务 ${goal.slice(0, 40) || '联调'} 目标`,
      },
      { title: '联调验收', reason: '接收交付后推进' },
    ],
    caution: '初稿仅供讨论，不自动写入蓝图。',
    provider: 'mock',
    modelLabel: 'mock-blueprint-suggest',
    latencyMs: Date.now() - started,
  };
}

async function liveJson<T extends Record<string, unknown>>(
  system: string,
  user: string,
): Promise<
  | { ok: true; data: T; model: string; latencyMs: number }
  | { ok: false; message: string }
> {
  const result = await callDeepseekChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    jsonMode: true,
    thinking: 'disabled',
    maxTokens: 1200,
    temperature: 0,
    timeoutMs: Number(process.env.COTRACE_AI_TIMEOUT_MS) || 60_000,
  });
  if (!result.ok) {
    return { ok: false, message: result.errorType || 'model error' };
  }
  try {
    return {
      ok: true,
      data: JSON.parse(result.content) as T,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch {
    return { ok: false, message: 'invalid model JSON' };
  }
}

export async function runProgressQa(input: {
  projectId: string;
  question: string;
  contextSummary: string;
}): Promise<
  { ok: true; result: ProgressQaResult } | { ok: false; message: string }
> {
  if (resolveAiMode() !== 'live') {
    return { ok: true, result: mockProgress(input.question) };
  }
  const live = await liveJson<{ answer?: string; nextChecks?: string[] }>(
    '你是 CoTrace 进度问答助手。只解释当前项目进度与核对建议，禁止输出代码/命令。返回 JSON：answer, nextChecks[]。',
    `问题：${input.question}\n上下文：${input.contextSummary}`,
  );
  if (!live.ok) return live;
  return {
    ok: true,
    result: {
      answer: String(live.data.answer ?? ''),
      nextChecks: Array.isArray(live.data.nextChecks)
        ? live.data.nextChecks.map(String)
        : [],
      citations: [],
      provider: 'live',
      modelLabel: live.model,
      latencyMs: live.latencyMs,
    },
  };
}

function chunkText(text: string, size = 10): string[] {
  if (!text) return ['…'];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts.length >= 2 ? parts : [text.slice(0, 1) || '…', text.slice(1) || '。'];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True multi-frame progress QA stream (mock chunks or live token deltas).
 */
export async function* streamProgressQa(input: {
  projectId: string;
  question: string;
  contextSummary: string;
}): AsyncGenerator<ProgressQaStreamEvent> {
  const aiMode = resolveAiMode();
  yield { type: 'meta', aiMode };

  if (aiMode !== 'live') {
    const result = mockProgress(input.question);
    const chunks = chunkText(result.answer, 12);
    for (const text of chunks) {
      yield { type: 'token', text };
      await sleep(12);
    }
    yield {
      type: 'result',
      result: {
        ...result,
        answer: chunks.join(''),
        latencyMs: result.latencyMs + chunks.length * 12,
      },
    };
    yield { type: 'done' };
    return;
  }

  const started = Date.now();
  let answer = '';
  let modelLabel = 'deepseek';
  let streamFailed: string | null = null;

  for await (const event of callDeepseekChatStream({
    messages: [
      {
        role: 'system',
        content:
          '你是 CoTrace 进度问答助手。只用中文散文解释当前项目进度与核对建议，禁止输出代码、命令或 JSON。',
      },
      {
        role: 'user',
        content: `问题：${input.question}\n上下文：${input.contextSummary}`,
      },
    ],
    thinking: 'disabled',
    maxTokens: 800,
    temperature: 0,
    timeoutMs: Number(process.env.COTRACE_AI_TIMEOUT_MS) || 60_000,
  })) {
    if (!event.ok) {
      streamFailed = event.errorType || 'model error';
      break;
    }
    if (event.kind === 'delta') {
      answer += event.text;
      yield { type: 'token', text: event.text };
      continue;
    }
    answer = event.content || answer;
    modelLabel = event.model;
  }

  if (streamFailed) {
    yield { type: 'error', message: streamFailed };
    yield { type: 'done' };
    return;
  }

  if (!answer.trim()) {
    yield { type: 'error', message: 'empty model response' };
    yield { type: 'done' };
    return;
  }

  let nextChecks: string[] = [
    '核对当前可接收版本',
    '确认错误码与前端提示一致',
  ];
  const checks = await liveJson<{ nextChecks?: string[] }>(
    '你是 CoTrace 助手。根据已有答复提炼核对清单，禁止代码。返回 JSON：nextChecks[]（最多 3 条短句）。',
    `问题：${input.question}\n答复：${answer.slice(0, 1200)}`,
  );
  if (checks.ok && Array.isArray(checks.data.nextChecks)) {
    nextChecks = checks.data.nextChecks.map(String).filter(Boolean).slice(0, 3);
  }

  yield {
    type: 'result',
    result: {
      answer,
      nextChecks,
      citations: [],
      provider: 'live',
      modelLabel,
      latencyMs: Date.now() - started,
    },
  };
  yield { type: 'done' };
}

export async function runStageBriefAi(input: {
  projectId: string;
  eventsSummary: string;
}): Promise<
  { ok: true; result: StageBriefAiResult } | { ok: false; message: string }
> {
  if (resolveAiMode() !== 'live') {
    return { ok: true, result: mockStage(input.eventsSummary) };
  }
  const live = await liveJson<{
    stageSummary?: string;
    evidenceGaps?: string[];
    teachingHints?: string[];
  }>(
    '你是教师阶段汇报助手。整理要点与证据缺口，禁止输出代码。返回 JSON：stageSummary, evidenceGaps[], teachingHints[]。',
    input.eventsSummary,
  );
  if (!live.ok) return live;
  return {
    ok: true,
    result: {
      stageSummary: String(live.data.stageSummary ?? ''),
      evidenceGaps: Array.isArray(live.data.evidenceGaps)
        ? live.data.evidenceGaps.map(String)
        : [],
      teachingHints: Array.isArray(live.data.teachingHints)
        ? live.data.teachingHints.map(String)
        : [],
      provider: 'live',
      modelLabel: live.model,
      latencyMs: live.latencyMs,
    },
  };
}

export async function runMemoryDraft(input: {
  projectId: string;
  topic: string;
  evidenceSummary: string;
}): Promise<
  { ok: true; result: MemoryDraftResult } | { ok: false; message: string }
> {
  if (resolveAiMode() !== 'live') {
    return { ok: true, result: mockMemory(input.topic) };
  }
  const live = await liveJson<{
    decisionDraft?: string;
    rationale?: string[];
    openQuestions?: string[];
  }>(
    '你是项目记忆草稿助手。只产出可编辑候选决定，禁止写成最终真理。返回 JSON：decisionDraft, rationale[], openQuestions[]。',
    `主题：${input.topic}\n证据：${input.evidenceSummary}`,
  );
  if (!live.ok) return live;
  return {
    ok: true,
    result: {
      decisionDraft: String(live.data.decisionDraft ?? ''),
      rationale: Array.isArray(live.data.rationale)
        ? live.data.rationale.map(String)
        : [],
      openQuestions: Array.isArray(live.data.openQuestions)
        ? live.data.openQuestions.map(String)
        : [],
      provider: 'live',
      modelLabel: live.model,
      latencyMs: live.latencyMs,
    },
  };
}

export async function runBlueprintSuggest(input: {
  projectId: string;
  goal: string;
}): Promise<
  { ok: true; result: BlueprintSuggestResult } | { ok: false; message: string }
> {
  if (resolveAiMode() !== 'live') {
    return { ok: true, result: mockBlueprint(input.goal) };
  }
  const live = await liveJson<{
    suggestedNodes?: { title?: string; reason?: string }[];
    caution?: string;
  }>(
    '你是蓝图初稿助手。只建议节点标题与理由，禁止自动写入。返回 JSON：suggestedNodes[{title,reason}], caution。',
    input.goal,
  );
  if (!live.ok) return live;
  return {
    ok: true,
    result: {
      suggestedNodes: Array.isArray(live.data.suggestedNodes)
        ? live.data.suggestedNodes.map((node) => ({
            title: String(node?.title ?? ''),
            reason: String(node?.reason ?? ''),
          }))
        : [],
      caution: String(live.data.caution ?? '初稿仅供讨论'),
      provider: 'live',
      modelLabel: live.model,
      latencyMs: live.latencyMs,
    },
  };
}
