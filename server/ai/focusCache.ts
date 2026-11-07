/**
 * handoff-focus 服务端复用：
 * key = versionId + 接收任务上下文 + 材料 + 提示词版本 + aiMode
 */

import { createHash } from 'node:crypto';
import type { HandoffFocusRequest, HandoffFocusResult } from './contract';
import { resolveAiMode } from './contract';

/** 提示词/结构变更时递增，使旧缓存自动失效 */
export const HANDOFF_FOCUS_PROMPT_VERSION = 'focus-prompt-v2';

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 200;

type CacheEntry = {
  result: HandoffFocusResult;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function digest(parts: string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 24);
}

export function buildFocusCacheKey(request: HandoffFocusRequest): string {
  const log = request.sharedLog;
  return digest([
    resolveAiMode(),
    HANDOFF_FOCUS_PROMPT_VERSION,
    request.deliveryId,
    request.versionId,
    request.projectId,
    request.codeMaterialId,
    request.chatMaterialId,
    request.integrationGoal,
    log.summary,
    log.humanActions.join('|'),
    log.aiActions.join('|'),
    log.openItems.join('|'),
    request.risks.join('|'),
    request.riskNotes ?? '',
    String(Boolean(request.riskAcknowledged)),
  ]);
}

export function getCachedFocus(cacheKey: string): HandoffFocusResult | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  return {
    ...entry.result,
    items: entry.result.items.map((item) => ({ ...item })),
    cacheKey,
  };
}

export function setCachedFocus(
  cacheKey: string,
  result: HandoffFocusResult,
): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, {
    result: {
      ...result,
      cacheKey,
      items: result.items.map((item) => ({ ...item })),
    },
    expiresAt: Date.now() + TTL_MS,
  });
}

/** 测试用 */
export function clearFocusCache(): void {
  cache.clear();
}
