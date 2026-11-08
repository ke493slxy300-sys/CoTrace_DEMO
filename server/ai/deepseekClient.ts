/**
 * DeepSeek Chat Completions client (server-only).
 * Errors return typed codes only; never echo secrets or upstream bodies.
 */

import {
  resolveDeepseekConfig,
  type DeepseekConfig,
} from './deepseekConfig';

export type DeepseekErrorType =
  | 'missing_key'
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'upstream'
  | 'invalid_response';

export type DeepseekChatSuccess = {
  ok: true;
  model: string;
  content: string;
  latencyMs: number;
  finishReason: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    reasoningTokens: number | null;
  } | null;
};

export type DeepseekChatFailure = {
  ok: false;
  errorType: DeepseekErrorType;
  latencyMs: number;
  finishReason?: string | null;
};

export type DeepseekChatResult = DeepseekChatSuccess | DeepseekChatFailure;

export type DeepseekChatInput = {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
  /** deepseek-flash defaults to thinking; disable for structured JSON. */
  thinking?: 'disabled' | 'enabled';
};

function classifyHttpStatus(status: number): DeepseekErrorType {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'upstream';
  return 'upstream';
}

function fail(
  errorType: DeepseekErrorType,
  startedAt: number,
  finishReason?: string | null,
): DeepseekChatFailure {
  return {
    ok: false,
    errorType,
    latencyMs: Date.now() - startedAt,
    finishReason: finishReason ?? null,
  };
}

export async function callDeepseekChat(
  input: DeepseekChatInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeepseekChatResult> {
  const startedAt = Date.now();
  const resolved = resolveDeepseekConfig(env);
  if (!resolved.ok) {
    return fail(resolved.errorType, startedAt);
  }
  return callDeepseekChatWithConfig(resolved.config, input);
}

export async function callDeepseekChatWithConfig(
  config: DeepseekConfig,
  input: DeepseekChatInput,
): Promise<DeepseekChatResult> {
  const startedAt = Date.now();
  const model = input.model?.trim() || config.model;
  const timeoutMs = input.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0,
        max_tokens: input.maxTokens ?? 64,
        stream: false,
        ...(input.jsonMode
          ? { response_format: { type: 'json_object' } }
          : {}),
        ...(input.thinking === 'disabled'
          ? { thinking: { type: 'disabled' } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      try {
        await response.text();
      } catch (_err) {
        /* ignore */
      }
      return fail(classifyHttpStatus(response.status), startedAt);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (_err) {
      return fail('invalid_response', startedAt);
    }

    const finishReason = extractFinishReason(data);
    const content = extractAssistantContent(data);
    if (content == null) {
      return fail('invalid_response', startedAt, finishReason);
    }
    // Keep raw model content for structured JSON parse; do not log this string.
    return {
      ok: true,
      model,
      content,
      latencyMs: Date.now() - startedAt,
      finishReason,
      usage: extractUsage(data),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return fail('timeout', startedAt);
    }
    return fail('network', startedAt);
  } finally {
    clearTimeout(timer);
  }
}

function extractFinishReason(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const reason = (choices[0] as { finish_reason?: unknown }).finish_reason;
  return typeof reason === 'string' ? reason : null;
}

function extractUsage(
  data: unknown,
): DeepseekChatSuccess['usage'] {
  if (!data || typeof data !== 'object') return null;
  const usage = (data as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== 'object') return null;
  const details = usage.completion_tokens_details as
    | Record<string, unknown>
    | undefined;
  return {
    promptTokens:
      typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    completionTokens:
      typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : null,
    reasoningTokens:
      details && typeof details.reasoning_tokens === 'number'
        ? details.reasoning_tokens
        : null,
  };
}

function extractAssistantContent(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  if (typeof content !== 'string') return null;
  return content;
}

export type DeepseekStreamDelta =
  | { ok: true; kind: 'delta'; text: string }
  | {
      ok: true;
      kind: 'done';
      model: string;
      content: string;
      latencyMs: number;
    }
  | { ok: false; errorType: DeepseekErrorType; latencyMs: number };

/**
 * True token stream from DeepSeek chat completions.
 * Yields content deltas, then a final done event (or a single failure).
 */
export async function* callDeepseekChatStream(
  input: DeepseekChatInput,
  env: NodeJS.ProcessEnv = process.env,
): AsyncGenerator<DeepseekStreamDelta> {
  const startedAt = Date.now();
  const resolved = resolveDeepseekConfig(env);
  if (!resolved.ok) {
    yield { ok: false, errorType: resolved.errorType, latencyMs: Date.now() - startedAt };
    return;
  }
  const config = resolved.config;
  const model = input.model?.trim() || config.model;
  const timeoutMs = input.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0,
        max_tokens: input.maxTokens ?? 800,
        stream: true,
        ...(input.thinking === 'disabled'
          ? { thinking: { type: 'disabled' } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      try {
        await response.text();
      } catch (_err) {
        /* ignore */
      }
      yield {
        ok: false,
        errorType: classifyHttpStatus(response.status),
        latencyMs: Date.now() - startedAt,
      };
      return;
    }

    if (!response.body) {
      yield {
        ok: false,
        errorType: 'invalid_response',
        latencyMs: Date.now() - startedAt,
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const rawLine of parts) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = extractStreamDelta(parsed);
        if (!delta) continue;
        content += delta;
        yield { ok: true, kind: 'delta', text: delta };
      }
    }

    yield {
      ok: true,
      kind: 'done',
      model,
      content,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      yield { ok: false, errorType: 'timeout', latencyMs: Date.now() - startedAt };
      return;
    }
    yield { ok: false, errorType: 'network', latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

function extractStreamDelta(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const delta = (choices[0] as { delta?: { content?: unknown } }).delta;
  const content = delta?.content;
  return typeof content === 'string' && content.length > 0 ? content : null;
}

export async function probeDeepseekConnectivity(
  env: NodeJS.ProcessEnv = process.env,
): Promise<
  | { ok: true; model: string; latencyMs: number }
  | { ok: false; errorType: DeepseekErrorType; latencyMs: number }
> {
  const result = await callDeepseekChat(
    {
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      maxTokens: 8,
      temperature: 0,
      timeoutMs: 20_000,
    },
    env,
  );

  if (result.ok) {
    return { ok: true, model: result.model, latencyMs: result.latencyMs };
  }
  return {
    ok: false,
    errorType: result.errorType,
    latencyMs: result.latencyMs,
  };
}
