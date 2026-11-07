import {
  resolveAiMode,
  type HandoffAnalysisRequest,
  type HandoffFocusRequest,
  type HelpContextRequest,
} from './contract';
import {
  buildFocusCacheKey,
  getCachedFocus,
  setCachedFocus,
  HANDOFF_FOCUS_PROMPT_VERSION,
} from './focusCache';
import {
  mockHandoffAnalysis,
  mockHandoffFocus,
  mockHelpContext,
} from './mockProvider';
import {
  liveHandoffAnalysis,
  liveHandoffFocus,
  liveHelpContext,
} from './liveProvider';

export * from './contract';
export {
  validateHandoffAnalysis,
  validateHandoffFocus,
  validateHelpContext,
} from './validate';
export {
  runProgressQa,
  runStageBriefAi,
  runMemoryDraft,
  runBlueprintSuggest,
} from './laterAi';

export async function runHandoffAnalysis(request: HandoffAnalysisRequest) {
  const mode = resolveAiMode();
  if (mode === 'live') return liveHandoffAnalysis(request);
  return mockHandoffAnalysis(request);
}

export async function runHandoffFocus(request: HandoffFocusRequest) {
  const cacheKey = buildFocusCacheKey(request);
  if (!request.bypassCache) {
    const cached = getCachedFocus(cacheKey);
    if (cached) {
      return {
        ok: true as const,
        result: {
          ...cached,
          cacheKey: `${cacheKey}:${HANDOFF_FOCUS_PROMPT_VERSION}:hit`,
          latencyMs: 0,
        },
      };
    }
  }

  const mode = resolveAiMode();
  const outcome =
    mode === 'live'
      ? await liveHandoffFocus(request)
      : await mockHandoffFocus(request);
  if (outcome.ok) {
    const withKey = { ...outcome.result, cacheKey };
    setCachedFocus(cacheKey, withKey);
    return { ok: true as const, result: withKey };
  }
  return outcome;
}

export async function runHelpContext(request: HelpContextRequest) {
  const mode = resolveAiMode();
  if (mode === 'live') return liveHelpContext(request);
  return mockHelpContext(request);
}
